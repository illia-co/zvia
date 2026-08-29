import { Fragment } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { ToolId } from '@renderer/lib/tools'
import type { LayoutNode } from '@renderer/state/workspaceStore'
import { collectPanelIdsInLayout, useWorkspaceStore } from '@renderer/state/workspaceStore'
import { PanelProvider } from '@renderer/state/PanelContext'
import { renderToolPanel } from '@renderer/tools/renderToolPanel'
import { cn } from '@renderer/lib/utils'

interface PanelLayoutProps {
  serverId: string
  node: LayoutNode
  focusedPanelId: string | null
  tabOrder: string[]
}

function PanelChrome({
  panelId,
  isFocused,
  isVisible,
  onFocus,
  children
}: {
  panelId: string
  isFocused: boolean
  isVisible: boolean
  onFocus: () => void
  children: React.ReactNode
}) {
  return (
    <PanelProvider panelId={panelId} isVisible={isVisible}>
      <div className="h-full rounded-panel bg-divider p-px" onPointerDown={onFocus}>
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--radius-panel-inner)] bg-bg-secondary">
          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </PanelProvider>
  )
}

function ToolPanel({
  panelId,
  toolId,
  isFocused,
  isVisible,
  onFocus
}: {
  panelId: string
  toolId: ToolId
  isFocused: boolean
  isVisible: boolean
  onFocus: () => void
}) {
  return (
    <PanelChrome panelId={panelId} isFocused={isFocused} isVisible={isVisible} onFocus={onFocus}>
      {renderToolPanel(toolId)}
    </PanelChrome>
  )
}

function SplitPanelSlot({
  panelId,
  toolId,
  focusedPanelId,
  onFocusPanel
}: {
  panelId: string
  toolId: ToolId
  focusedPanelId: string | null
  onFocusPanel: (panelId: string) => void
}) {
  return (
    <ToolPanel
      panelId={panelId}
      toolId={toolId}
      isFocused={focusedPanelId === panelId}
      isVisible
      onFocus={() => onFocusPanel(panelId)}
    />
  )
}

function SplitLayout({
  serverId,
  node,
  focusedPanelId,
  onFocusPanel
}: {
  serverId: string
  node: Extract<LayoutNode, { type: 'split' }>
  focusedPanelId: string | null
  onFocusPanel: (panelId: string) => void
}) {
  const setSplitLayout = useWorkspaceStore((s) => s.setSplitLayout)
  const panels = useWorkspaceStore((s) => s.getWorkspace(serverId).panels)

  return (
    <Group
      id={node.id}
      orientation={node.direction === 'horizontal' ? 'horizontal' : 'vertical'}
      defaultLayout={node.layout}
      onLayoutChanged={(layout) => setSplitLayout(serverId, node.id, layout)}
      className="h-full gap-2"
    >
      {node.children.map((child, index) => {
        const childId = child.type === 'panel' ? child.panelId : child.id

        return (
          <Fragment key={childId}>
            {index > 0 && <Separator className="bg-divider" />}
            <Panel id={childId} minSize={15} className="min-h-0">
              {child.type === 'panel' ? (
                panels[child.panelId] ? (
                  <SplitPanelSlot
                    panelId={child.panelId}
                    toolId={panels[child.panelId].toolId}
                    focusedPanelId={focusedPanelId}
                    onFocusPanel={onFocusPanel}
                  />
                ) : null
              ) : (
                <SplitLayout
                  serverId={serverId}
                  node={child}
                  focusedPanelId={focusedPanelId}
                  onFocusPanel={onFocusPanel}
                />
              )}
            </Panel>
          </Fragment>
        )
      })}
    </Group>
  )
}

/**
 * Keep every open tool panel mounted in one stable parent and toggle visibility with CSS.
 * Portals into layout slots were remounting panels when `root` changed (e.g. Terminal → Files),
 * which destroyed TerminalPanel state and closed PTY sessions via TerminalView cleanup.
 */
function StablePanelStack({
  serverId,
  tabOrder,
  focusedPanelId,
  forceHidden = false
}: {
  serverId: string
  tabOrder: string[]
  focusedPanelId: string | null
  forceHidden?: boolean
}) {
  const focusPanel = useWorkspaceStore((s) => s.focusPanel)
  const panels = useWorkspaceStore((s) => s.getWorkspace(serverId).panels)

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      {tabOrder.map((panelId) => {
        const panel = panels[panelId]
        if (!panel) return null

        const isVisible = !forceHidden && panelId === focusedPanelId
        const isFocused = focusedPanelId === panelId

        return (
          <div
            key={panelId}
            className={cn(
              'absolute inset-0 flex min-h-0 flex-col',
              isVisible ? 'visible z-10' : 'invisible pointer-events-none z-0'
            )}
            inert={!isVisible ? true : undefined}
            aria-hidden={!isVisible}
          >
            <ToolPanel
              panelId={panelId}
              toolId={panel.toolId}
              isFocused={isFocused}
              isVisible={isVisible}
              onFocus={() => focusPanel(serverId, panelId)}
            />
          </div>
        )
      })}
    </div>
  )
}

export function PanelLayout({ serverId, node, focusedPanelId, tabOrder }: PanelLayoutProps) {
  const focusPanel = useWorkspaceStore((s) => s.focusPanel)

  if (node.type === 'split') {
    const panelsInLayout = new Set(collectPanelIdsInLayout(node))
    const offLayoutPanelIds = tabOrder.filter((panelId) => !panelsInLayout.has(panelId))

    return (
      <div className="relative h-full min-h-0">
        <SplitLayout
          serverId={serverId}
          node={node}
          focusedPanelId={focusedPanelId}
          onFocusPanel={(panelId) => focusPanel(serverId, panelId)}
        />
        {offLayoutPanelIds.length > 0 && (
          <StablePanelStack
            serverId={serverId}
            tabOrder={offLayoutPanelIds}
            focusedPanelId={focusedPanelId}
            forceHidden
          />
        )}
      </div>
    )
  }

  return (
    <StablePanelStack
      serverId={serverId}
      tabOrder={tabOrder}
      focusedPanelId={focusedPanelId}
    />
  )
}
