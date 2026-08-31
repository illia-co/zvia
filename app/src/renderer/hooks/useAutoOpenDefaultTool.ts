import { useEffect } from 'react'
import type { ConnectionState, ServerId } from '@shared/server'
import { DEFAULT_TOOL } from '@renderer/lib/tools'
import { useServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'

export function autoOpenDefaultToolIfNeeded(
  serverId: ServerId | null,
  connectionState: ConnectionState
): void {
  if (!serverId || connectionState !== 'connected') return

  const workspace = useWorkspaceStore.getState().getWorkspace(serverId)
  if (workspace.root) return

  useWorkspaceStore.getState().openTool(serverId, DEFAULT_TOOL)
}

export function useAutoOpenDefaultTool(): void {
  const { serverId, connectionState } = useServerContext()

  useEffect(() => {
    autoOpenDefaultToolIfNeeded(serverId, connectionState)
  }, [serverId, connectionState])
}
