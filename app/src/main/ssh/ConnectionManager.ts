import type { BrowserWindow } from 'electron'
import type { ServerProfile, ConnectionState } from '@shared/server'
import type { ConnectionTestRequest, ExecResult } from '@shared/ipc'
import { ConnectionError, ZviaError } from '@shared/errors'
import { ServerConnection } from './ServerConnection'
import { runTestConnection } from './testConnection'
import { profileStore } from '../store/profiles'
import { terminalService } from '../services/TerminalService'
import { statsService } from '../services/StatsService'
import { logService } from '../services/LogService'
import { dockerService } from '../services/DockerService'
import { nginxService } from '../services/NginxService'
import { sslService } from '../services/SSLService'
import { portService } from '../services/PortService'
import { privilegeService } from '../services/PrivilegeService'
import { userService } from '../services/UserService'
import { processService } from '../services/ProcessService'
import { packageService } from '../services/PackageService'
import { clearCache as clearLinuxOsCache } from '../services/linuxOs'

export class ConnectionManager {
  private connections = new Map<string, ServerConnection>()
  private mainWindow: BrowserWindow | null = null
  private pendingTestHostKey: {
    serverId: string
    resolve: (accepted: boolean) => void
    reject: (error: Error) => void
  } | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getOrCreate(profile: ServerProfile): ServerConnection {
    const existing = this.connections.get(profile.id)
    if (existing) {
      existing.updateProfile(profile)
      return existing
    }
    const connection = new ServerConnection(profile, this.mainWindow)
    connection.on('connectionLost', () => {
      terminalService.closeAllForServer(profile.id)
      logService.stopAllForServer(profile.id)
      statsService.clearServer(profile.id)
      dockerService.stopAllLogsForServer(profile.id)
      nginxService.stopAllLogsForServer(profile.id)
      sslService.stopAllForServer(profile.id)
      portService.clearServer(profile.id)
      userService.clearServer(profile.id)
      processService.clearServer(profile.id)
      packageService.clearServer(profile.id)
      clearLinuxOsCache(profile.id)
      privilegeService.clearCache(profile.id)
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
    terminalService.closeAllForServer(serverId)
    logService.stopAllForServer(serverId)
    statsService.clearServer(serverId)
    dockerService.stopAllLogsForServer(serverId)
    nginxService.stopAllLogsForServer(serverId)
    sslService.stopAllForServer(serverId)
    portService.clearServer(serverId)
    userService.clearServer(serverId)
    processService.clearServer(serverId)
    packageService.clearServer(serverId)
    clearLinuxOsCache(serverId)
    privilegeService.clearCache(serverId)
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
