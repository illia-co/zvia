import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'

interface ElevationRequiredProps {
  serverId: ServerId
  command: string
  className?: string
}

export function ElevationRequired({ serverId, command, className }: ElevationRequiredProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  return (
    <div className={cn('rounded-panel bg-bg-secondary p-4', className)}>
      <p className="text-sm font-medium text-text">Elevated privileges required</p>
      <p className="mt-2 text-xs text-text-secondary">
        This action requires root access or passwordless sudo on the remote server.
      </p>
      <pre className="mt-3 overflow-x-auto rounded-sm bg-bg p-2 font-mono text-[10px] text-text-secondary">
        {command}
      </pre>
      <Button
        size="sm"
        className="mt-4"
        onClick={() => openWithIntent(serverId, { tool: 'terminal', prefill: command })}
      >
        Continue in Terminal
      </Button>
    </div>
  )
}
