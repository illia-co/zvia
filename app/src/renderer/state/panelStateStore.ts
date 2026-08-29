import { create } from 'zustand'

export type PanelDirtyKind = 'terminal' | 'files'

export interface PanelDirtyState {
  kind: PanelDirtyKind
  sessionCount?: number
}

interface PanelStateStore {
  dirtyPanels: Record<string, PanelDirtyState>
  registerPanelDirty: (panelId: string, state: PanelDirtyState | null) => void
  getPanelDirty: (panelId: string) => PanelDirtyState | null
  clearPanelDirty: (panelId: string) => void
}

export const usePanelStateStore = create<PanelStateStore>((set, get) => ({
  dirtyPanels: {},

  registerPanelDirty(panelId, state) {
    set((current) => {
      if (!state) {
        const { [panelId]: _removed, ...dirtyPanels } = current.dirtyPanels
        return { dirtyPanels }
      }
      return {
        dirtyPanels: { ...current.dirtyPanels, [panelId]: state }
      }
    })
  },

  getPanelDirty(panelId) {
    return get().dirtyPanels[panelId] ?? null
  },

  clearPanelDirty(panelId) {
    get().registerPanelDirty(panelId, null)
  }
}))
