import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import type { NginxStatus } from '@shared/nginx'
import type { SslOverview } from '@shared/ssl'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { deploymentNavLink, lookupDeploymentByDomain } from '@renderer/lib/deploymentCrossLinks'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface NginxOverviewTabProps {
  serverId: ServerId
  status: NginxStatus
  sslOverview: SslOverview | null
  onOpenService: () => void
}

const LABEL_WIDTH = 'w-40'

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className={`${LABEL_WIDTH} shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary`}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-divider py-2">
      <dt className={`${LABEL_WIDTH} shrink-0 pt-0.5 text-[10px] uppercase tracking-wider text-text-tertiary`}>
        {label}
      </dt>
      <dd className="min-w-0 flex-1 space-y-2 text-xs text-text-secondary">{children}</dd>
    </div>
  )
}

export function NginxOverviewTab({
  serverId,
  status,
  sslOverview,
  onOpenService
}: NginxOverviewTabProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const [deploymentDomain, setDeploymentDomain] = useState<string | null>(null)
  const httpsCerts =
    sslOverview?.certificates.filter((cert) =>
      cert.nginxSites.some((site) => site.listensHttps)
    ) ?? []

  useEffect(() => {
    let cancelled = false
    const domains = httpsCerts.map((cert) => cert.primaryDomain)
    void (async () => {
      for (const domain of domains) {
        const match = await lookupDeploymentByDomain(serverId, domain)
        if (cancelled) return
        if (match) {
          setDeploymentDomain(domain)
          return
        }
      }
      if (!cancelled) setDeploymentDomain(null)
    })()
    return () => {
      cancelled = true
    }
  }, [httpsCerts, serverId])

  return (
    <div className="h-full overflow-auto p-4">
      <dl>
        <Field label="Version" value={status.version ?? 'Unknown'} />
        <Field label="Main PID" value={status.mainPid === null ? '—' : String(status.mainPid)} />
        <Field label="Active since" value={status.activeSince ?? '—'} />
        <Field label="Unit file state" value={status.unitFileState ?? '—'} />
        <Field label="Config file" value={status.paths.confPath ?? 'Unknown'} />
        <Field label="Config root" value={status.paths.configRoot ?? 'Unknown'} />
        <Field label="Prefix" value={status.paths.prefix ?? 'Unknown'} />
        <Field label="Default access log" value={status.paths.accessLogPath ?? 'Unknown'} />
        <Field label="Default error log" value={status.paths.errorLogPath ?? 'Unknown'} />

        {sslOverview && (
          <FieldBlock label="HTTPS">
            {httpsCerts.length === 0 ? (
              <p>No TLS certificates linked to nginx sites were detected.</p>
            ) : (
              <ul className="space-y-1">
                {httpsCerts.map((cert) => (
                  <li key={cert.id} className="font-mono text-text">
                    {cert.primaryDomain}
                    {cert.daysRemaining !== null ? ` · ${cert.daysRemaining}d remaining` : ''}
                  </li>
                ))}
              </ul>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="-ml-2"
              onClick={() => openWithIntent(serverId, { tool: 'ssl' })}
            >
              Open in SSL
            </Button>
            {deploymentDomain && (
              <Button
                size="sm"
                variant="ghost"
                className="-ml-2"
                onClick={() => {
                  void lookupDeploymentByDomain(serverId, deploymentDomain).then((match) => {
                    if (!match) return
                    deploymentNavLink(serverId, match, openWithIntent).onClick()
                  })
                }}
              >
                View in Deployments
              </Button>
            )}
          </FieldBlock>
        )}

        <FieldBlock label="Configuration test">
          {status.validation.state === 'unknown' ? (
            <p>Not tested in this session. Run Test configuration to check the live config.</p>
          ) : (
            <>
              <p className="text-text">
                {status.validation.state === 'valid'
                  ? 'nginx -t reported a valid configuration.'
                  : 'nginx -t reported a problem.'}
              </p>
              <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
                {status.validation.output || 'No output.'}
              </pre>
            </>
          )}
        </FieldBlock>

        <FieldBlock label="Related">
          <div className="flex flex-wrap gap-2">
            {status.systemdAvailable && (
              <Button size="sm" variant="ghost" className="-ml-2" onClick={onOpenService}>
                Open nginx.service in Services
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className={status.systemdAvailable ? undefined : '-ml-2'}
              onClick={() => openWithIntent(serverId, { tool: 'ports', port: 80 })}
            >
              Open in Ports
            </Button>
          </div>
          {!status.systemdAvailable && (
            <p className="leading-relaxed">
              systemd is not available on this server, so state is derived from the running process
              list. Start, stop, restart and reload will not work without a service manager.
            </p>
          )}
        </FieldBlock>
      </dl>
    </div>
  )
}
