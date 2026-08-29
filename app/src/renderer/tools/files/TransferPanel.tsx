import { Button } from '@renderer/components/ui/button'
import type { ActiveTransfer } from './useFileManager'
import { formatFileSize, formatRemaining, formatSpeed } from './fileUtils'

interface TransferPanelProps {
  transfers: ActiveTransfer[]
  onCancel: (transferId: string) => void
  onDismiss: (transferId: string) => void
}

export function TransferPanel({ transfers, onCancel, onDismiss }: TransferPanelProps) {
  const active = transfers.filter((t) => t.status === 'active')
  const recent = transfers.filter((t) => t.status !== 'active').slice(-3)

  if (active.length === 0 && recent.length === 0) return null

  return (
    <div className="shrink-0 border-t border-divider bg-bg-secondary px-3 py-2">
      <div className="space-y-2">
        {active.map((transfer) => {
          const percent =
            transfer.totalBytes > 0
              ? Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100)
              : 0
          const remaining = transfer.totalBytes - transfer.bytesTransferred
          return (
            <div key={transfer.transferId} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-text">
                  {transfer.direction === 'upload' ? 'Uploading' : 'Downloading'} {transfer.name}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-text-secondary">{percent}%</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onCancel(transfer.transferId)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-divider">
                <div
                  className="h-full bg-text transition-all duration-default"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-text-tertiary">
                <span>
                  {formatFileSize(transfer.bytesTransferred)} / {formatFileSize(transfer.totalBytes)}
                </span>
                <span>
                  {formatSpeed(transfer.speedBps)} · {formatRemaining(remaining, transfer.speedBps)} left
                </span>
              </div>
            </div>
          )
        })}

        {recent.map((transfer) => (
          <div key={transfer.transferId} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-text-secondary">
              {transfer.name} — {transfer.status === 'complete' ? 'Complete' : transfer.error ?? 'Cancelled'}
            </span>
            <Button size="sm" variant="ghost" onClick={() => onDismiss(transfer.transferId)}>
              Dismiss
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
