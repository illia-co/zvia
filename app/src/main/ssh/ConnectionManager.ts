import type { BrowserWindow } from 'electron'
import type { ServerProfile, ConnectionState } from '@shared/server'
import type { ExecResult } from '@shared/ipc'
import { RelayError } from '@shared/errors'
import { ServerConnection } from './ServerConnection'
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
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new RelayError('NOT_FOUND', `No active connection for server: ${serverId}`)
    }
    connection.respondToHostKey(decision)
  }

  async exec(serverId: string, command: string, timeoutMs?: number): Promise<ExecResult> {
    const connection = this.connections.get(serverId)
    if (!connection) {
      throw new RelayError('CONNECTION_ERROR', `Server is not connected: ${serverId}`)
    }
    return connection.exec(command, timeoutMs)
  }

  getConnection(serverId: string): ServerConnection | undefined {
    return this.connections.get(serverId)
  }
}

export const connectionManager = new ConnectionManager()
