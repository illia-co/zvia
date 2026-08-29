import { useCallback, useState } from 'react'
import { getToolLabel } from '@renderer/lib/tools'
import { cn } from '@renderer/lib/utils'
import { useServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'

const PANEL_DRAG_MIME = 'application/x-relay-panel-id'

export function TabStrip() {
  const { serverId } = useServerContext()
  const workspace = useWorkspaceStore((s) => (serverId ? s.getWorkspace(serverId) : null))
  const focusPanel = useWorkspaceStore((s) => s.focusPanel)
  const requestClosePanel = useWorkspaceStore((s) => s.requestClosePanel)
  const splitPanel = useWorkspaceStore((s) => s.splitPanel)
  const reorderTabs = useWorkspaceStore((s) => s.reorderTabs)

  const [draggingPanelId, setDraggingPanelId] = useState<string | null>(null)
  const [dropTargetPanelId, setDropTargetPanelId] = useState<string | null>(null)

  const clearDragState = useCallback(() => {
    setDraggingPanelId(null)
    setDropTargetPanelId(null)
  }, [])

  const handleDragStart = useCallback((panelId: string, event: React.DragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData(PANEL_DRAG_MIME, panelId)
    setDraggingPanelId(panelId)
    setDropTargetPanelId(null)
  }, [])

  const handleDragOver = useCallback(
    (panelId: string, event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      if (panelId !== draggingPanelId) {
        setDropTargetPanelId(panelId)
      }
    },
    [draggingPanelId]
  )

  const handleDrop = useCallback(
    (targetPanelId: string, event: React.DragEvent<HTMLButtonElement>) => {
      event.preventDefault()
      const sourcePanelId = event.dataTransfer.getData(PANEL_DRAG_MIME)
      if (serverId && sourcePanelId && sourcePanelId !== targetPanelId) {
        reorderTabs(serverId, sourcePanelId, targetPanelId)
      }
      clearDragState()
    },
    [clearDragState, reorderTabs, serverId]
  )

  if (!serverId || !workspace || workspace.tabOrder.length === 0) {
    return null
  }

  return (
    <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-divider bg-bg px-3 py-2">
      {workspace.tabOrder.map((panelId) => {
        const panel = workspace.panels[panelId]
        if (!panel) return null
        const isFocused = workspace.focusedPanelId === panelId
        const isDragging = draggingPanelId === panelId
        const isDropTarget = dropTargetPanelId === panelId && draggingPanelId !== panelId

        return (
          <ContextMenu key={panelId}>
            <ContextMenuTrigger asChild>
              <button
                type="button"
                draggable
                onClick={() => focusPanel(serverId, panelId)}
                onDragStart={(event) => handleDragStart(panelId, event)}
                onDragOver={(event) => handleDragOver(panelId, event)}
                onDragEnter={(event) => handleDragOver(panelId, event)}
                onDrop={(event) => handleDrop(panelId, event)}
                onDragEnd={clearDragState}
                className={cn(
                  'group inline-flex max-w-48 items-center gap-1.5 rounded-panel border px-2.5 py-1 text-xs transition-[color,background-color,border-color,box-shadow,opacity] duration-default',
                  isFocused
                    ? 'border-divider bg-bg-secondary text-text shadow-panel'
                    : 'border-transparent text-text-secondary hover:border-divider/60 hover:bg-bg-secondary/80 hover:text-text',
                  isDragging && 'opacity-40',
                  isDropTarget && 'border-divider ring-1 ring-divider'
                )}
              >
                <span className="truncate">{getToolLabel(panel.toolId)}</span>
                <span
                  role="button"
                  tabIndex={-1}
                  draggable={false}
                  aria-label={`Close ${getToolLabel(panel.toolId)}`}
                  className="rounded px-0.5 text-text-tertiary opacity-0 hover:bg-bg hover:text-text group-hover:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    requestClosePanel(serverId, panelId)
                  }}
                  onDragStart={(event) => event.preventDefault()}
                  onMouseDown={(event) => event.stopPropagation()}
                >
                  ×
                </span>
              </button>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onSelect={() => splitPanel(serverId, panelId, 'horizontal', panel.toolId)}>
                Split horizontally
              </ContextMenuItem>
              <ContextMenuItem onSelect={() => splitPanel(serverId, panelId, 'vertical', panel.toolId)}>
                Split vertically
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onSelect={() => requestClosePanel(serverId, panelId)}>Close</ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}
