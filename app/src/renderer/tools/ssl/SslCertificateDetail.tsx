import type { SslAutoRenewal, SslCertificate } from '@shared/ssl'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { statusLabel } from './SslCertificateList'

interface FieldProps {
  label: string
  value: string
}

function Field({ label, value }: FieldProps) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

interface SslCertificateDetailProps {
  serverId: ServerId
  certificate: SslCertificate
  actionLoading: boolean
  onRenew: () => void
  onTestRenewal: () => void
}

export function SslCertificateDetail({
  serverId,
  certificate,
  actionLoading,
  onRenew,
  onTestRenewal
}: SslCertificateDetailProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const site = certificate.nginxSites[0]

  return (
    <div className="h-full overflow-auto p-4">
      <dl className="mb-5">
        <Field label="Domain" value={certificate.primaryDomain} />
        <Field label="Status" value={statusLabel(certificate.status)} />
        <Field label="Issuer" value={certificate.issuer ?? '—'} />
        <Field label="Issued" value={certificate.issuedAt ?? '—'} />
        <Field label="Expires" value={certificate.expiresAt ?? '—'} />
        <Field
          label="Days remaining"
          value={certificate.daysRemaining === null ? '—' : String(certificate.daysRemaining)}
        />
        <Field label="SANs" value={certificate.domains.join(', ') || '—'} />
        <Field label="Certificate" value={certificate.certificatePath} />
        <Field label="Private key" value={certificate.privateKeyPath ?? '—'} />
        <Field label="Renewal" value={certificate.renewal.method} />
        <Field
          label="Nginx site"
          value={site ? `${site.configPath} (${site.serverNames.join(', ')})` : '—'}
        />
      </dl>

      {certificate.inspectionError && (
        <p className="mb-5 rounded-panel bg-bg-secondary p-3 text-xs text-text-secondary">
          {certificate.inspectionError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {certificate.managedByCertbot && (
          <>
            <Button size="sm" disabled={actionLoading} onClick={onRenew}>
              Renew
            </Button>
            <Button size="sm" variant="ghost" disabled={actionLoading} onClick={onTestRenewal}>
              Test renewal
            </Button>
          </>
        )}
        {site && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              openWithIntent(serverId, { tool: 'nginx', configPath: site.configPath })
            }
          >
            Open Nginx configuration
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openWithIntent(serverId, { tool: 'ports', port: 443 })}
        >
          Open in Ports
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            openWithIntent(serverId, {
              tool: 'logs',
              unit: 'letsencrypt'
            })
          }
        >
          Open in Logs
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            openWithIntent(serverId, { tool: 'terminal', prefill: 'certbot certificates' })
          }
        >
          Open Terminal
        </Button>
      </div>
    </div>
  )
}
