import { create } from 'zustand'
import type { ServerId } from '@shared/server'
import type { ToolId } from '@renderer/lib/tools'
import { generateId } from '@renderer/lib/utils'
import { usePanelStateStore } from './panelStateStore'
import { useTerminalSessionStore } from './terminalSessionStore'

export interface WorkspacePanel {
  id: string
  toolId: ToolId
}

export type LayoutNode =
  | { type: 'panel'; panelId: string }
  | {
      type: 'split'
      id: string
      direction: 'horizontal' | 'vertical'
      children: LayoutNode[]
      layout: Record<string, number>
    }

export interface ServerWorkspace {
  panels: Record<string, WorkspacePanel>
  root: LayoutNode | null
  focusedPanelId: string | null
  tabOrder: string[]
}

export interface PendingPanelClose {
  serverId: ServerId
  panelId: string
}

interface WorkspaceStoreState {
  workspaces: Record<ServerId, ServerWorkspace>
  pendingPanelClose: PendingPanelClose | null

  getWorkspace: (serverId: ServerId) => ServerWorkspace
  openTool: (serverId: ServerId, toolId: ToolId) => void
  focusPanel: (serverId: ServerId, panelId: string) => void
  requestClosePanel: (serverId: ServerId, panelId: string) => void
  confirmClosePanel: () => void
  cancelClosePanel: () => void
  closePanel: (serverId: ServerId, panelId: string) => void
  splitPanel: (
    serverId: ServerId,
    panelId: string,
    direction: 'horizontal' | 'vertical',
    toolId: ToolId
  ) => void
  setSplitLayout: (serverId: ServerId, splitId: string, layout: Record<string, number>) => void
  reorderTabs: (serverId: ServerId, sourcePanelId: string, targetPanelId: string) => void
}

const EMPTY_WORKSPACE: ServerWorkspace = {
  panels: {},
  root: null,
  focusedPanelId: null,
  tabOrder: []
}

function createEmptyWorkspace(): ServerWorkspace {
  return {
    panels: {},
    root: null,
    focusedPanelId: null,
    tabOrder: []
  }
}

function findPanelByTool(workspace: ServerWorkspace, toolId: ToolId): WorkspacePanel | null {
  return Object.values(workspace.panels).find((panel) => panel.toolId === toolId) ?? null
}

export function isPanelInLayout(node: LayoutNode | null, panelId: string): boolean {
  if (!node) return false
  if (node.type === 'panel') return node.panelId === panelId
  return node.children.some((child) => isPanelInLayout(child, panelId))
}

export function collectPanelIdsInLayout(node: LayoutNode | null): string[] {
  if (!node) return []
  if (node.type === 'panel') return [node.panelId]
  return node.children.flatMap((child) => collectPanelIdsInLayout(child))
}

function ensurePanelVisible(root: LayoutNode | null, panelId: string): LayoutNode {
  if (root && isPanelInLayout(root, panelId)) return root
  return { type: 'panel', panelId }
}

function removePanelFromLayout(node: LayoutNode | null, panelId: string): LayoutNode | null {
  if (!node) return null
  if (node.type === 'panel') {
    return node.panelId === panelId ? null : node
  }

  const children = node.children
    .map((child) => removePanelFromLayout(child, panelId))
    .filter((child): child is LayoutNode => child !== null)

  if (children.length === 0) return null
  if (children.length === 1) return children[0]

  const childIds = children.flatMap((child) =>
    child.type === 'panel' ? [child.panelId] : child.children.flatMap((c) => (c.type === 'panel' ? [c.panelId] : []))
  )
  const layout: Record<string, number> = {}
  const share = 100 / childIds.length
  childIds.forEach((id) => {
    layout[id] = share
  })

  return {
    ...node,
    children,
    layout
  }
}

function replacePanelInLayout(
  node: LayoutNode,
  panelId: string,
  replacement: LayoutNode
): LayoutNode {
  if (node.type === 'panel') {
    return node.panelId === panelId ? replacement : node
  }

  return {
    ...node,
    children: node.children.map((child) => replacePanelInLayout(child, panelId, replacement))
  }
}

