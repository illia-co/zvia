import type { ConnectionState } from '@shared/server'
import { cn } from '@renderer/lib/utils'

interface StatusDotProps {
  state: ConnectionState
  className?: string
}

const stateColors: Record<ConnectionState, string> = {
  connected: 'bg-status-healthy',
  connecting: 'bg-status-warning',
  reconnecting: 'bg-status-warning',
  error: 'bg-status-error',
  disconnected: 'bg-text-tertiary'
}

export function StatusDot({ state, className }: StatusDotProps) {
  return (
    <span
      className={cn('inline-block size-1.5 shrink-0 rounded-full', stateColors[state], className)}
      aria-hidden
    />
  )
}
