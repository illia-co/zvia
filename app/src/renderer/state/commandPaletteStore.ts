import { create } from 'zustand'

interface CommandPaletteStoreState {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

export const useCommandPaletteStore = create<CommandPaletteStoreState>()((set, get) => ({
  open: false,
  setOpen(open) {
    set({ open })
  },
  toggle() {
    set({ open: !get().open })
  }
}))
