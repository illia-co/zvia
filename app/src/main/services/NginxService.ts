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
import { getServerConnection, shellQuote, resolveBinary, NGINX_BINARY_FALLBACKS } from './ServiceBase'
import { LogStreamRegistry } from './LogStreamRegistry'
import { execStreamOnClient } from '../ssh/exec'
import { privilegeService } from './PrivilegeService'
import { topologyService } from './deployments'
import {
  classifyNginxDumpFailure,
  type NginxDumpFailure,
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

/**
 * Backup/disabled file names nginx would never load from a `*.conf` include
 * (editor copies, `*.disabled`, `*.off`). The SFTP-assembled dump must skip
 * them or phantom server blocks pollute topology/SSL. The `nginx -T` path is
 * server truth and stays unfiltered; the file browser still lists everything.
 */
const BACKUP_CONFIG_PATTERN =
  /(~|\.bak|\.backup|\.bkp|\.orig|\.old|\.save|\.dist|\.dpkg-dist|\.dpkg-old|\.dpkg-new|\.rpmnew|\.rpmsave|\.rej|\.swp|\.swo|\.swn|\.tmp|\.temp|\.disabled|\.off|\.inactive|\.copy)$/i

function isSkippedDumpFile(file: NginxConfigFile): boolean {
  if (BACKUP_CONFIG_PATTERN.test(file.name) || file.name.startsWith('.#') || file.name.startsWith('#')) {
    return true
  }
  // ponytail: sites-available without a sites-enabled link is disabled; nginx never loads it
  if (file.group === 'sites-available' && file.enabled === false) return true
  return false
}

interface Detection {
  installed: boolean
  binary: string | null
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

function sectionBetween(stdout: string, start: string, end?: string): string {
  const startIndex = stdout.indexOf(start)
  if (startIndex === -1) return ''
  const from = startIndex + start.length
  if (!end) return stdout.slice(from)
  const endIndex = stdout.indexOf(end, from)
  return endIndex === -1 ? stdout.slice(from) : stdout.slice(from, endIndex)
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

export interface NginxConfigDump {
  /** Raw `nginx -T`-style output with `# configuration file` markers. */
  dump: string
  source: 'nginx-T' | 'sftp' | 'none'
  /** Classified stderr cause when the dump is missing. */
  failure: NginxDumpFailure
}

const SFTP_DUMP_MAX_FILES = 50

export class NginxService {
  private mainWindow: BrowserWindow | null = null
  private logStreams = new LogStreamRegistry({
    onData: (event) => this.sendLogsData(event),
    onExit: (event) => this.sendLogsExit(event)
  })
  private detectionCache = new Map<ServerId, Detection>()
  private validationTrackers = new Map<ServerId, ValidationTracker>()
  private knownLogPaths = new Map<ServerId, Set<string>>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getConnection(serverId: ServerId) {
    return getServerConnection(serverId)
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

    // Non-interactive SSH PATH often lacks sbin dirs; probe absolute
    // locations so `installed` is not falsely false for thin-PATH users.
    const binary =
      (await resolveBinary(serverId, 'nginx', NGINX_BINARY_FALLBACKS).catch(() => null)) ??
      null

    const result = await this.exec(
      serverId,
      [
        `echo '${MARKER_WHICH}'`,
        binary ?? 'command -v nginx 2>/dev/null',
        `echo '${MARKER_VERSION}'`,
        binary ? `${shellQuote(binary)} -V 2>&1` : 'nginx -V 2>&1',
        `echo '${MARKER_SYSTEMCTL}'`,
        'command -v systemctl 2>/dev/null'
      ].join('; ')
    )

    const whichOutput = sectionBetween(result.stdout, MARKER_WHICH, MARKER_VERSION).trim()
    const resolved = binary ?? (whichOutput.length > 0 ? whichOutput : null)
    const versionOutput = sectionBetween(result.stdout, MARKER_VERSION, MARKER_SYSTEMCTL)
    const installed = resolved !== null

    const detection: Detection = {
      installed,
      binary: resolved,
      version: installed ? parseNginxVersion(versionOutput) : null,
      paths: installed
        ? parseNginxPaths(versionOutput)
        : { prefix: null, confPath: null, configRoot: null, errorLogPath: null, accessLogPath: null },
      checkedAt: Date.now()
    }

    this.detectionCache.set(serverId, detection)
    return detection
  }

  /** Resolved nginx binary for shell use; bare `nginx` when undetectable. */
  async getBinary(serverId: ServerId): Promise<string> {
    const detection = await this.detect(serverId).catch(() => null)
    return detection?.binary ?? 'nginx'
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
      // into place with elevated privileges. The terminal user can do the same
      // with `sudo cp`, so after the GUI confirmation the operation must be
      // allowed — never silently blocked.
      const tempPath = `/tmp/zvia-nginx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      await sftpCallback<void>('writeFile', (callback) => {
        sftp.writeFile(tempPath, content, 'utf8', callback)
      })

      try {
        // NOTE: `cp` and `chmod` must each be elevated separately. `sudo`
        // applies only to the command directly after it, so
        // `sudo cp … && chmod …` would run `chmod` as the unprivileged SSH
        // user and fail on root-owned files — exactly the files that reach
        // this fallback path.
        let copyCommand: string
        let modeCommand: string
        try {
          copyCommand = await this.elevate(
            serverId,
            `cp -- ${shellQuote(tempPath)} ${shellQuote(validPath)}`
          )
          modeCommand = await this.elevate(
            serverId,
            `chmod 644 -- ${shellQuote(validPath)}`
          )
        } catch (error) {
          throw new CommandError(
            'Could not write the config file: the SSH user cannot elevate to root',
            error instanceof Error ? error.message : String(error)
          )
        }
        const copyResult = await this.exec(serverId, `${copyCommand} 2>&1`)
        if (copyResult.exitCode !== 0) {
          throw new CommandError(
            'Could not write the config file',
            copyResult.stdout.trim() || copyResult.stderr.trim() || `exit code ${copyResult.exitCode}`
          )
        }
        const modeResult = await this.exec(serverId, `${modeCommand} 2>&1`)
        if (modeResult.exitCode !== 0) {
          throw new CommandError(
            'Could not write the config file',
            modeResult.stdout.trim() || modeResult.stderr.trim() || `exit code ${modeResult.exitCode}`
          )
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
    const binary = await this.getBinary(serverId)
    const command = await this.elevate(serverId, `${binary} -t`)
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
        'The config changed since the last successful nginx -t. Run Test configuration first.'
      )
    }

    // Same privilege rule as the terminal: if the SSH user can sudo, the GUI
    // must allow it after confirmation. Try systemctl first, then fall back
    // for hosts without systemd (service wrapper, direct nginx signal).
    const attempts: string[] = []
    try {
      attempts.push(await this.elevate(serverId, `systemctl ${action} ${UNIT}`))
    } catch (error) {
      throw new CommandError(
        `Failed to ${action} nginx: the SSH user cannot elevate to root`,
        error instanceof Error ? error.message : String(error)
      )
    }
    if (action === 'reload') {
      try {
        attempts.push(await this.elevate(serverId, `${detection.binary ?? 'nginx'} -s reload`))
      } catch {
        // systemctl attempt already covers the privileged path.
      }
    } else {
      try {
        attempts.push(await this.elevate(serverId, `service nginx ${action}`))
      } catch {
        // systemctl attempt already covers the privileged path.
      }
    }

    let lastError = ''
    for (const command of attempts) {
      const result = await this.exec(serverId, `${command} 2>&1`, 30000)
      if (result.exitCode === 0) {
        topologyService.invalidate(serverId)
        return
      }
      lastError = (result.stdout.trim() || result.stderr.trim()).trim()
      // systemctl-specific failure on non-systemd hosts, or sudo denial when
      // only some actions are NOPASSWD-allowed → try the next fallback.
      if (
        !/systemd|system has not been booted|failed to connect to bus|not found|is not allowed to execute|a password is required/i.test(
          lastError
        )
      ) {
        break
      }
    }
    throw new CommandError(`Failed to ${action} nginx`, lastError || `exit code 1`)
  }

  async getLogPaths(serverId: ServerId): Promise<NginxLogPaths> {
    const detection = await this.detect(serverId)
    if (!detection.installed) {
      throw new ValidationError('nginx is not installed on this server')
    }

    const paths: NginxLogPaths = { accessLogs: [], errorLogs: [] }

    try {
      const command = await this.elevate(serverId, `${detection.binary ?? 'nginx'} -T`)
      const result = await this.exec(serverId, `${command} 2>/dev/null`, 30000)
      if (result.stdout.includes('# configuration file')) {
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

  /**
   * Returns an `nginx -T`-style configuration dump for topology/SSL parsing.
   * Tries an (elevated when possible) `nginx -T` first — stderr is preserved
   * for failure classification — then falls back to assembling the dump from
   * SFTP-read config files, which are usually world-readable even for
   * password-sudo users. Never throws for unreadable configs.
   */
  async getConfigDump(serverId: ServerId): Promise<NginxConfigDump> {
    const binary = await this.getBinary(serverId)
    const elevated = await this.elevate(serverId, `${binary} -T`).catch(() => null)
    // No `2>/dev/null`: emerg output on stderr classifies the failure while
    // the complete dump (when present) stays on stdout.
    const result = await this.exec(serverId, elevated ?? `${binary} -T`, 45000).catch(() => null)
    if (result && result.stdout.includes('# configuration file')) {
      return { dump: result.stdout, source: 'nginx-T', failure: null }
    }
    const failure = classifyNginxDumpFailure(result?.stderr ?? '')

    try {
      const detection = await this.detect(serverId).catch(() => null)
      const configRoot = detection?.paths.configRoot
      if (!detection?.installed || !configRoot) {
        return { dump: '', source: 'none', failure }
      }
      const tree = await this.getConfigTree(serverId)
      const candidates = [
        `${configRoot}/nginx.conf`,
        ...tree.files.filter((file) => !isSkippedDumpFile(file)).map((file) => file.path)
      ]
      const chunks: string[] = []
      const seen = new Set<string>()
      for (const path of candidates) {
        if (seen.has(path)) continue // ponytail: nginx.conf duplicates tree.files; stop only on file cap
        if (chunks.length >= SFTP_DUMP_MAX_FILES) break
        seen.add(path)
        try {
          const { content } = await this.readConfig(serverId, path)
          chunks.push(`# configuration file ${path}:\n${content}`)
        } catch {
          // Root-only files skip individually; the rest still assembles.
        }
      }
      const dump = chunks.join('\n')
      if (dump.includes('# configuration file') && /server\s*\{/.test(dump)) {
        return { dump, source: 'sftp', failure: null }
      }
    } catch {
      // Best-effort; callers degrade to warnings.
    }
    return { dump: '', source: 'none', failure }
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

    const command = await this.elevate(
      serverId,
      `tail -n ${LOG_TAIL_LINES} -F -- ${shellQuote(validPath)}`
    )

    await this.logStreams.start(serverId, streamId, command)
  }

  stopLogs(serverId: ServerId, streamId: string): void {
    this.logStreams.stop(serverId, streamId)
  }

  stopAllLogsForServer(serverId: ServerId): void {
    this.logStreams.stopAllForServer(serverId)
    this.detectionCache.delete(serverId)
    this.validationTrackers.delete(serverId)
    this.knownLogPaths.delete(serverId)
  }
}

export const nginxService = new NginxService()
connectionManager.registerTeardown((serverId) => nginxService.stopAllLogsForServer(serverId))
