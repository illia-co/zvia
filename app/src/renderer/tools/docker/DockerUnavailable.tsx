import { Button } from '@renderer/components/ui/button'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import type { ServerId } from '@shared/server'

interface DockerUnavailableProps {
  serverId: ServerId
}

export function DockerUnavailable({ serverId }: DockerUnavailableProps) {
  const openTool = useWorkspaceStore((s) => s.openTool)

  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <p className="text-sm font-medium text-text">Docker unavailable</p>
      <p className="mt-2 max-w-md text-xs leading-relaxed text-text-secondary">
        Docker is not installed or the current SSH user does not have permission to access
        Docker.
      </p>
      <Button size="sm" className="mt-5" onClick={() => openTool(serverId, 'terminal')}>
        Open Terminal
      </Button>
    </div>
  )
}
