import { create } from 'zustand'
import type { ServerId } from '@shared/server'
import { generateId } from '@renderer/lib/utils'
import { disposeTerminalInstance } from '@renderer/tools/terminal/terminalInstanceRegistry'

export interface TerminalTab {
  id: string
  title: string
  ended: boolean
}

interface PanelTerminalState {
  tabs: TerminalTab[]
  activeTabId: string | null
}

const EMPTY_PANEL_STATE: PanelTerminalState = {
  tabs: [],
  activeTabId: null
}

interface TerminalSessionStore {
  panels: Record<string, PanelTerminalState>

  getPanelState: (panelId: string) => PanelTerminalState
  addTab: (panelId: string) => string
  closeTab: (panelId: string, tabId: string, serverId: ServerId) => void
  setActiveTab: (panelId: string, tabId: string) => void
  markEnded: (panelId: string, tabId: string) => void
  closeAllForPanel: (panelId: string, serverId: ServerId) => void
}

function createTab(index: number): TerminalTab {
  return {
    id: generateId(),
    title: `Terminal ${index}`,
    ended: false
  }
}

export const useTerminalSessionStore = create<TerminalSessionStore>((set, get) => ({
  panels: {},

  getPanelState(panelId) {
    return get().panels[panelId] ?? EMPTY_PANEL_STATE
  },

  addTab(panelId) {
    const tab = createTab((get().panels[panelId]?.tabs.length ?? 0) + 1)
    set((state) => {
      const current = state.panels[panelId] ?? EMPTY_PANEL_STATE
      return {
        panels: {
          ...state.panels,
          [panelId]: {
            tabs: [...current.tabs, tab],
            activeTabId: tab.id
          }
        }
      }
    })
    return tab.id
  },

  closeTab(panelId, tabId, serverId) {
    void window.relay.terminal.close({ serverId, sessionId: tabId })
    disposeTerminalInstance(serverId, tabId)

    set((state) => {
      const current = state.panels[panelId]
      if (!current) return state

      const tabs = current.tabs.filter((tab) => tab.id !== tabId)
      const activeTabId =
        current.activeTabId === tabId ? (tabs[tabs.length - 1]?.id ?? null) : current.activeTabId

      if (tabs.length === 0) {
        const { [panelId]: _removed, ...panels } = state.panels
        return { panels }
      }

      return {
        panels: {
          ...state.panels,
          [panelId]: { tabs, activeTabId }
        }
      }
    })
  },

  setActiveTab(panelId, tabId) {
    set((state) => {
      const current = state.panels[panelId]
      if (!current || !current.tabs.some((tab) => tab.id === tabId)) return state
      return {
        panels: {
          ...state.panels,
          [panelId]: { ...current, activeTabId: tabId }
        }
      }
    })
  },

  markEnded(panelId, tabId) {
    set((state) => {
      const current = state.panels[panelId]
      if (!current) return state

      return {
        panels: {
          ...state.panels,
          [panelId]: {
            ...current,
            tabs: current.tabs.map((tab) =>
              tab.id === tabId ? { ...tab, title: `${tab.title} (ended)`, ended: true } : tab
            )
          }
        }
      }
    })
  },

  closeAllForPanel(panelId, serverId) {
    const current = get().panels[panelId]
    if (!current) return

    for (const tab of current.tabs) {
      void window.relay.terminal.close({ serverId, sessionId: tab.id })
      disposeTerminalInstance(serverId, tab.id)
    }

    set((state) => {
      const { [panelId]: _removed, ...panels } = state.panels
      return { panels }
    })
  }
}))
