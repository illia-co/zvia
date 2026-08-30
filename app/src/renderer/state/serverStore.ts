import { create } from 'zustand'
import type { ConnectionTestRequest, ProfileCreateRequest, ProfileUpdateRequest } from '@shared/ipc'
import type { ZviaErrorPayload } from '@shared/errors'
import type {
  ConnectionState,
  HostKeyPrompt,
  ServerId,
  ServerProfile
} from '@shared/server'
import { humanizeError, parseZviaError } from '@renderer/lib/errors'

interface ServerStoreState {
  profiles: ServerProfile[]
  selectedServerId: ServerId | null
  connectionStates: Record<ServerId, ConnectionState>
  connectionErrors: Record<ServerId, ZviaErrorPayload | undefined>
  hostKeyPrompt: HostKeyPrompt | null
  isLoadingProfiles: boolean
  actionError: ZviaErrorPayload | null

  loadProfiles: () => Promise<void>
  selectServer: (serverId: ServerId) => void
  connect: (serverId: ServerId) => Promise<void>
  disconnect: (serverId: ServerId) => Promise<void>
  createProfile: (request: ProfileCreateRequest) => Promise<ServerProfile>
  updateProfile: (request: ProfileUpdateRequest) => Promise<ServerProfile>
  testConnection: (request: ConnectionTestRequest) => Promise<void>
  removeProfile: (serverId: ServerId) => Promise<void>
  respondToHostKey: (decision: 'accept' | 'reject') => Promise<void>
  clearActionError: () => void
  initialize: () => () => void
}

function getConnectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Connected'
    case 'connecting':
      return 'Connecting'
    case 'reconnecting':
      return 'Reconnecting'
    case 'error':
      return 'Error'
    default:
      return 'Disconnected'
  }
}

export { getConnectionLabel }

export const useServerStore = create<ServerStoreState>((set, get) => ({
  profiles: [],
  selectedServerId: null,
  connectionStates: {},
  connectionErrors: {},
  hostKeyPrompt: null,
  isLoadingProfiles: false,
  actionError: null,

  async loadProfiles() {
    set({ isLoadingProfiles: true, actionError: null })
    try {
      const profiles = await window.zvia.invoke('profiles:list')
      const states: Record<ServerId, ConnectionState> = {}
      await Promise.all(
        profiles.map(async (profile) => {
          states[profile.id] = await window.zvia.invoke('connection:getState', {
            serverId: profile.id
          })
        })
      )
      set((state) => ({
        profiles,
        connectionStates: { ...state.connectionStates, ...states },
        selectedServerId:
          state.selectedServerId && profiles.some((p) => p.id === state.selectedServerId)
            ? state.selectedServerId
            : profiles[0]?.id ?? null,
        isLoadingProfiles: false
      }))
    } catch (error) {
      set({ isLoadingProfiles: false, actionError: parseZviaError(error) })
    }
  },

  selectServer(serverId) {
    set({ selectedServerId: serverId, actionError: null })
  },

  async connect(serverId) {
    set((state) => ({
      connectionStates: { ...state.connectionStates, [serverId]: 'connecting' },
      connectionErrors: { ...state.connectionErrors, [serverId]: undefined },
      actionError: null
    }))
    try {
      await window.zvia.invoke('connection:connect', { serverId })
    } catch (error) {
      const parsed = parseZviaError(error)
      set((state) => ({
        connectionStates: { ...state.connectionStates, [serverId]: 'error' },
        connectionErrors: { ...state.connectionErrors, [serverId]: parsed },
        actionError: parsed
      }))
    }
  },

  async disconnect(serverId) {
    try {
      await window.zvia.invoke('connection:disconnect', { serverId })
    } catch (error) {
      set({ actionError: parseZviaError(error) })
    }
  },

  async createProfile(request) {
    set({ actionError: null })
    try {
      const profile = await window.zvia.invoke('profiles:create', request)
      set((state) => ({
        profiles: [...state.profiles, profile],
        connectionStates: { ...state.connectionStates, [profile.id]: 'disconnected' },
        selectedServerId: profile.id
      }))
      return profile
    } catch (error) {
      const parsed = parseZviaError(error)
      set({ actionError: parsed })
      throw parsed
    }
  },

  async updateProfile(request) {
    set({ actionError: null })
    const connectionState = get().connectionStates[request.id]
    if (
      connectionState === 'connected' ||
      connectionState === 'connecting' ||
      connectionState === 'reconnecting'
    ) {
      await get().disconnect(request.id)
    }
    try {
      const profile = await window.zvia.invoke('profiles:update', request)
      set((state) => ({
        profiles: state.profiles.map((item) => (item.id === profile.id ? profile : item))
      }))
      return profile
    } catch (error) {
      const parsed = parseZviaError(error)
      set({ actionError: parsed })
      throw parsed
    }
  },

  async testConnection(request) {
    await window.zvia.invoke('connection:test', request)
  },

  async removeProfile(serverId) {
    set({ actionError: null })
    try {
      await window.zvia.invoke('profiles:remove', { id: serverId })
      set((state) => {
        const profiles = state.profiles.filter((p) => p.id !== serverId)
        const { [serverId]: _removedState, ...connectionStates } = state.connectionStates
        const { [serverId]: _removedError, ...connectionErrors } = state.connectionErrors
        return {
          profiles,
          connectionStates,
          connectionErrors,
          selectedServerId:
            state.selectedServerId === serverId ? profiles[0]?.id ?? null : state.selectedServerId
        }
      })
    } catch (error) {
      set({ actionError: parseZviaError(error) })
    }
  },

  async respondToHostKey(decision) {
    const prompt = get().hostKeyPrompt
    if (!prompt) return
    set({ actionError: null })
    try {
      await window.zvia.invoke('connection:hostKeyResponse', {
        serverId: prompt.serverId,
        decision
      })
      set({ hostKeyPrompt: null })
    } catch (error) {
      set({ actionError: parseZviaError(error) })
    }
  },

  clearActionError() {
    set({ actionError: null })
  },

  initialize() {
    void get().loadProfiles()

    const unsubscribeState = window.zvia.on('connection:stateChanged', (event) => {
      set((state) => ({
        connectionStates: { ...state.connectionStates, [event.serverId]: event.state },
        connectionErrors: event.error
          ? {
              ...state.connectionErrors,
              [event.serverId]: {
                code: 'CONNECTION_ERROR',
                message: humanizeError({
                  code: 'CONNECTION_ERROR',
                  message: event.error
                }),
                details: event.error
              }
            }
          : state.connectionErrors
      }))
    })

    const unsubscribeHostKey = window.zvia.on('connection:hostKeyPrompt', (prompt) => {
      set({ hostKeyPrompt: prompt })
    })

    return () => {
      unsubscribeState()
      unsubscribeHostKey()
    }
  }
}))

export function useSelectedServer(): ServerProfile | null {
  const profiles = useServerStore((s) => s.profiles)
  const selectedServerId = useServerStore((s) => s.selectedServerId)
  return profiles.find((p) => p.id === selectedServerId) ?? null
}

export function useConnectionState(serverId: ServerId | null): ConnectionState {
  return useServerStore((s) =>
    serverId ? s.connectionStates[serverId] ?? 'disconnected' : 'disconnected'
  )
}
