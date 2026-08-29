import type { SslAutoRenewal } from '@shared/ssl'
import { Button } from '@renderer/components/ui/button'

interface SslAutoRenewalSectionProps {
  autoRenewal: SslAutoRenewal
  actionLoading: boolean
  onEnable: () => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

export function SslAutoRenewalSection({
  autoRenewal,
  actionLoading,
  onEnable
}: SslAutoRenewalSectionProps) {
  if (!autoRenewal.configured) {
    return (
      <div className="border-t border-divider p-4">
        <p className="text-xs font-medium text-text">Auto-renewal not configured</p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">
          Certbot can renew certificates automatically before they expire. Enable a systemd timer when
          nothing else is managing renewals yet.
        </p>
        {autoRenewal.canEnable && (
          <Button size="sm" className="mt-4" disabled={actionLoading} onClick={onEnable}>
            Enable auto renewal
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="border-t border-divider p-4">
      <p className="mb-3 text-[10px] uppercase tracking-wider text-text-tertiary">Auto-renewal</p>
      <dl>
        <Field label="Method" value={autoRenewal.method} />
        <Field label="Detail" value={autoRenewal.detail ?? '—'} />
        <Field label="Next run" value={autoRenewal.nextRun ?? '—'} />
        <Field label="Last attempt" value={autoRenewal.lastAttempt ?? '—'} />
        <Field label="Last result" value={autoRenewal.lastResult ?? '—'} />
      </dl>
    </div>
  )
}
