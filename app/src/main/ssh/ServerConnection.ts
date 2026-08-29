import { EventEmitter } from 'node:events'
import { Client, type ConnectConfig, type HostVerifier, type SFTPWrapper } from 'ssh2'
import type { BrowserWindow } from 'electron'
import type { ConnectionState, ConnectionStateEvent, HostKeyPrompt, ServerProfile } from '@shared/server'
import type { ExecResult } from '@shared/ipc'
import { AuthenticationError, ConnectionError, SFTPError } from '@shared/errors'
import { buildConnectConfig } from './auth'
import { execOnClient } from './exec'
import { fingerprintFromKey, hostKeyStore } from './hostKeys'
import type { CommandRunner } from '../services/CommandRunner'

const KEEPALIVE_INTERVAL = 15000
const MAX_RECONNECT_ATTEMPTS = 8
const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000

type PendingHostKey = {
  resolve: (accept: boolean) => void
  reject: (error: Error) => void
}

export class ServerConnection extends EventEmitter implements CommandRunner {
  readonly serverId: string
  private profile: ServerProfile
  private mainWindow: BrowserWindow | null
  private controlClient: Client | null = null
  private interactiveClient: Client | null = null
  private sftpClient: SFTPWrapper | null = null
  private state: ConnectionState = 'disconnected'
  private reconnectAttempts = 0
  private reconnectTimer: NodeJS.Timeout | null = null
  private intentionalDisconnect = false
  private pendingHostKey: PendingHostKey | null = null
  private interactiveConnecting: Promise<Client> | null = null

  constructor(profile: ServerProfile, mainWindow: BrowserWindow | null) {
    super()
    this.serverId = profile.id
    this.profile = profile
    this.mainWindow = mainWindow
  }

  getState(): ConnectionState {
    return this.state
  }

  updateProfile(profile: ServerProfile): void {
    this.profile = profile
  }

