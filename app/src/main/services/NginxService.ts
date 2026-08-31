import type { BrowserWindow } from 'electron'
import type { ClientChannel, SFTPWrapper, FileEntryWithStats } from 'ssh2'
import type { ServerId } from '@shared/server'
import type {
  NginxAction,
  NginxConfigFile,
  NginxConfigGroup,
  NginxConfigTree,
  NginxLogPaths,
  NginxPaths,
  NginxStatus,
  NginxValidation
} from '@shared/nginx'
import type { NginxLogsDataEvent, NginxLogsExitEvent } from '@shared/ipc'
import { CommandError, ConnectionError, SFTPError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { execStreamOnClient } from '../ssh/exec'
import { privilegeService } from './PrivilegeService'
import { topologyService } from './deployments'
import {
  isInsideDirectory,
  parseNginxLogPaths,
  parseNginxMainPid,
  parseNginxPaths,
  parseNginxTestOutput,
  parseNginxVersion,
  parseSystemctlProperties
} from './nginxParsers'

const UNIT = 'nginx'
const LOG_TAIL_LINES = 200
const DETECTION_CACHE_TTL_MS = 30000

const MARKER_WHICH = '---RELAY:NGINX-WHICH---'
const MARKER_VERSION = '---RELAY:NGINX-VERSION---'
const MARKER_SYSTEMCTL = '---RELAY:NGINX-SYSTEMCTL---'
const MARKER_UNIT = '---RELAY:NGINX-UNIT---'
const MARKER_PS = '---RELAY:NGINX-PS---'

const CONFIG_SUBDIRECTORIES: { directory: string; group: NginxConfigGroup }[] = [
  { directory: 'conf.d', group: 'conf.d' },
  { directory: 'sites-available', group: 'sites-available' },
  { directory: 'sites-enabled', group: 'sites-enabled' },
  { directory: 'snippets', group: 'snippets' },
  { directory: 'modules-enabled', group: 'modules-enabled' }
]

interface LogStream {
  serverId: ServerId
  streamId: string
  channel: ClientChannel
}

interface Detection {
  installed: boolean
  version: string | null
  paths: NginxPaths
  checkedAt: number
}

/**
 * Tracks whether the config has been validated since the last write, so that
 * Reload can be blocked until `nginx -t` succeeded against the current files.
 */
interface ValidationTracker {
  configVersion: number
  validatedVersion: number
  validation: NginxValidation
}

function logStreamKey(serverId: ServerId, streamId: string): string {
  return `${serverId}:${streamId}`
}

function sectionBetween(stdout: string, start: string, end?: string): string {
  const startIndex = stdout.indexOf(start)
  if (startIndex === -1) return ''
  const from = startIndex + start.length
  if (!end) return stdout.slice(from)
  const endIndex = stdout.indexOf(end, from)
  return endIndex === -1 ? stdout.slice(from) : stdout.slice(from, endIndex)
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function isPermissionDenied(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /permission denied|EACCES|no such file/i.test(message)
}

function basename(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function sftpCallback<T>(
  operation: string,
  fn: (callback: (error: Error | null | undefined, result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((error, result) => {
      if (error) {
        reject(new SFTPError(error.message || `SFTP ${operation} failed`))
        return
      }
      resolve(result)
    })
  })
}

export class NginxService {
  private mainWindow: BrowserWindow | null = null
  private logStreams = new Map<string, LogStream>()
  private detectionCache = new Map<ServerId, Detection>()
  private validationTrackers = new Map<ServerId, ValidationTracker>()
  private knownLogPaths = new Map<ServerId, Set<string>>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getConnection(serverId: ServerId) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  private async exec(serverId: ServerId, command: string, timeoutMs = 20000) {
    return this.getConnection(serverId).exec(command, timeoutMs)
  }

  private async getSftp(serverId: ServerId): Promise<SFTPWrapper> {
    return this.getConnection(serverId).getSftp()
  }

  private async elevate(serverId: ServerId, command: string): Promise<string> {
    const context = await privilegeService.getContext(serverId)
    return privilegeService.buildPrivileged(context, command)
  }

  private tracker(serverId: ServerId): ValidationTracker {
    const existing = this.validationTrackers.get(serverId)
    if (existing) return existing
    const created: ValidationTracker = {
      configVersion: 0,
      validatedVersion: 0,
      validation: { state: 'unknown', output: '' }
    }
    this.validationTrackers.set(serverId, created)
    return created
  }

  private canReload(serverId: ServerId): boolean {
    const tracker = this.tracker(serverId)
    if (tracker.configVersion !== tracker.validatedVersion) return false
    return tracker.validation.state !== 'invalid'
  }

  private async detect(serverId: ServerId): Promise<Detection> {
    const cached = this.detectionCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < DETECTION_CACHE_TTL_MS) {
      return cached
    }

    const result = await this.exec(
      serverId,
      [
        `echo '${MARKER_WHICH}'`,
        'command -v nginx 2>/dev/null',
        `echo '${MARKER_VERSION}'`,
        'nginx -V 2>&1',
        `echo '${MARKER_SYSTEMCTL}'`,
        'command -v systemctl 2>/dev/null'
      ].join('; ')
    )

    const binary = sectionBetween(result.stdout, MARKER_WHICH, MARKER_VERSION).trim()
    const versionOutput = sectionBetween(result.stdout, MARKER_VERSION, MARKER_SYSTEMCTL)
    const installed = binary.length > 0

    const detection: Detection = {
      installed,
      version: installed ? parseNginxVersion(versionOutput) : null,
      paths: installed
        ? parseNginxPaths(versionOutput)
        : { prefix: null, confPath: null, configRoot: null, errorLogPath: null, accessLogPath: null },
      checkedAt: Date.now()
    }

    this.detectionCache.set(serverId, detection)
    return detection
  }

  private async requireConfigRoot(serverId: ServerId): Promise<string> {
    const detection = await this.detect(serverId)
    if (!detection.installed) {
      throw new ValidationError('nginx is not installed on this server')
    }
    if (!detection.paths.configRoot) {
      throw new CommandError(
        'Could not determine the nginx config root',
        'nginx -V did not report a --conf-path.'
      )
    }
    return detection.paths.configRoot
  }

  private async assertConfigPath(serverId: ServerId, path: string): Promise<string> {
    const configRoot = await this.requireConfigRoot(serverId)
    if (!isInsideDirectory(configRoot, path)) {
      throw new ValidationError(
        'Invalid config path: must resolve inside the nginx config root',
        `Config root: ${configRoot}`
      )
    }
    return path
  }

  async getStatus(serverId: ServerId): Promise<NginxStatus> {
    const detection = await this.detect(serverId)

    if (!detection.installed) {
      return {
        installed: false,
        version: null,
        paths: detection.paths,
        systemdAvailable: false,
        activeState: null,
        subState: null,
        mainPid: null,
        activeSince: null,
        unitFileState: null,
        validation: { state: 'unknown', output: '' },
        canReload: false
      }
    }

    const result = await this.exec(
      serverId,
      [
        `echo '${MARKER_SYSTEMCTL}'`,
        'command -v systemctl 2>/dev/null',
        `echo '${MARKER_UNIT}'`,
        `systemctl show ${UNIT} --property=ActiveState,SubState,MainPID,ActiveEnterTimestamp,UnitFileState --no-pager 2>/dev/null`,
        `echo '${MARKER_PS}'`,
        'ps -o pid= -C nginx 2>/dev/null'
      ].join('; ')
    )

    const systemdAvailable =
      sectionBetween(result.stdout, MARKER_SYSTEMCTL, MARKER_UNIT).trim().length > 0
    const properties = parseSystemctlProperties(
      sectionBetween(result.stdout, MARKER_UNIT, MARKER_PS)
    )
    const psPid = parseNginxMainPid(sectionBetween(result.stdout, MARKER_PS))

    const systemdPid = Number.parseInt(properties.MainPID ?? '', 10)
    const mainPid =
      systemdAvailable && Number.isInteger(systemdPid) && systemdPid > 0 ? systemdPid : psPid

    const tracker = this.tracker(serverId)

    return {
      installed: true,
      version: detection.version,
      paths: detection.paths,
      systemdAvailable,
      activeState: systemdAvailable
        ? (properties.ActiveState ?? null)
        : psPid !== null
          ? 'active'
          : 'inactive',
      subState: systemdAvailable ? (properties.SubState ?? null) : null,
      mainPid,
      activeSince: properties.ActiveEnterTimestamp || null,
      unitFileState: properties.UnitFileState || null,
      validation: tracker.validation,
      canReload: this.canReload(serverId)
    }
  }

  async getConfigTree(serverId: ServerId): Promise<NginxConfigTree> {
    const configRoot = await this.requireConfigRoot(serverId)
    const sftp = await this.getSftp(serverId)

    const rootEntries = await this.readDirectory(sftp, configRoot)
    if (rootEntries === null) {
      throw new SFTPError(`Could not read the nginx config root: ${configRoot}`)
    }

    const files: NginxConfigFile[] = []
    for (const entry of rootEntries) {
      if (!this.isConfigFile(entry)) continue
      files.push({
        path: `${configRoot}/${entry.filename}`,
        name: entry.filename,
        group: 'root',
        size: entry.attrs.size ?? 0
      })
    }

    const enabledNames = new Set<string>()
    const enabledEntries = await this.readDirectory(sftp, `${configRoot}/sites-enabled`)
    for (const entry of enabledEntries ?? []) {
      enabledNames.add(entry.filename)
    }

    for (const { directory, group } of CONFIG_SUBDIRECTORIES) {
      const path = `${configRoot}/${directory}`
      const entries = await this.readDirectory(sftp, path)
      if (entries === null) continue

      for (const entry of entries) {
        if (((entry.attrs.mode ?? 0) & 0o170000) === 0o040000) continue
        const file: NginxConfigFile = {
          path: `${path}/${entry.filename}`,
          name: entry.filename,
          group,
          size: entry.attrs.size ?? 0
        }
        if (group === 'sites-available') {
          file.enabled = enabledNames.has(entry.filename)
        }
        files.push(file)
      }
    }

    return { configRoot, files }
  }

  private isConfigFile(entry: FileEntryWithStats): boolean {
    const isDirectory = ((entry.attrs.mode ?? 0) & 0o170000) === 0o040000
    if (isDirectory) return false
    return entry.filename.endsWith('.conf')
  }

  /** Returns null when the directory does not exist or cannot be listed. */
  private async readDirectory(
    sftp: SFTPWrapper,
    path: string
  ): Promise<FileEntryWithStats[] | null> {
    try {
      const entries = await sftpCallback<FileEntryWithStats[]>('readdir', (callback) => {
        sftp.readdir(path, callback)
      })
      return entries.filter((entry) => entry.filename !== '.' && entry.filename !== '..')
    } catch {
      return null
    }
  }

  async readConfig(
    serverId: ServerId,
    path: string
  ): Promise<{ path: string; content: string; size: number }> {
    const validPath = await this.assertConfigPath(serverId, path)

    try {
      const sftp = await this.getSftp(serverId)
      const buffer = await sftpCallback<Buffer>('readFile', (callback) => {
        sftp.readFile(validPath, callback)
      })
      return { path: validPath, content: buffer.toString('utf8'), size: buffer.length }
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
    }

    const command = await this.elevate(serverId, `cat -- ${shellQuote(validPath)}`)
    const result = await this.exec(serverId, command)
    if (result.exitCode !== 0) {
      throw new CommandError('Could not read the config file', result.stderr.trim())
    }
    return { path: validPath, content: result.stdout, size: result.stdout.length }
  }

  async writeConfig(serverId: ServerId, path: string, content: string): Promise<void> {
    const validPath = await this.assertConfigPath(serverId, path)
    const sftp = await this.getSftp(serverId)

    let wrote = false
    try {
      await sftpCallback<void>('writeFile', (callback) => {
        sftp.writeFile(validPath, content, 'utf8', callback)
      })
      wrote = true
    } catch (error) {
      if (!isPermissionDenied(error)) throw error
    }

    if (!wrote) {
      // execOnClient has no stdin, so stage the content over SFTP and copy it
      // into place with elevated privileges. cp preserves the destination mode.
      const tempPath = `/tmp/zvia-nginx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      await sftpCallback<void>('writeFile', (callback) => {
        sftp.writeFile(tempPath, content, 'utf8', callback)
      })

      try {
        const command = await this.elevate(
          serverId,
          `cp -- ${shellQuote(tempPath)} ${shellQuote(validPath)}`
        )
        const result = await this.exec(serverId, `${command} 2>&1`)
        if (result.exitCode !== 0) {
          throw new CommandError('Could not write the config file', result.stdout.trim())
        }
      } finally {
        await this.exec(serverId, `rm -f -- ${shellQuote(tempPath)}`).catch(() => undefined)
      }
    }

    const tracker = this.tracker(serverId)
    tracker.configVersion += 1
    tracker.validation = { state: 'unknown', output: '' }
  }

  async validate(serverId: ServerId): Promise<NginxValidation> {
    await this.requireConfigRoot(serverId)
    const command = await this.elevate(serverId, 'nginx -t')
    const result = await this.exec(serverId, `${command} 2>&1`)

    const validation = parseNginxTestOutput(result.stdout || result.stderr)
    const tracker = this.tracker(serverId)
    tracker.validation = validation
    tracker.validatedVersion = tracker.configVersion

    return validation
  }

  async runAction(serverId: ServerId, action: NginxAction): Promise<void> {
    const detection = await this.detect(serverId)
    if (!detection.installed) {
      throw new ValidationError('nginx is not installed on this server')
    }

    if (action === 'reload' && !this.canReload(serverId)) {
      throw new ValidationError(
        'Test the configuration before reloading nginx',
        'The config changed since the last successful nginx -t.'
      )
    }

    const command = await this.elevate(serverId, `systemctl ${action} ${UNIT}`)
    const result = await this.exec(serverId, `${command} 2>&1`, 30000)
    if (result.exitCode !== 0) {
      throw new CommandError(`Failed to ${action} nginx`, result.stdout.trim())
    }
    topologyService.invalidate(serverId)
  }

  async getLogPaths(serverId: ServerId): Promise<NginxLogPaths> {
    const detection = await this.detect(serverId)
    if (!detection.installed) {
      throw new ValidationError('nginx is not installed on this server')
    }

    const paths: NginxLogPaths = { accessLogs: [], errorLogs: [] }

    try {
      const command = await this.elevate(serverId, 'nginx -T')
      const result = await this.exec(serverId, `${command} 2>/dev/null`, 30000)
      if (result.exitCode === 0) {
        const parsed = parseNginxLogPaths(result.stdout, detection.paths.prefix)
        paths.accessLogs = parsed.accessLogs
        paths.errorLogs = parsed.errorLogs
      }
    } catch {
      // nginx -T needs elevation; fall through to the compiled-in defaults.
    }

    if (paths.accessLogs.length === 0 && detection.paths.accessLogPath) {
      paths.accessLogs = [detection.paths.accessLogPath]
    }
    if (paths.errorLogs.length === 0 && detection.paths.errorLogPath) {
      paths.errorLogs = [detection.paths.errorLogPath]
    }

    this.knownLogPaths.set(serverId, new Set([...paths.accessLogs, ...paths.errorLogs]))
    return paths
  }

  /** Log paths come from nginx itself, never from renderer input. */
  private async assertKnownLogPath(serverId: ServerId, path: string): Promise<string> {
    if (this.knownLogPaths.get(serverId)?.has(path)) return path
    await this.getLogPaths(serverId)
    if (this.knownLogPaths.get(serverId)?.has(path)) return path
    throw new ValidationError(
      'Invalid log path: not reported by the running nginx configuration',
      path
    )
  }

  private sendLogsData(event: NginxLogsDataEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('nginx:logsData', event)
    }
  }

  private sendLogsExit(event: NginxLogsExitEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('nginx:logsExit', event)
    }
  }

  async startLogs(serverId: ServerId, streamId: string, path: string): Promise<void> {
    const validPath = await this.assertKnownLogPath(serverId, path)
    const key = logStreamKey(serverId, streamId)
    if (this.logStreams.has(key)) {
      throw new CommandError(`Log stream already exists: ${streamId}`)
    }

    const command = await this.elevate(
      serverId,
      `tail -n ${LOG_TAIL_LINES} -F -- ${shellQuote(validPath)}`
    )

    const connection = this.getConnection(serverId)
    const client = await connection.getInteractiveClient()
    const channel = await execStreamOnClient(client, command)

    this.logStreams.set(key, { serverId, streamId, channel })

    channel.on('data', (data: Buffer) => {
      this.sendLogsData({ serverId, streamId, data: data.toString('base64') })
    })

    channel.stderr.on('data', (data: Buffer) => {
      this.sendLogsData({ serverId, streamId, data: data.toString('base64') })
    })

    channel.on('close', (code?: number) => {
      this.logStreams.delete(key)
      this.sendLogsExit({ serverId, streamId, exitCode: code ?? 0 })
    })
  }

  stopLogs(serverId: ServerId, streamId: string): void {
    const key = logStreamKey(serverId, streamId)
    const stream = this.logStreams.get(key)
    if (!stream) return
    this.logStreams.delete(key)
    stream.channel.close()
  }

  stopAllLogsForServer(serverId: ServerId): void {
    for (const [key, stream] of this.logStreams) {
      if (stream.serverId !== serverId) continue
      this.logStreams.delete(key)
      stream.channel.close()
    }
    this.detectionCache.delete(serverId)
    this.validationTrackers.delete(serverId)
    this.knownLogPaths.delete(serverId)
  }
}

export const nginxService = new NginxService()
