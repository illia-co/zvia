import type { BrowserWindow } from 'electron'
import type { ServerProfile, ConnectionState } from '@shared/server'
import type { ConnectionTestRequest, ExecResult } from '@shared/ipc'
import { ConnectionError, ZviaError } from '@shared/errors'
import { ServerConnection } from './ServerConnection'
import { runTestConnection } from './testConnection'
import { profileStore } from '../store/profiles'

type TeardownHook = (serverId: string) => void | Promise<void>

export class ConnectionManager {
  private connections = new Map<string, ServerConnection>()
  private mainWindow: BrowserWindow | null = null
  private teardownHooks: TeardownHook[] = []
  private pendingTestHostKey: {
    serverId: string
    resolve: (accepted: boolean) => void
    reject: (error: Error) => void
  } | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  registerTeardown(hook: TeardownHook): void {
    this.teardownHooks.push(hook)
  }

  private async runTeardown(serverId: string): Promise<void> {
    await Promise.allSettled(this.teardownHooks.map((hook) => hook(serverId)))
  }

  private getOrCreate(profile: ServerProfile): ServerConnection {
    const existing = this.connections.get(profile.id)
    if (existing) {
      existing.updateProfile(profile)
      return existing
    }
    const connection = new ServerConnection(profile, this.mainWindow)
    connection.on('connectionLost', () => {
      void this.runTeardown(profile.id)
    })
    this.connections.set(profile.id, connection)
    return connection
  }

  async connect(serverId: string): Promise<void> {
    const profile = profileStore.get(serverId)
    const connection = this.getOrCreate(profile)
    await connection.connect()
  }

  async testConnection(request: ConnectionTestRequest): Promise<void> {
    const serverId = request.serverId ?? `test-${Date.now()}`
    const testRequest: ConnectionTestRequest = { ...request, serverId }

    try {
      await runTestConnection(testRequest, (prompt) => this.promptTestHostKey(prompt))
    } finally {
      this.pendingTestHostKey = null
    }
  }

  private promptTestHostKey(
    prompt: import('@shared/server').HostKeyPrompt
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pendingTestHostKey = {
        serverId: prompt.serverId,
        resolve,
        reject
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('connection:hostKeyPrompt', prompt)
      } else {
        this.pendingTestHostKey = null
        reject(new ConnectionError('Unable to prompt for host key: no window available'))
      }
    })
  }

  async disconnect(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId)
    if (!connection) return
    await this.runTeardown(serverId)
    await connection.disconnect()
    this.connections.delete(serverId)
  }

  getState(serverId: string): ConnectionState {
    return this.connections.get(serverId)?.getState() ?? 'disconnected'
  }

  respondToHostKey(serverId: string, decision: 'accept' | 'reject'): void {
    if (this.pendingTestHostKey?.serverId === serverId) {
      const pending = this.pendingTestHostKey
      this.pendingTestHostKey = null
      if (decision === 'accept') {
        pending.resolve(true)
      } else {
        pending.reject(new ConnectionError('Host key rejected by user'))
      }
      return
    }

    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new ZviaError('NOT_FOUND', `No active connection for server: ${serverId}`)
    }
    connection.respondToHostKey(decision)
  }

  async exec(serverId: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new ZviaError('CONNECTION_ERROR', `Server is not connected: ${serverId}`)
    }
    return connection.exec(command, timeoutMs)
  }

  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId)
  }
}

export const connectionManager = new ConnectionManager()
