import type { BrowserWindow } from 'electron'
import type { Client, ClientChannel } from 'ssh2'
import type { TerminalDataEvent, TerminalExitEvent } from '@shared/ipc'
import { ConnectionError, ZviaError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'

interface TerminalSession {
  serverId: string
  sessionId: string
  stream: ClientChannel
}

function sessionKey(serverId: string, sessionId: string): string {
  return `${serverId}:${sessionId}`
}

export class TerminalService {
  private sessions = new Map<string, TerminalSession>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private sendData(event: TerminalDataEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('terminal:data', event)
    }
  }

  private sendExit(event: TerminalExitEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('terminal:exit', event)
    }
  }

  async open(
    serverId: string,
    sessionId: string,
    cols: number,
    rows: number,
    command?: string
  ): Promise<void> {
    const key = sessionKey(serverId, sessionId)
    if (this.sessions.has(key)) {
      return
    }

    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }

    const client = await connection.getInteractiveClient()
    const stream = command
      ? await this.spawnExec(client, command, cols, rows)
      : await this.spawnShell(client, cols, rows)

    const session: TerminalSession = { serverId, sessionId, stream }
    this.sessions.set(key, session)

    stream.on('data', (data: Buffer) => {
      this.sendData({
        serverId,
        sessionId,
        data: data.toString('base64')
      })
    })

    stream.stderr.on('data', (data: Buffer) => {
      this.sendData({
        serverId,
        sessionId,
        data: data.toString('base64')
      })
    })

    stream.on('close', (code?: number, signal?: string) => {
      this.sessions.delete(key)
      this.sendExit({
        serverId,
        sessionId,
        exitCode: code ?? 0,
        signal: signal?.toString()
      })
    })
  }

  private spawnShell(client: Client, cols: number, rows: number): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols, rows }, (error, stream) => {
        if (error) {
          reject(new ConnectionError(error.message))
          return
        }
        resolve(stream)
      })
    })
  }

  private spawnExec(
    client: Client,
    command: string,
    cols: number,
    rows: number
  ): Promise<ClientChannel> {
    return new Promise((resolve, reject) => {
      client.exec(command, { pty: { term: 'xterm-256color', cols, rows } }, (error, stream) => {
        if (error) {
          reject(new ConnectionError(error.message))
          return
        }
        resolve(stream)
      })
    })
  }

  write(serverId: string, sessionId: string, data: string): void {
    const session = this.getSession(serverId, sessionId)
    session.stream.write(data)
  }

  resize(serverId: string, sessionId: string, cols: number, rows: number): void {
    const session = this.getSession(serverId, sessionId)
    session.stream.setWindow(rows, cols, 0, 0)
  }

  close(serverId: string, sessionId: string): void {
    const key = sessionKey(serverId, sessionId)
    const session = this.sessions.get(key)
    if (!session) return
    this.sessions.delete(key)
    session.stream.end()
  }

  closeAllForServer(serverId: string): void {
    for (const [key, session] of this.sessions) {
      if (session.serverId !== serverId) continue
      this.sessions.delete(key)
      session.stream.end()
    }
  }

  private getSession(serverId: string, sessionId: string): TerminalSession {
    const session = this.sessions.get(sessionKey(serverId, sessionId))
    if (!session) {
      throw new ZviaError('NOT_FOUND', `Terminal session not found: ${sessionId}`)
    }
    return session
  }
}

export const terminalService = new TerminalService()
connectionManager.registerTeardown((serverId) => terminalService.closeAllForServer(serverId))
