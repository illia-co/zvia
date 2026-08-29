import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SslCertificate, SslNginxLink } from '@shared/ssl'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useNavigationStore, useToolIntent } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { CertbotNotInstalled, SslUnsupported } from './CertbotNotInstalled'
import { EnableHttpsDialog } from './EnableHttpsDialog'
import { EnableHttpsProgress } from './EnableHttpsProgress'
import { SslAutoRenewalSection } from './SslAutoRenewalSection'
import { SslCertificateDetail } from './SslCertificateDetail'
import { SslCertificateList, statusDotClass } from './SslCertificateList'
import { TestRenewalDialog } from './TestRenewalDialog'
import { useSsl } from './useSsl'

function summaryAnswer(overview: NonNullable<ReturnType<typeof useSsl>['overview']>): {
  https: string
  certificate: string
  renewal: string
} {
  const validCerts = overview.certificates.filter(
    (cert) => cert.status === 'valid' || cert.status === 'expiring-soon'
  )
  const httpsWorking = validCerts.some((cert) =>
    cert.nginxSites.some((site) => site.listensHttps && site.ports.includes(443))
  )

  return {
    https: httpsWorking ? 'HTTPS is configured' : 'HTTPS not detected',
    certificate:
      validCerts.length > 0
        ? `${validCerts.length} valid certificate${validCerts.length === 1 ? '' : 's'}`
        : overview.certificates.length > 0
          ? 'Certificates need attention'
          : 'No certificates found',
    renewal: overview.autoRenewal.configured ? 'Auto-renewal configured' : 'Auto-renewal not set up'
  }
}

