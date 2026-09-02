import { useEffect } from 'react'
import { KEYBOARD_ZERO_TOOL, TOOLS } from '@renderer/lib/tools'
import { useServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { useThemeStore } from '@renderer/state/themeStore'
import { useCommandPaletteStore } from '@renderer/state/commandPaletteStore'

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

export function useShellKeyboard(): void {
  const { serverId } = useServerContext()
  const toggleCommandPalette = useCommandPaletteStore((s) => s.toggle)
  const openTool = useWorkspaceStore((s) => s.openTool)
  const requestClosePanel = useWorkspaceStore((s) => s.requestClosePanel)
  const cyclePreference = useThemeStore((s) => s.cyclePreference)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return

      const mod = event.metaKey || event.ctrlKey

      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        toggleCommandPalette()
        return
      }

      if (mod && event.key.toLowerCase() === 'w' && serverId) {
        const workspace = useWorkspaceStore.getState().getWorkspace(serverId)
        const focusedPanelId = workspace.focusedPanelId
        if (focusedPanelId) {
          event.preventDefault()
          requestClosePanel(serverId, focusedPanelId)
        }
        return
      }

      if (mod && !event.shiftKey && !event.altKey && serverId) {
        if (event.key === '0') {
          event.preventDefault()
          openTool(serverId, KEYBOARD_ZERO_TOOL)
          return
        }

        const toolIndex = Number.parseInt(event.key, 10)
        if (toolIndex >= 1 && toolIndex <= TOOLS.length) {
          event.preventDefault()
          const tool = TOOLS[toolIndex - 1]
          if (tool) {
            openTool(serverId, tool.id)
          }
        }
      }

      if (mod && event.shiftKey && event.key.toLowerCase() === 'l') {
        event.preventDefault()
        cyclePreference()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    requestClosePanel,
    cyclePreference,
    openTool,
    serverId,
    toggleCommandPalette
  ])
}
