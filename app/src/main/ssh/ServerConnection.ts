import { EventEmitter } from 'node:events'
import { Client, type ConnectConfig, type HostVerifier, type SFTPWrapper } from 'ssh2'
import type { BrowserWindow } from 'electron'
import type { ConnectionState, ConnectionStateEvent, HostKeyPrompt, PassphrasePrompt, ServerProfile } from '@shared/server'
import type { ExecResult } from '@shared/ipc'
import { AuthenticationError, ConnectionError, PassphraseRequiredError, SFTPError } from '@shared/errors'
import { buildConnectConfig } from './auth'
import { isAuthFailureMessage } from './authErrors'
import { execOnClient } from './exec'
import { createHostVerifier } from './hostVerifier'
import type { CommandRunner } from '../services/CommandRunner'

const KEEPALIVE_INTERVAL = 15000
const MAX_RECONNECT_ATTEMPTS = 8
const BASE_RECONNECT_DELAY_MS = 1000
const MAX_RECONNECT_DELAY_MS = 30000
const MAX_PASSPHRASE_ATTEMPTS = 2

type PendingHostKey = {
  resolve: (accept: boolean) => void
  reject: (error: Error) => void
}

type PendingPassphrase = {
  resolve: (passphrase: string | null) => void
  reject: (error: Error) => void
}

