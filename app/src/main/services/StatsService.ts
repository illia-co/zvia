import type { BrowserWindow } from 'electron'
import type { StatsSubscriptionMode, StatsUpdatePayload, SystemInfo } from '@shared/stats'
import type { ServerId } from '@shared/server'
import { ConnectionError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import type { CommandRunner } from './CommandRunner'
import { commandRunnerFor } from './ServiceBase'
import {
  buildStatsSnapshot,
  LinuxStatsService,
  type RawStatsSample
} from './LinuxStatsService'
import { SystemInfoService } from './SystemInfoService'

const INTERVAL_MS: Record<StatsSubscriptionMode, number> = {
  stats: 2000,
  overview: 5000
}

interface Subscriber {
  subscriberId: string
  mode: StatsSubscriptionMode
}

interface ServerSubscriptionState {
  subscribers: Map<string, Subscriber>
  timer: NodeJS.Timeout | null
  intervalMs: number
  info: SystemInfo | null
  previousRaw: RawStatsSample | null
  isPolling: boolean
}

function createRunner(serverId: ServerId): CommandRunner {
  return {
    exec(command, timeoutMs) {
      return connectionManager.exec(serverId, command, timeoutMs)
    }
  }
}

export class StatsService {
  private servers = new Map<ServerId, ServerSubscriptionState>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  async getInfo(serverId: ServerId): Promise<SystemInfo> {
    this.ensureConnected(serverId)
    const state = this.getOrCreateState(serverId)
    if (state.info) return state.info

    const info = await new SystemInfoService(createRunner(serverId)).getInfo()
    state.info = info
    return info
  }

  subscribe(serverId: ServerId, subscriberId: string, mode: StatsSubscriptionMode): void {
    this.ensureConnected(serverId)
    const state = this.getOrCreateState(serverId)
    state.subscribers.set(subscriberId, { subscriberId, mode })
    this.reschedule(serverId)
    void this.poll(serverId)
  }

  unsubscribe(serverId: ServerId, subscriberId: string): void {
    const state = this.servers.get(serverId)
    if (!state) return

    state.subscribers.delete(subscriberId)
    if (state.subscribers.size === 0) {
      this.clearServer(serverId)
      return
    }

    this.reschedule(serverId)
  }

  clearServer(serverId: ServerId): void {
    const state = this.servers.get(serverId)
    if (!state) return

    if (state.timer) {
      clearInterval(state.timer)
    }
    this.servers.delete(serverId)
  }

  private ensureConnected(serverId: ServerId): void {
    const connectionState = connectionManager.getState(serverId)
    if (connectionState !== 'connected') {
      throw new ConnectionError('Server is not connected')
    }
  }

  private getOrCreateState(serverId: ServerId): ServerSubscriptionState {
    const existing = this.servers.get(serverId)
    if (existing) return existing

    const state: ServerSubscriptionState = {
      subscribers: new Map(),
      timer: null,
      intervalMs: INTERVAL_MS.overview,
      info: null,
      previousRaw: null,
      isPolling: false
    }
    this.servers.set(serverId, state)
    return state
  }

  private getDesiredInterval(state: ServerSubscriptionState): number {
    let interval = INTERVAL_MS.overview
    for (const subscriber of state.subscribers.values()) {
      interval = Math.min(interval, INTERVAL_MS[subscriber.mode])
    }
    return interval
  }

  private reschedule(serverId: ServerId): void {
    const state = this.servers.get(serverId)
    if (!state || state.subscribers.size === 0) return

    const nextInterval = this.getDesiredInterval(state)
    if (nextInterval === state.intervalMs && state.timer) return

    if (state.timer) {
      clearInterval(state.timer)
    }

    state.intervalMs = nextInterval
    state.timer = setInterval(() => {
      void this.poll(serverId)
    }, nextInterval)
  }

  private async poll(serverId: ServerId): Promise<void> {
    const state = this.servers.get(serverId)
    if (!state || state.subscribers.size === 0 || state.isPolling) return

    if (connectionManager.getState(serverId) !== 'connected') {
      this.clearServer(serverId)
      return
    }

    state.isPolling = true
    try {
      const runner = createRunner(serverId)
      if (!state.info) {
        state.info = await new SystemInfoService(runner).getInfo()
      }

      const raw = await new LinuxStatsService(runner).collectRawSample()
      if (state.info) {
        state.info = { ...state.info, uptimeSeconds: raw.uptimeSeconds }
      }
      const stats = buildStatsSnapshot(raw, state.previousRaw)
      state.previousRaw = raw

      this.emitUpdate(serverId, {
        info: state.info,
        stats
      })
    } catch {
      // Transient polling failures are ignored; the next interval will retry.
    } finally {
      state.isPolling = false
    }
  }

  private emitUpdate(serverId: ServerId, payload: StatsUpdatePayload): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send('stats:update', {
      serverId,
      ...payload
    })
  }
}

export const statsService = new StatsService()
connectionManager.registerTeardown((serverId) => statsService.clearServer(serverId))
