import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemePreference = 'system' | 'light' | 'dark'

interface ThemeStoreState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
  cyclePreference: () => void
}

function resolveIsDark(preference: ThemePreference): boolean {
  if (preference === 'dark') return true
  if (preference === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemePreference(preference: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveIsDark(preference))
}

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => ({
      preference: 'system',
      setPreference(preference) {
        applyThemePreference(preference)
        set({ preference })
      },
      cyclePreference() {
        const order: ThemePreference[] = ['system', 'light', 'dark']
        const current = get().preference
        const next = order[(order.indexOf(current) + 1) % order.length] ?? 'system'
        get().setPreference(next)
      }
    }),
    {
      name: 'relay-theme',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyThemePreference(state.preference)
        }
      }
    }
  )
)

let systemListenerAttached = false

export function initializeTheme(): void {
  applyThemePreference(useThemeStore.getState().preference)

  if (systemListenerAttached) return
  systemListenerAttached = true

  const media = window.matchMedia('(prefers-color-scheme: dark)')
  media.addEventListener('change', () => {
    if (useThemeStore.getState().preference === 'system') {
      applyThemePreference('system')
    }
  })
}
