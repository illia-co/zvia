import { createContext, useContext, type ReactNode } from 'react'
import type { ConnectionState, ServerId, ServerProfile } from '@shared/server'
import { useConnectionState, useSelectedServer, useServerStore } from './serverStore'

export interface ServerContextValue {
  serverId: ServerId | null
  server: ServerProfile | null
  connectionState: ConnectionState
}

const ServerContext = createContext<ServerContextValue | null>(null)

export function ServerProvider({ children }: { children: ReactNode }) {
  const server = useSelectedServer()
  const serverId = useServerStore((s) => s.selectedServerId)
  const connectionState = useConnectionState(serverId)

  return (
    <ServerContext.Provider value={{ serverId, server, connectionState }}>
      {children}
    </ServerContext.Provider>
  )
}

export function useServerContext(): ServerContextValue {
  const context = useContext(ServerContext)
  if (!context) {
    throw new Error('useServerContext must be used within ServerProvider')
  }
  return context
}

export function useRequiredServerContext(): ServerContextValue & { serverId: ServerId; server: ServerProfile } {
  const context = useServerContext()
  if (!context.serverId || !context.server) {
    throw new Error('No server selected')
  }
  return { ...context, serverId: context.serverId, server: context.server }
}
