import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { StatusDot } from '@renderer/components/ui/status-dot'
import { cn } from '@renderer/lib/utils'
import { useServerStore } from '@renderer/state/serverStore'
import type { ConnectionState, ServerId, ServerProfile } from '@shared/server'

interface ServerSidebarProps {
  onAddServer: () => void
}

interface ServerListItemProps {
  profile: ServerProfile
  state: ConnectionState
  isSelected: boolean
  onSelect: (serverId: ServerId) => void
  onConnect: (serverId: ServerId) => void
  onDisconnect: (serverId: ServerId) => void
  onRemove: (serverId: ServerId) => void
}

function ServerListItem({
  profile,
  state,
  isSelected,
  onSelect,
  onConnect,
  onDisconnect,
  onRemove
}: ServerListItemProps) {
  const isConnected = state === 'connected' || state === 'connecting' || state === 'reconnecting'
  const showConnect = !isConnected

  return (
    <div
      className={cn(
        'group flex items-center gap-0.5 rounded-panel',
        isSelected ? 'bg-bg-secondary' : 'hover:bg-bg-secondary'
      )}
    >
      <button
        type="button"
        onClick={() => onSelect(profile.id)}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors duration-default',
          isSelected ? 'text-text' : 'text-text-secondary group-hover:text-text'
        )}
      >
        <StatusDot state={state} />
        <span className="truncate">{profile.name}</span>
      </button>

      {showConnect && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void onConnect(profile.id)
          }}
          className="shrink-0 px-1.5 py-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
          aria-label={`Connect to ${profile.name}`}
        >
          Connect
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="shrink-0 px-1.5 py-1 text-sm text-text-secondary opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
            aria-label={`Actions for ${profile.name}`}
            onClick={(event) => event.stopPropagation()}
          >
            ⋯
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="right">
          {isConnected ? (
            <DropdownMenuItem onSelect={() => void onDisconnect(profile.id)}>
              Disconnect
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => void onConnect(profile.id)}>
              Connect
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-status-error"
            onSelect={() => void onRemove(profile.id)}
          >
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export function ServerSidebar({ onAddServer }: ServerSidebarProps) {
  const profiles = useServerStore((s) => s.profiles)
  const selectedServerId = useServerStore((s) => s.selectedServerId)
  const connectionStates = useServerStore((s) => s.connectionStates)
  const selectServer = useServerStore((s) => s.selectServer)
  const connect = useServerStore((s) => s.connect)
  const disconnect = useServerStore((s) => s.disconnect)
  const removeProfile = useServerStore((s) => s.removeProfile)

  return (
    <aside className="flex w-44 shrink-0 flex-col border-r border-divider bg-bg">
      <div className="flex items-center justify-between px-3 py-3">
        <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
          Servers
        </span>
        <button
          type="button"
          className="text-sm text-text-secondary hover:text-text"
          onClick={onAddServer}
          aria-label="Add server"
        >
          +
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav className="space-y-0.5 px-2 pb-3">
          {profiles.length === 0 ? (
            <p className="px-2 py-2 text-xs text-text-secondary">No servers yet.</p>
          ) : (
            profiles.map((profile) => (
              <ServerListItem
                key={profile.id}
                profile={profile}
                state={connectionStates[profile.id] ?? 'disconnected'}
                isSelected={profile.id === selectedServerId}
                onSelect={selectServer}
                onConnect={connect}
                onDisconnect={disconnect}
                onRemove={removeProfile}
              />
            ))
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}
