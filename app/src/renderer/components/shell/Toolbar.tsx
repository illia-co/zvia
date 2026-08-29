import { getConnectionLabel, useServerStore } from '@renderer/state/serverStore'
import { useServerContext } from '@renderer/state/ServerContext'
import { useThemeStore } from '@renderer/state/themeStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { StatusDot } from '@renderer/components/ui/status-dot'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'

export function Toolbar() {
  const { server, serverId, connectionState } = useServerContext()
  const connect = useServerStore((s) => s.connect)
  const disconnect = useServerStore((s) => s.disconnect)
  const setCommandPaletteOpen = useWorkspaceStore((s) => s.setCommandPaletteOpen)
  const themePreference = useThemeStore((s) => s.preference)
  const cycleTheme = useThemeStore((s) => s.cyclePreference)

  const isConnected =
    connectionState === 'connected' ||
    connectionState === 'connecting' ||
    connectionState === 'reconnecting'

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-divider px-4">
      <div className="flex min-w-0 items-center gap-3">
        {server ? (
          <>
            <span className="truncate text-sm font-medium text-text">{server.name}</span>
            <span className="flex items-center gap-1.5 text-xs text-text-secondary">
              <StatusDot state={connectionState} />
              {getConnectionLabel(connectionState)}
            </span>
          </>
        ) : (
          <span className="text-sm text-text-secondary">No server selected</span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {serverId && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Connection actions">
                ⋯
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isConnected ? (
                <DropdownMenuItem onSelect={() => void disconnect(serverId)}>
                  Disconnect
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onSelect={() => void connect(serverId)}>
                  Connect
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled>Server settings</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => cycleTheme()}
          aria-label="Cycle theme"
          title={`Theme: ${themePreference}`}
        >
          {themePreference === 'dark' ? '◐' : themePreference === 'light' ? '○' : '◎'}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Open command palette"
          title="Command palette (⌘K)"
        >
          ⌘K
        </Button>
      </div>
    </header>
  )
}
