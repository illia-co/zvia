import { useEffect, useState } from 'react'
import { create } from 'zustand'
import type { ServerId } from '@shared/server'
import type { ToolId } from '@renderer/lib/tools'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'

export type ToolIntent =
  | { tool: 'nginx'; configPath?: string }
  | { tool: 'ssl'; domain?: string }
  | { tool: 'services'; unit: string; view?: 'detail' | 'logs' }
  | { tool: 'ports'; port?: number }
  | { tool: 'logs'; unit: string }
  /** Reveals an absolute remote path: its directory is listed, the file is opened. */
  | { tool: 'files'; path: string }
  /**
   * `prefill` types the text into an interactive shell without a newline;
   * `command` runs it directly in a dedicated PTY session.
   */
  | { tool: 'terminal'; prefill?: string; command?: string }
  | { tool: 'users'; username?: string }
  | { tool: 'processes'; pid?: number }
  | { tool: 'packages'; packageName?: string; view?: 'installed' | 'updates' | 'search' }

function intentToToolId(intent: ToolIntent): ToolId {
  return intent.tool
}

interface NavigationStoreState {
  pendingIntents: Partial<Record<ServerId, ToolIntent>>
  openWithIntent: (serverId: ServerId, intent: ToolIntent) => void
  takeIntent: <T extends ToolIntent['tool']>(
    serverId: ServerId,
    tool: T
  ) => Extract<ToolIntent, { tool: T }> | null
}

export const useNavigationStore = create<NavigationStoreState>((set, get) => ({
  pendingIntents: {},

  openWithIntent(serverId, intent) {
    useWorkspaceStore.getState().openTool(serverId, intentToToolId(intent))
    set((state) => ({
      pendingIntents: { ...state.pendingIntents, [serverId]: intent }
    }))
  },

  takeIntent(serverId, tool) {
    const intent = get().pendingIntents[serverId]
    if (!intent || intent.tool !== tool) return null

    set((state) => {
      const next = { ...state.pendingIntents }
      delete next[serverId]
      return { pendingIntents: next }
    })

    return intent as Extract<ToolIntent, { tool: typeof tool }>
  }
}))

export function useToolIntent<T extends ToolIntent['tool']>(
  tool: T
): Extract<ToolIntent, { tool: T }> | null {
  const { serverId } = useRequiredServerContext()
  const takeIntent = useNavigationStore((state) => state.takeIntent)
  const pendingIntent = useNavigationStore((state) => state.pendingIntents[serverId])
  const [intent, setIntent] = useState<Extract<ToolIntent, { tool: T }> | null>(null)

  useEffect(() => {
    if (pendingIntent?.tool !== tool) return
    const taken = takeIntent(serverId, tool)
    if (taken) {
      setIntent(taken)
    }
  }, [pendingIntent, serverId, takeIntent, tool])

  return intent
}