export const useWorkspaceStore = create<WorkspaceStoreState>((set, get) => ({
  workspaces: {},
  pendingPanelClose: null,

  getWorkspace(serverId) {
    return get().workspaces[serverId] ?? EMPTY_WORKSPACE
  },

  openTool(serverId, toolId) {
    set((state) => {
      const workspace = state.workspaces[serverId] ?? createEmptyWorkspace()
      const existing = findPanelByTool(workspace, toolId)
      if (existing) {
        return {
          workspaces: {
            ...state.workspaces,
            [serverId]: {
              ...workspace,
              focusedPanelId: existing.id,
              root: ensurePanelVisible(workspace.root, existing.id)
            }
          }
        }
      }

      const panel: WorkspacePanel = { id: generateId(), toolId }
      const next: ServerWorkspace = {
        panels: { ...workspace.panels, [panel.id]: panel },
        root: { type: 'panel', panelId: panel.id },
        focusedPanelId: panel.id,
        tabOrder: [...workspace.tabOrder, panel.id]
      }

      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: next
        }
      }
    })
  },

  focusPanel(serverId, panelId) {
    set((state) => {
      const workspace = state.workspaces[serverId]
      if (!workspace || !workspace.panels[panelId]) return state
      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: {
            ...workspace,
            focusedPanelId: panelId,
            root: ensurePanelVisible(workspace.root, panelId)
          }
        }
      }
    })
  },

  requestClosePanel(serverId, panelId) {
    const dirty = usePanelStateStore.getState().getPanelDirty(panelId)
    if (dirty) {
      set({ pendingPanelClose: { serverId, panelId } })
      return
    }
    get().closePanel(serverId, panelId)
  },

  confirmClosePanel() {
    const pending = get().pendingPanelClose
    if (!pending) return
    set({ pendingPanelClose: null })
    usePanelStateStore.getState().clearPanelDirty(pending.panelId)
    get().closePanel(pending.serverId, pending.panelId)
  },

  cancelClosePanel() {
    set({ pendingPanelClose: null })
  },

  closePanel(serverId, panelId) {
    const workspace = get().workspaces[serverId]
    if (workspace?.panels[panelId]?.toolId === 'terminal') {
      useTerminalSessionStore.getState().closeAllForPanel(panelId, serverId)
    }

    set((state) => {
      const currentWorkspace = state.workspaces[serverId]
      if (!currentWorkspace || !currentWorkspace.panels[panelId]) return state

      usePanelStateStore.getState().clearPanelDirty(panelId)

      const { [panelId]: _removed, ...panels } = currentWorkspace.panels
      const tabOrder = currentWorkspace.tabOrder.filter((id) => id !== panelId)
      let root = removePanelFromLayout(currentWorkspace.root, panelId)
      const focusedPanelId =
        currentWorkspace.focusedPanelId === panelId
          ? tabOrder[tabOrder.length - 1] ?? null
          : currentWorkspace.focusedPanelId

      if (focusedPanelId && !isPanelInLayout(root, focusedPanelId)) {
        root = { type: 'panel', panelId: focusedPanelId }
      }

      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: { panels, root, tabOrder, focusedPanelId }
        }
      }
    })
  },

  splitPanel(serverId, panelId, direction, toolId) {
    set((state) => {
      const workspace = state.workspaces[serverId]
      if (!workspace || !workspace.panels[panelId] || !workspace.root) return state

      const newPanel: WorkspacePanel = { id: generateId(), toolId }
      const splitId = generateId()
      const replacement: LayoutNode = {
        type: 'split',
        id: splitId,
        direction,
        children: [
          { type: 'panel', panelId },
          { type: 'panel', panelId: newPanel.id }
        ],
        layout: {
          [panelId]: 50,
          [newPanel.id]: 50
        }
      }

      const root =
        workspace.root.type === 'panel' && workspace.root.panelId === panelId
          ? replacement
          : replacePanelInLayout(workspace.root, panelId, replacement)

      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: {
            panels: { ...workspace.panels, [newPanel.id]: newPanel },
            root,
            focusedPanelId: newPanel.id,
            tabOrder: [...workspace.tabOrder, newPanel.id]
          }
        }
      }
    })
  },

  setSplitLayout(serverId, splitId, layout) {
    set((state) => {
      const workspace = state.workspaces[serverId]
      if (!workspace || !workspace.root) return state

      const updateLayout = (node: LayoutNode): LayoutNode => {
        if (node.type === 'split' && node.id === splitId) {
          return { ...node, layout }
        }
        if (node.type === 'split') {
          return { ...node, children: node.children.map(updateLayout) }
        }
        return node
      }

      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: {
            ...workspace,
            root: updateLayout(workspace.root)
          }
        }
      }
    })
  },

  reorderTabs(serverId, sourcePanelId, targetPanelId) {
    if (sourcePanelId === targetPanelId) return

    set((state) => {
      const workspace = state.workspaces[serverId]
      if (!workspace) return state

      const tabOrder = [...workspace.tabOrder]
      const fromIndex = tabOrder.indexOf(sourcePanelId)
      const toIndex = tabOrder.indexOf(targetPanelId)
      if (fromIndex === -1 || toIndex === -1) return state

      tabOrder.splice(fromIndex, 1)
      tabOrder.splice(toIndex, 0, sourcePanelId)

      return {
        workspaces: {
          ...state.workspaces,
          [serverId]: { ...workspace, tabOrder }
        }
      }
    })
  }
}))
