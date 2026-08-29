import type { SslCertificate, SslCertificateStatus } from '@shared/ssl'
import { cn } from '@renderer/lib/utils'

const STATUS_LABELS: Record<SslCertificateStatus, string> = {
  valid: 'Valid',
  'expiring-soon': 'Expiring soon',
  expired: 'Expired',
  'renewal-failed': 'Renewal failed',
  'renewal-unavailable': 'Manual renewal',
  unknown: 'Unknown'
}

const STATUS_DOT: Record<SslCertificateStatus, string> = {
  valid: 'bg-status-healthy',
  'expiring-soon': 'bg-status-warning',
  expired: 'bg-status-error',
  'renewal-failed': 'bg-status-error',
  'renewal-unavailable': 'bg-text-tertiary',
  unknown: 'bg-text-tertiary'
}

interface SslCertificateListProps {
  certificates: SslCertificate[]
  autoRenewalConfigured: boolean
  selectedId: string | null
  onSelect: (cert: SslCertificate) => void
}

export function statusLabel(status: SslCertificateStatus): string {
  return STATUS_LABELS[status]
}

export function statusDotClass(status: SslCertificateStatus): string {
  return STATUS_DOT[status]
}

export function SslCertificateList({
  certificates,
  autoRenewalConfigured,
  selectedId,
  onSelect
}: SslCertificateListProps) {
  if (certificates.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-text-secondary">
        No certificates were discovered on this server.
      </p>
    )
  }

  return (
    <ul>
      {certificates.map((cert) => (
        <li key={cert.id}>
          <button
            type="button"
            onClick={() => onSelect(cert)}
            className={cn(
              'flex w-full items-center gap-3 border-b border-divider px-3 py-2.5 text-left transition-colors duration-default hover:bg-bg-secondary',
              selectedId === cert.id && 'bg-bg-secondary'
            )}
          >
            <span
              className={cn('size-1.5 shrink-0 rounded-full', statusDotClass(cert.status))}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-text">{cert.primaryDomain}</p>
              <p className="truncate text-[11px] text-text-secondary">
                {cert.issuer ?? 'Unknown issuer'}
                {cert.daysRemaining !== null ? ` · ${cert.daysRemaining}d remaining` : ''}
              </p>
            </div>
            {autoRenewalConfigured && cert.managedByCertbot && (
              <span className="shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
                Auto
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
