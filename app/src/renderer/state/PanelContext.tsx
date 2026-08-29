import { createContext, useContext, type ReactNode } from 'react'

interface PanelContextValue {
  panelId: string
  isVisible: boolean
}

const PanelContext = createContext<PanelContextValue | null>(null)

export function PanelProvider({
  panelId,
  isVisible = true,
  children
}: {
  panelId: string
  isVisible?: boolean
  children: ReactNode
}) {
  return <PanelContext.Provider value={{ panelId, isVisible }}>{children}</PanelContext.Provider>
}

function usePanelContext(): PanelContextValue {
  const value = useContext(PanelContext)
  if (!value) {
    throw new Error('usePanelId must be used within PanelProvider')
  }
  return value
}

export function usePanelId(): string {
  return usePanelContext().panelId
}

export function usePanelVisibility(): boolean {
  return usePanelContext().isVisible
}

export function useOptionalPanelId(): string | null {
  return useContext(PanelContext)?.panelId ?? null
}