  private setState(state: ConnectionState, error?: string): void {
    this.state = state
    const event: ConnectionStateEvent = { serverId: this.serverId, state, error }
    this.emit('stateChanged', event)
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('connection:stateChanged', event)
    }
  }

  private createClient(): Client {
    const client = new Client()
    client.on('error', (error) => {
      if (this.intentionalDisconnect) return
      this.handleConnectionLoss(error.message)
    })
    client.on('close', () => {
      if (this.intentionalDisconnect) return
      if (client === this.controlClient) {
        this.controlClient = null
        this.sftpClient = null
      }
      if (client === this.interactiveClient) {
        this.interactiveClient = null
      }
      this.handleConnectionLoss('SSH connection closed')
    })
    return client
  }

  private buildHostVerifier(): HostVerifier {
    return (key: Buffer, callback) => {
      void (async () => {
        try {
          const { fingerprint, keyType } = fingerprintFromKey(key)
          const stored = hostKeyStore.getSync(this.profile.hostname, this.profile.port)

          if (stored && stored.fingerprint === fingerprint) {
            callback(true)
            return
          }

          const prompt: HostKeyPrompt = {
            serverId: this.serverId,
            hostname: this.profile.hostname,
            port: this.profile.port,
            keyType: stored?.keyType ?? keyType,
            fingerprint,
            isChanged: Boolean(stored && stored.fingerprint !== fingerprint)
          }

          const accepted = await this.promptHostKey(prompt)
          if (!accepted) {
            callback(false)
            return
          }

          await hostKeyStore.save(this.profile.hostname, this.profile.port, key)
          callback(true)
        } catch {
          callback(false)
        }
      })()
    }
  }

  private connectClient(client: Client, connectConfig: ConnectConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      client.once('ready', () => resolve())
      client.once('error', (error) => reject(error))
      client.connect({
        ...connectConfig,
        keepaliveInterval: KEEPALIVE_INTERVAL,
        hostVerifier: this.buildHostVerifier()
      })
    })
  }

  private promptHostKey(prompt: HostKeyPrompt): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.pendingHostKey = {
        resolve,
        reject
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('connection:hostKeyPrompt', prompt)
      } else {
        reject(new ConnectionError('Unable to prompt for host key: no window available'))
      }
    })
  }

  respondToHostKey(decision: 'accept' | 'reject'): void {
    if (!this.pendingHostKey) return
    const pending = this.pendingHostKey
    this.pendingHostKey = null
    if (decision === 'accept') {
      pending.resolve(true)
    } else {
      pending.reject(new ConnectionError('Host key rejected by user'))
    }
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }

    this.intentionalDisconnect = false
    this.clearReconnectTimer()
    this.setState('connecting')

    try {
      const connectConfig = await buildConnectConfig(this.profile)
      const client = this.createClient()
      await this.connectClient(client, connectConfig)
      this.controlClient = client
      this.reconnectAttempts = 0
      this.setState('connected')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      if (error instanceof AuthenticationError) {
        this.setState('error', message)
        throw error
      }
      this.setState('error', message)
      throw error instanceof ConnectionError ? error : new ConnectionError(message)
    }
  }

  async disconnect(): Promise<void> {
    this.intentionalDisconnect = true
    this.clearReconnectTimer()
    if (this.pendingHostKey) {
      this.pendingHostKey.reject(new ConnectionError('Disconnected during host key verification'))
      this.pendingHostKey = null
    }
    await this.closeClients()
    this.setState('disconnected')
  }

  private async closeClients(): Promise<void> {
    const clients = [this.controlClient, this.interactiveClient].filter(Boolean) as Client[]
    this.controlClient = null
    this.interactiveClient = null
    this.sftpClient = null
    this.interactiveConnecting = null
    await Promise.all(
      clients.map(
        (client) =>
          new Promise<void>((resolve) => {
            client.once('close', () => resolve())
            client.end()
            setTimeout(resolve, 2000)
          })
      )
    )
  }

  private handleConnectionLoss(reason: string): void {
    if (this.intentionalDisconnect) return
    if (this.state === 'disconnected') return
    this.emit('connectionLost')
    void this.closeClients()
    this.scheduleReconnect(reason)
  }

  private scheduleReconnect(reason: string): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setState('error', `Reconnect failed: ${reason}`)
      return
    }

    this.setState('reconnecting')
    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY_MS
    )
    this.reconnectAttempts += 1
    this.reconnectTimer = setTimeout(() => {
      void this.connect().catch(() => {
        this.scheduleReconnect(reason)
      })
    }, delay)
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  getControlClient(): Client {
    if (!this.controlClient || this.state !== 'connected') {
      throw new ConnectionError('Server is not connected')
    }
    return this.controlClient
  }

  private ensureControlClient(): Client {
    return this.getControlClient()
  }

  async getInteractiveClient(): Promise<Client> {
    if (this.interactiveClient) {
      return this.interactiveClient
    }
    if (this.interactiveConnecting) {
      return this.interactiveConnecting
    }

    this.interactiveConnecting = (async () => {
      const connectConfig = await buildConnectConfig(this.profile)
      const client = this.createClient()
      await this.connectClient(client, connectConfig)
      this.interactiveClient = client
      return client
    })()

    try {
      return await this.interactiveConnecting
    } finally {
      this.interactiveConnecting = null
    }
  }

  async exec(command: string, timeoutMs?: number): Promise<ExecResult> {
    const client = this.ensureControlClient()
    return execOnClient(client, command, timeoutMs)
  }

  async getSftp(): Promise<SFTPWrapper> {
    if (this.sftpClient) {
      return this.sftpClient
    }
    const client = this.ensureControlClient()
    return new Promise((resolve, reject) => {
      client.sftp((error, sftp) => {
        if (error) {
          reject(new SFTPError(error.message))
          return
        }
        this.sftpClient = sftp
        resolve(sftp)
      })
    })
  }
}
