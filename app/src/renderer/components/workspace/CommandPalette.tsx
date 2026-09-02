import { Command } from 'cmdk'
import { Dialog, DialogContent, DialogTitle } from '@renderer/components/ui/dialog'
import { TOOLS } from '@renderer/lib/tools'
import { useServerContext } from '@renderer/state/ServerContext'
import { useServerStore } from '@renderer/state/serverStore'
import { useThemeStore, type ThemePreference } from '@renderer/state/themeStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { useCommandPaletteStore } from '@renderer/state/commandPaletteStore'

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark'
}

export function CommandPalette() {
  const open = useCommandPaletteStore((s) => s.open)
  const setOpen = useCommandPaletteStore((s) => s.setOpen)
  const { serverId } = useServerContext()
  const openTool = useWorkspaceStore((s) => s.openTool)
  const connect = useServerStore((s) => s.connect)
  const disconnect = useServerStore((s) => s.disconnect)
  const connectionState = useServerContext().connectionState
  const themePreference = useThemeStore((s) => s.preference)
  const setThemePreference = useThemeStore((s) => s.setPreference)

  const run = (action: () => void) => {
    action()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg p-0">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <Command className="rounded-panel bg-bg-elevated">
          <Command.Input
            placeholder="Type a command…"
            className="w-full border-b border-divider bg-transparent px-4 py-3 text-sm outline-none placeholder:text-text-tertiary"
          />
          <Command.List className="max-h-72 overflow-y-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-xs text-text-secondary">
              No results.
            </Command.Empty>

            {serverId && (
              <Command.Group heading="Tools" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-tertiary">
                {TOOLS.map((tool) => (
                  <Command.Item
                    key={tool.id}
                    value={`open ${tool.label}`}
                    onSelect={() => run(() => openTool(serverId, tool.id))}
                    className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-text data-[selected=true]:bg-bg-secondary"
                  >
                    Open {tool.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {serverId && (
              <Command.Group heading="Connection" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-tertiary">
                {connectionState === 'connected' ||
                connectionState === 'connecting' ||
                connectionState === 'reconnecting' ? (
                  <Command.Item
                    value="disconnect"
                    onSelect={() => run(() => void disconnect(serverId))}
                    className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-text data-[selected=true]:bg-bg-secondary"
                  >
                    Disconnect
                  </Command.Item>
                ) : (
                  <Command.Item
                    value="connect"
                    onSelect={() => run(() => void connect(serverId))}
                    className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-text data-[selected=true]:bg-bg-secondary"
                  >
                    Connect
                  </Command.Item>
                )}
              </Command.Group>
            )}

            <Command.Group heading="Appearance" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-text-tertiary">
              {(Object.keys(THEME_LABELS) as ThemePreference[]).map((preference) => (
                <Command.Item
                  key={preference}
                  value={`theme ${THEME_LABELS[preference]}`}
                  onSelect={() => run(() => setThemePreference(preference))}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-sm text-text data-[selected=true]:bg-bg-secondary"
                >
                  {THEME_LABELS[preference]} theme
                  {themePreference === preference ? ' ✓' : ''}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
