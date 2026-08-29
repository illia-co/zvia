import type { BrowserWindow } from 'electron'
import type { ClientChannel } from 'ssh2'
import type { LogEntry, LogsEntriesEvent, LogsQuery, LogsStatusEvent } from '@shared/logs'
import { DEFAULT_LOGS_QUERY, mapTimeRangeToSince, normalizeLogsQuery } from '@shared/logQuery'
import { ConnectionError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'

const BUFFER_CAPACITY = 5000
const BATCH_INTERVAL_MS = 100

const PRIORITY_NAMES: Record<number, string> = {
  0: 'emerg',
  1: 'alert',
  2: 'crit',
  3: 'err',
  4: 'warning',
  5: 'notice',
  6: 'info',
  7: 'debug'
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_@%+=:,./-]+$/.test(value)) {
    return value
  }
  return `'${value.replace(/'/g, `'\\''`)}'`
}

export function buildJournalctlCommand(query: LogsQuery): string {
  const parts = ['journalctl', '-o', 'json', '--no-pager', '-n', String(query.lines)]

  if (query.mode === 'live') {
    parts.splice(1, 0, '-f')
  }

  const since = mapTimeRangeToSince(query.timeRange)
  if (since) {
    parts.push('--since', shellQuote(since))
  }
  if (query.priority !== undefined) {
    parts.push('-p', shellQuote(String(query.priority)))
  }
  if (query.unit) {
    parts.push('-u', shellQuote(query.unit))
  }

  return parts.join(' ')
}

class RingBuffer<T> {
  private items: T[] = []

  constructor(private readonly capacity: number) {}

  push(item: T): void {
    if (this.items.length >= this.capacity) {
      this.items.shift()
    }
    this.items.push(item)
  }

  toArray(): T[] {
    return [...this.items]
  }

  clear(): void {
    this.items = []
  }
}

interface ServerLogSession {
  serverId: string
  query: LogsQuery
  buffer: RingBuffer<LogEntry>
  stream: ClientChannel | null
  lineRemainder: string
  pendingEntries: LogEntry[]
  batchTimer: NodeJS.Timeout | null
  nextEntryId: number
  status: LogsStatusEvent['status']
}

function parseJournalLine(line: string, nextId: () => string): LogEntry | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  try {
    const record = JSON.parse(trimmed) as Record<string, string>
    const timestampMicros = Number(record.__REALTIME_TIMESTAMP ?? record._SOURCE_REALTIME_TIMESTAMP ?? 0)
    const timestamp = timestampMicros > 0 ? Math.floor(timestampMicros / 1000) : Date.now()
    const priority = Number(record.PRIORITY ?? 6)
    const unit = record._SYSTEMD_UNIT ?? record.UNIT ?? record.SYSLOG_IDENTIFIER
    const message = record.MESSAGE ?? ''
    const hostname = record._HOSTNAME ?? record.HOSTNAME

    return {
      id: nextId(),
      timestamp,
      priority: Number.isFinite(priority) ? priority : 6,
      unit,
      message,
      hostname
    }
  } catch {
    return null
  }
}

function isPermissionDenied(stderr: string): boolean {
  const lower = stderr.toLowerCase()
  return (
    lower.includes('permission denied') ||
    lower.includes('access denied') ||
    lower.includes('insufficient privileges') ||
    lower.includes('failed to open') ||
    lower.includes('no such file or directory') && lower.includes('journal')
  )
}

function isJournalUnavailable(stderr: string, exitCode: number | null): boolean {
  if (exitCode === 127) return true
  const lower = stderr.toLowerCase()
  return (
    lower.includes('journalctl: command not found') ||
    lower.includes('no journal files') ||
    lower.includes('systemd-journald') && lower.includes('not running')
  )
}

export class LogService {
  private sessions = new Map<string, ServerLogSession>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  async start(serverId: string, query: Partial<LogsQuery> = {}): Promise<void> {
    const normalized = normalizeLogsQuery(query)
    await this.stop(serverId)
    const session = this.createSession(serverId, normalized)
    this.sessions.set(serverId, session)
    this.sendEntries({ serverId, entries: [], reset: true })
    this.setStatus(session, 'streaming')
    await this.spawnStream(session)
  }

  async stop(serverId: string): Promise<void> {
    const session = this.sessions.get(serverId)
    if (!session) return
    this.teardownSession(session)
    this.sessions.delete(serverId)
    this.setStatus(session, 'idle')
  }

  async setFilters(serverId: string, query: LogsQuery): Promise<void> {
    const normalized = normalizeLogsQuery(query)
    const session = this.sessions.get(serverId)
    if (!session) {
      await this.start(serverId, normalized)
      return
    }

    session.query = normalized
    session.buffer.clear()
    session.lineRemainder = ''
    this.flushBatch(session, true)
    this.stopStream(session)
    await this.spawnStream(session)
    this.setStatus(session, 'streaming')
  }

  stopAllForServer(serverId: string): void {
    void this.stop(serverId)
  }

  private createSession(serverId: string, query: LogsQuery): ServerLogSession {
    return {
      serverId,
      query,
      buffer: new RingBuffer<LogEntry>(BUFFER_CAPACITY),
      stream: null,
      lineRemainder: '',
      pendingEntries: [],
      batchTimer: null,
      nextEntryId: 0,
      status: 'idle'
    }
  }

  private nextEntryId(session: ServerLogSession): string {
    session.nextEntryId += 1
    return `${session.serverId}-${session.nextEntryId}`
  }

  private setStatus(session: ServerLogSession, status: LogsStatusEvent['status'], message?: string): void {
    session.status = status
    this.sendStatus({ serverId: session.serverId, status, message })
  }

  private sendStatus(event: LogsStatusEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('logs:status', event)
    }
  }

  private sendEntries(event: LogsEntriesEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('logs:entries', event)
    }
  }

  private scheduleBatch(session: ServerLogSession): void {
    if (session.batchTimer) return
    session.batchTimer = setTimeout(() => {
      session.batchTimer = null
      this.flushBatch(session, false)
    }, BATCH_INTERVAL_MS)
  }

  private flushBatch(session: ServerLogSession, reset: boolean): void {
    if (session.pendingEntries.length === 0 && !reset) return

    const entries = reset ? session.buffer.toArray() : [...session.pendingEntries]
    session.pendingEntries = []

    if (entries.length === 0 && !reset) return

    this.sendEntries({
      serverId: session.serverId,
      entries,
      reset: reset || undefined
    })
  }

  private ingestLine(session: ServerLogSession, line: string): void {
    const entry = parseJournalLine(line, () => this.nextEntryId(session))
    if (!entry) return
    session.buffer.push(entry)
    session.pendingEntries.push(entry)
    this.scheduleBatch(session)
  }

  private ingestChunk(session: ServerLogSession, chunk: string): void {
    const combined = session.lineRemainder + chunk
    const lines = combined.split('\n')
    session.lineRemainder = lines.pop() ?? ''
    for (const line of lines) {
      this.ingestLine(session, line)
    }
  }

  private stopStream(session: ServerLogSession): void {
    if (session.stream) {
      session.stream.close()
      session.stream = null
    }
  }

  private teardownSession(session: ServerLogSession): void {
    if (session.batchTimer) {
      clearTimeout(session.batchTimer)
      session.batchTimer = null
    }
    this.stopStream(session)
    session.pendingEntries = []
  }

  private async spawnStream(session: ServerLogSession): Promise<void> {
    const connection = connectionManager.getConnection(session.serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }

    const command = buildJournalctlCommand(session.query)
    let stderr = ''

    const client = await connection.getControlClient()
    const stream = await new Promise<ClientChannel>((resolve, reject) => {
      client.exec(command, (error, channel) => {
        if (error) {
          reject(new ConnectionError(error.message))
          return
        }
        resolve(channel)
      })
    })

    session.stream = stream

    stream.on('data', (data: Buffer) => {
      this.ingestChunk(session, data.toString('utf8'))
    })

    stream.stderr.on('data', (data: Buffer) => {
      stderr += data.toString('utf8')
    })

    stream.on('close', (code: number | null) => {
      session.stream = null
      this.flushBatch(session, false)

      if (session.status === 'idle') return

      if (isPermissionDenied(stderr)) {
        this.setStatus(
          session,
          'unavailable',
          'systemd journal could not be accessed on this server. Try connecting as a user with journal access or add your user to the systemd-journal group.'
        )
        return
      }

      if (isJournalUnavailable(stderr, code)) {
        this.setStatus(
          session,
          'unavailable',
          'systemd journal is not available on this server.'
        )
        return
      }

      if (code !== 0 && code !== null) {
        this.setStatus(session, 'error', stderr.trim() || `journalctl exited with code ${code}`)
        return
      }

      if (session.query.mode === 'recent') {
        this.setStatus(session, 'idle')
        return
      }

      if (session.status === 'streaming') {
        this.setStatus(session, 'error', 'Log stream ended unexpectedly')
      }
    })
  }
}

export { PRIORITY_NAMES, DEFAULT_LOGS_QUERY }

export const logService = new LogService()
