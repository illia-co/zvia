import { Button } from '@renderer/components/ui/button'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import type { ServerId } from '@shared/server'

interface GitUnavailableProps {
  serverId: ServerId
}

export function GitUnavailable({ serverId }: GitUnavailableProps) {
  const openTool = useWorkspaceStore((s) => s.openTool)

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">Git unavailable</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
        Git is not installed or not on PATH for the current SSH user.
      </p>
      <Button size="sm" className="mt-5" onClick={() => openTool(serverId, 'terminal')}>
        Open Terminal
      </Button>
    </div>
  )
}