export type PassphrasePromptHandler = (prompt: PassphrasePrompt) => Promise<string | null>

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
  private pendingPassphrase: PendingPassphrase | null = null
  private passphrasePrompter: PassphrasePromptHandler | null = null
  private interactiveConnecting: Promise<Client> | null = null
  /** Memory-only session passphrase from the modal. Cleared on disconnect. */
  private sessionPassphrase: string | null = null

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

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  setPassphrasePrompter(handler: PassphrasePromptHandler): void {
    this.passphrasePrompter = handler
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
    return createHostVerifier(
      this.serverId,
      this.profile.hostname,
      this.profile.port,
      (prompt) => this.promptHostKey(prompt)
    )
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

  private promptPassphrase(keyLabel: string): Promise<string | null> {
    if (this.passphrasePrompter) {
      return this.passphrasePrompter({
        serverId: this.serverId,
        hostname: this.profile.hostname,
        keyLabel
      })
    }
    return new Promise((resolve, reject) => {
      this.pendingPassphrase = { resolve, reject }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('connection:passphrasePrompt', {
          serverId: this.serverId,
          hostname: this.profile.hostname,
          keyLabel
        } satisfies PassphrasePrompt)
      } else {
        this.pendingPassphrase = null
        reject(new ConnectionError('Unable to prompt for passphrase: no window available'))
      }
    })
  }

  respondToPassphrase(passphrase: string | null): void {
    if (!this.pendingPassphrase) return
    const pending = this.pendingPassphrase
    this.pendingPassphrase = null
    pending.resolve(passphrase)
  }

  cancelPassphrasePrompt(reason: string): void {
    if (!this.pendingPassphrase) return
    const pending = this.pendingPassphrase
    this.pendingPassphrase = null
    pending.reject(new ConnectionError(reason))
  }

  private async buildConfigWithPassphraseRetry(
    explicitPassphrase?: string
  ): Promise<{ config: ConnectConfig; promptedPassphrase: string | null }> {
    let promptedPassphrase: string | null = explicitPassphrase ?? this.sessionPassphrase
    try {
      const config = await buildConnectConfig(
        this.profile,
        promptedPassphrase ? { passphrase: promptedPassphrase } : undefined
      )
      return { config, promptedPassphrase }
    } catch (error) {
      if (!(error instanceof PassphraseRequiredError)) throw error
      const supplied = await this.promptPassphrase(error.keyLabel)
      if (!supplied) {
        throw new AuthenticationError(`Passphrase required for ${error.keyLabel}`)
      }
      promptedPassphrase = supplied
      const config = await buildConnectConfig(this.profile, { passphrase: supplied })
      return { config, promptedPassphrase }
    }
  }

  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return
    }

    this.intentionalDisconnect = false
    this.clearReconnectTimer()
    this.setState('connecting')

    let client: Client | null = null
    try {
      let attempt = await this.buildConfigWithPassphraseRetry()
      let passphraseAttempts = attempt.promptedPassphrase ? 1 : 0
      client = this.createClient()
      try {
        await this.connectClient(client, attempt.config)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Connection failed'
        if (!isAuthFailureMessage(message) || passphraseAttempts >= MAX_PASSPHRASE_ATTEMPTS) {
          throw error
        }
        const keyLabel =
          this.profile.auth.type === 'key-file' ? this.profile.auth.privateKeyPath : 'SSH key'
        const supplied = await this.promptPassphrase(keyLabel)
        if (!supplied) {
          throw new AuthenticationError('Passphrase required to unlock the private key')
        }
        passphraseAttempts += 1
        attempt = {
          config: await buildConnectConfig(this.profile, { passphrase: supplied }),
          promptedPassphrase: supplied
        }
        client.removeAllListeners()
        try {
          client.end()
        } catch {
          // Dead client; replaced below.
        }
        client = this.createClient()
        await this.connectClient(client, attempt.config)
      }
      if (this.intentionalDisconnect) {
        client.removeAllListeners()
        try {
          client.end()
        } catch {
          // Dismissed while connecting; nothing to keep.
        }
        this.setState('disconnected')
        return
      }
      this.controlClient = client
      // Keep a memory-only copy for the interactive/PTY client so the user
      // is asked once per session. Cleared on disconnect; never persisted.
      this.sessionPassphrase = attempt.promptedPassphrase
      this.reconnectAttempts = 0
      this.setState('connected')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed'
      // Neutralize the failed client: its late `close`/`error` events must not
      // trigger handleConnectionLoss, which previously started a phantom
      // reconnect loop after every failed initial connect.
      if (client) {
        client.removeAllListeners()
        try {
          client.end()
        } catch {
          // Client already dead; state below is authoritative.
        }
      }
      this.clearReconnectTimer()
      if (error instanceof AuthenticationError) {
        this.setState('error', message)
        throw error
      }
      if (isAuthFailureMessage(message)) {
        this.setState('error', message)
        throw new AuthenticationError('SSH authentication failed', message)
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
    this.cancelPassphrasePrompt('Disconnected during passphrase prompt')
    await this.closeClients()
    this.sessionPassphrase = null
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
    // Auto-reconnect only applies to drops of a live connection. Failures
    // while connecting (or an already-terminal error) stay on the error
    // banner until the user retries or dismisses — no phantom retries.
    if (this.state !== 'connected') {
      this.clearReconnectTimer()
      if (this.state !== 'reconnecting') this.setState('error', reason)
      return
    }
    this.emit('connectionLost')
    void this.closeClients()
    this.scheduleReconnect(reason)
  }

  private scheduleReconnect(reason: string): void {
    this.clearReconnectTimer()
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

  async getInteractiveClient(): Promise<Client> {
    if (this.interactiveClient) {
      return this.interactiveClient
    }
    if (this.interactiveConnecting) {
      return this.interactiveConnecting
    }

    this.interactiveConnecting = (async () => {
      const { config } = await this.buildConfigWithPassphraseRetry(this.sessionPassphrase ?? undefined)
      const client = this.createClient()
      try {
        await this.connectClient(client, config)
      } catch (error) {
        client.removeAllListeners()
        try {
          client.end()
        } catch {
          // Dead client; error below is authoritative.
        }
        throw error
      }
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
    const client = this.getControlClient()
    return execOnClient(client, command, timeoutMs)
  }

  async getSftp(): Promise<SFTPWrapper> {
    if (this.sftpClient) {
      return this.sftpClient
    }
    const client = this.getControlClient()
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
