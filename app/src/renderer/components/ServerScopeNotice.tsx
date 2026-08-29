import { useServerContext } from '@renderer/state/ServerContext'
import { StatusDot } from '@renderer/components/ui/status-dot'

export function ServerScopeNotice() {
  const { server, connectionState } = useServerContext()

  if (!server) {
    return (
      <p className="text-xs text-text-secondary">No server selected</p>
    )
  }

  const endpoint = `${server.username}@${server.hostname}`

  return (
    <div className="flex items-center gap-2 text-xs text-text-secondary">
      <StatusDot state={connectionState} />
      <div className="min-w-0">
        <p className="truncate font-medium text-text">{server.name}</p>
        <p className="truncate">{endpoint}</p>
      </div>
    </div>
  )
}