export function SslPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const isConnected = connectionState === 'connected'
  const intent = useToolIntent('ssl')

  const [selected, setSelected] = useState<SslCertificate | null>(null)
  const [sites, setSites] = useState<SslNginxLink[]>([])
  const [enableDialogOpen, setEnableDialogOpen] = useState(false)
  const [testRenewalCert, setTestRenewalCert] = useState<SslCertificate | null>(null)
  const [workflowStreamId, setWorkflowStreamId] = useState<string | null>(null)

  const ssl = useSsl({ serverId, isConnected, paused: selected !== null || workflowStreamId !== null })

  useEffect(() => {
    setSelected(null)
    setWorkflowStreamId(null)
  }, [serverId])

  useEffect(() => {
    if (!intent?.domain || !ssl.overview) return
    const match = ssl.overview.certificates.find(
      (cert) => cert.primaryDomain === intent.domain || cert.domains.includes(intent.domain!)
    )
    if (match) setSelected(match)
  }, [intent, ssl.overview])

  useEffect(() => {
    if (!isConnected) return
    void window.relay.ssl.nginxSites({ serverId }).then(setSites).catch(() => setSites([]))
  }, [isConnected, serverId, ssl.overview])

  const loadSites = useCallback(async () => {
    if (!isConnected) return
    try {
      setSites(await window.relay.ssl.nginxSites({ serverId }))
    } catch {
      setSites([])
    }
  }, [isConnected, serverId])

  const startEnableHttps = useCallback(
    async (values: { domain: string; configPath: string; email: string; redirect: boolean }) => {
      const streamId = crypto.randomUUID()
      setEnableDialogOpen(false)
      setWorkflowStreamId(streamId)
      try {
        await window.relay.ssl.enableHttpsStart({
          serverId,
          streamId,
          ...values
        })
      } catch (err) {
        setWorkflowStreamId(null)
        throw err
      }
    },
    [serverId]
  )

  const cancelWorkflow = useCallback(() => {
    if (!workflowStreamId) return
    void window.relay.ssl.enableHttpsCancel({ serverId, streamId: workflowStreamId })
    setWorkflowStreamId(null)
    void ssl.refresh()
  }, [serverId, ssl, workflowStreamId])

  const summary = useMemo(
    () => (ssl.overview ? summaryAnswer(ssl.overview) : null),
    [ssl.overview]
  )

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to inspect certificates.
          </p>
        </div>
      </div>
    )
  }

  if (workflowStreamId) {
    return (
      <EnableHttpsProgress
        serverId={serverId}
        streamId={workflowStreamId}
        onCancel={cancelWorkflow}
        onDone={() => {
          setWorkflowStreamId(null)
          void ssl.refresh()
          void loadSites()
        }}
      />
    )
  }

  const errorSurface = ssl.elevation ? (
    <div className="border-b border-divider p-3">
      <ElevationRequired serverId={serverId} command={ssl.elevation} />
    </div>
  ) : ssl.error ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface
        error={ssl.error}
        onRetry={() => void ssl.refresh()}
        onDismiss={ssl.clearError}
      />
    </div>
  ) : null

  if (!ssl.overview) {
    return (
      <div className="flex h-full flex-col">
        {errorSurface ?? (
          <p className="p-6 text-center text-xs text-text-secondary">Discovering certificates…</p>
        )}
      </div>
    )
  }

  const overview = ssl.overview

  if (!overview.nginx.installed) {
    return (
      <SslUnsupported
        serverId={serverId}
        reason="nginx is required for the certbot --nginx workflow. Install nginx before managing HTTPS here."
        nginxInstalled={false}
      />
    )
  }

  if (!overview.certbot.installed && overview.certificates.length === 0) {
    return (
      <>
        {errorSurface}
        <CertbotNotInstalled
          serverId={serverId}
          certbot={overview.certbot}
          nginxInstalled={overview.nginx.installed}
          actionLoading={ssl.actionLoading}
          onInstall={() => void ssl.installCertbot()}
        />
      </>
    )
  }

  if (selected) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelected(null)} />
          <span className="truncate text-xs font-medium text-text">{selected.primaryDomain}</span>
        </div>
        {errorSurface}
        <div className="min-h-0 flex-1">
          <SslCertificateDetail
            serverId={serverId}
            certificate={selected}
            actionLoading={ssl.actionLoading}
            onRenew={() => void ssl.renew(selected.id)}
            onTestRenewal={() => setTestRenewalCert(selected)}
          />
        </div>
        <TestRenewalDialog
          open={testRenewalCert !== null}
          certName={testRenewalCert?.id ?? ''}
          actionLoading={ssl.actionLoading}
          onClose={() => setTestRenewalCert(null)}
          onConfirm={() => ssl.testRenewal(testRenewalCert?.id ?? '')}
        />
      </div>
    )
  }

  const primaryCert = overview.certificates[0]

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-divider px-3 py-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <p className="text-xs font-medium text-text">SSL / Certificates</p>
            {summary && (
              <p className="mt-1 text-[11px] text-text-secondary">
                {summary.https} · {summary.certificate} · {summary.renewal}
              </p>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {primaryCert && (
              <span className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                <span
                  className={cn('size-1.5 rounded-full', statusDotClass(primaryCert.status))}
                  aria-hidden
                />
                {primaryCert.primaryDomain}
              </span>
            )}
            <Button
              size="sm"
              disabled={!overview.certbot.installed || ssl.actionLoading}
              onClick={() => setEnableDialogOpen(true)}
            >
              Enable HTTPS
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={ssl.loading}
              onClick={() => void ssl.refresh()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {errorSurface}

      {!overview.certbot.installed && (
        <div className="border-b border-divider px-3 py-2 text-xs text-text-secondary">
          Certbot is not installed. Existing certificates are shown read-only.
          <Button
            size="sm"
            variant="ghost"
            className="ml-2"
            disabled={ssl.actionLoading}
            onClick={() => void ssl.installCertbot()}
          >
            Install Certbot
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        <SslCertificateList
          certificates={overview.certificates}
          autoRenewalConfigured={overview.autoRenewal.configured}
          selectedId={null}
          onSelect={setSelected}
        />
      </div>

      <SslAutoRenewalSection
        autoRenewal={overview.autoRenewal}
        actionLoading={ssl.actionLoading}
        onEnable={() => void ssl.enableAutoRenewal()}
      />

      <EnableHttpsDialog
        open={enableDialogOpen}
        sites={sites}
        initialDomain={intent?.domain}
        onClose={() => setEnableDialogOpen(false)}
        onSubmit={(values) => void startEnableHttps(values)}
      />
    </div>
  )
}
