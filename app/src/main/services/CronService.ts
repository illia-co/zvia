import { randomUUID } from 'node:crypto'
import type {
  CronJob,
  CronListResponse,
  CronSource,
  CronTarget,
  CrontabSource
} from '@shared/cron'
import { describeCron, parseCronLine, parseCrontab, validateCronExpression } from '@shared/cron'
import { CommandError, ConnectionError, PrivilegeRequiredError, SFTPError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { privilegeService } from './PrivilegeService'

const USER_CRONTAB_PATH = 'crontab:user'
const ROOT_CRONTAB_PATH = 'crontab:root'

const PERIODIC_SCHEDULES: Record<string, string> = {
  hourly: '@hourly',
  daily: '@daily',
  weekly: '@weekly',
  monthly: '@monthly'
}

const SECTION_CRONTAB = '---RELAY:CRONTAB---'
const SECTION_WHOAMI = '---RELAY:WHOAMI---'
const SECTION_USER = '---RELAY:USER---'
const SECTION_SYSTEM = '---RELAY:SYSTEM---'
const SECTION_CRON_D = '---RELAY:CRON.D---'
const SECTION_PERIODIC = '---RELAY:PERIODIC---'
const FILE_MARKER_PREFIX = '---RELAY:FILE:'

const DISCOVERY_COMMAND = [
  `echo '${SECTION_CRONTAB}'`,
  'command -v crontab >/dev/null 2>&1 && echo yes || echo no',
  `echo '${SECTION_WHOAMI}'`,
  'id -un 2>/dev/null',
  `echo '${SECTION_USER}'`,
  'crontab -l 2>/dev/null',
  `echo '${SECTION_SYSTEM}'`,
  'cat /etc/crontab 2>/dev/null',
  `echo '${SECTION_CRON_D}'`,
  `for f in /etc/cron.d/*; do [ -f "$f" ] || continue; echo "${FILE_MARKER_PREFIX}$f---"; cat "$f" 2>/dev/null; done`,
  `echo '${SECTION_PERIODIC}'`,
  'for p in hourly daily weekly monthly; do for f in /etc/cron.$p/*; do [ -f "$f" ] || continue; echo "$p $f"; done; done'
].join('\n')

interface DiscoverySections {
  crontabAvailable: boolean
  username: string
  userCrontab: string
  systemCrontab: string
  cronD: Map<string, string>
  periodic: { period: string; path: string }[]
}

function splitSections(stdout: string): DiscoverySections {
  const sections: DiscoverySections = {
    crontabAvailable: false,
    username: '',
    userCrontab: '',
    systemCrontab: '',
    cronD: new Map(),
    periodic: []
  }

  let current: 'crontab' | 'whoami' | 'user' | 'system' | 'cron.d' | 'periodic' | null = null
  let currentFile: string | null = null
  const buffers = new Map<string, string[]>()

  const push = (key: string, line: string): void => {
    const existing = buffers.get(key)
    if (existing) {
      existing.push(line)
      return
    }
    buffers.set(key, [line])
  }

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    const marker = line.trim()

    if (marker === SECTION_CRONTAB) {
      current = 'crontab'
      continue
    }
    if (marker === SECTION_WHOAMI) {
      current = 'whoami'
      continue
    }
    if (marker === SECTION_USER) {
      current = 'user'
      continue
    }
    if (marker === SECTION_SYSTEM) {
      current = 'system'
      continue
    }
    if (marker === SECTION_CRON_D) {
      current = 'cron.d'
      currentFile = null
      continue
    }
    if (marker === SECTION_PERIODIC) {
      current = 'periodic'
      continue
    }
    if (current === 'cron.d' && marker.startsWith(FILE_MARKER_PREFIX) && marker.endsWith('---')) {
      currentFile = marker.slice(FILE_MARKER_PREFIX.length, -3)
      buffers.set(`file:${currentFile}`, [])
      continue
    }

    switch (current) {
      case 'crontab':
        if (marker) sections.crontabAvailable = marker === 'yes'
        break
      case 'whoami':
        if (marker && !sections.username) sections.username = marker
        break
      case 'user':
        push('user', line)
        break
      case 'system':
        push('system', line)
        break
      case 'cron.d':
        if (currentFile) push(`file:${currentFile}`, line)
        break
      case 'periodic': {
        if (!marker) break
        const [period, ...rest] = marker.split(/\s+/)
        const path = rest.join(' ')
        if (period && path && PERIODIC_SCHEDULES[period]) {
          sections.periodic.push({ period, path })
        }
        break
      }
      default:
        break
    }
  }

  sections.userCrontab = (buffers.get('user') ?? []).join('\n')
  sections.systemCrontab = (buffers.get('system') ?? []).join('\n')
  for (const [key, lines] of buffers) {
    if (!key.startsWith('file:')) continue
    sections.cronD.set(key.slice('file:'.length), lines.join('\n'))
  }

  return sections
}

function periodicJobs(entries: { period: string; path: string }[]): CronJob[] {
  return entries.map((entry, index) => {
    const schedule = PERIODIC_SCHEDULES[entry.period]
    return {
      id: `periodic:${entry.path}:${index + 1}`,
      raw: entry.path,
      schedule,
      command: entry.path,
      user: 'root',
      source: 'periodic' as CronSource,
      sourcePath: `/etc/cron.${entry.period}`,
      lineNumber: index + 1,
      description: describeCron(schedule),
      valid: true
    }
  })
}

/**
 * `crontab -l` exits non-zero and prints "no crontab for <user>" when the
 * crontab is merely empty. That is an empty crontab, not a read failure — the
 * distinction decides whether Relay offers to edit it at all.
 */
export function isEmptyCrontabMessage(details: string): boolean {
  return /no crontab for/i.test(details)
}

function crontabPath(target: CronTarget): string {
  return target === 'root' ? ROOT_CRONTAB_PATH : USER_CRONTAB_PATH
}

function crontabSource(target: CronTarget): CronSource {
  return target === 'root' ? 'root-crontab' : 'user-crontab'
}

function lineNumberFromJobId(jobId: string, target: CronTarget): number {
  const expectedPrefix = `${crontabSource(target)}:${crontabPath(target)}:`
  if (!jobId.startsWith(expectedPrefix)) {
    throw new ValidationError('Invalid jobId: does not belong to the requested crontab')
  }
  const lineNumber = Number.parseInt(jobId.slice(expectedPrefix.length), 10)
  if (!Number.isInteger(lineNumber) || lineNumber < 1) {
    throw new ValidationError('Invalid jobId: missing line number')
  }
  return lineNumber
}

export class CronService {
  private getConnection(serverId: string) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  async list(serverId: string): Promise<CronListResponse> {
    const connection = this.getConnection(serverId)
    const result = await connection.exec(DISCOVERY_COMMAND, 20000)
    const sections = splitSections(result.stdout)

    const context = await privilegeService.getContext(serverId)
    const jobs: CronJob[] = []

    jobs.push(
      ...parseCrontab(sections.userCrontab, {
        source: context.isRoot ? 'root-crontab' : 'user-crontab',
        sourcePath: context.isRoot ? ROOT_CRONTAB_PATH : USER_CRONTAB_PATH,
        defaultUser: sections.username || undefined,
        target: context.isRoot ? 'root' : 'user'
      })
    )

    let canEditRoot = context.isRoot
    if (!context.isRoot) {
      const rootCrontab = await this.readRootCrontabQuietly(serverId)
      if (rootCrontab !== null) {
        canEditRoot = true
        jobs.push(
          ...parseCrontab(rootCrontab, {
            source: 'root-crontab',
            sourcePath: ROOT_CRONTAB_PATH,
            defaultUser: 'root',
            target: 'root'
          })
        )
      }
    }

    jobs.push(
      ...parseCrontab(sections.systemCrontab, {
        source: 'system-crontab',
        sourcePath: '/etc/crontab',
        hasUserField: true
      })
    )

    for (const [path, content] of sections.cronD) {
      jobs.push(
        ...parseCrontab(content, {
          source: 'cron.d',
          sourcePath: path,
          hasUserField: true
        })
      )
    }

    jobs.push(...periodicJobs(sections.periodic))

    return {
      jobs,
      crontabAvailable: sections.crontabAvailable,
      // When connected as root the user crontab *is* the root crontab, so it is
      // only ever offered once.
      canEditUser: sections.crontabAvailable && !context.isRoot,
      canEditRoot: sections.crontabAvailable && canEditRoot
    }
  }

  private async readRootCrontabQuietly(serverId: string): Promise<string | null> {
    try {
      const context = await privilegeService.getContext(serverId)
      const command = privilegeService.buildPrivileged(context, 'crontab -u root -l')
      const result = await this.getConnection(serverId).exec(command)
      if (result.exitCode !== 0) {
        const details = (result.stderr || result.stdout).trim()
        return isEmptyCrontabMessage(details) ? '' : null
      }
      return result.stdout
    } catch (error) {
      if (error instanceof PrivilegeRequiredError) return null
      throw error
    }
  }

  /** Read-only view of a crontab exactly as cron stores it, comments included. */
  async getSource(serverId: string, target: CronTarget): Promise<CrontabSource> {
    return { target, content: await this.readCrontab(serverId, target) }
  }

  private async buildCrontabCommand(
    serverId: string,
    target: CronTarget,
    args: string
  ): Promise<string> {
    const context = await privilegeService.getContext(serverId)
    if (target === 'root' && !context.isRoot) {
      return privilegeService.buildPrivileged(context, `crontab -u root ${args}`)
    }
    return `crontab ${args}`
  }

  private async readCrontab(serverId: string, target: CronTarget): Promise<string> {
    const command = await this.buildCrontabCommand(serverId, target, '-l')
    const result = await this.getConnection(serverId).exec(command)
    if (result.exitCode !== 0) {
      const details = (result.stderr || result.stdout).trim()
      if (isEmptyCrontabMessage(details)) return ''
      throw new CommandError('Failed to read crontab', details)
    }
    return result.stdout
  }

  /**
   * Installs a crontab by writing it over SFTP and running `crontab <file>`.
   * `execOnClient` has no stdin, so a temp file avoids shell heredocs entirely.
   */
  private async installCrontab(
    serverId: string,
    target: CronTarget,
    content: string
  ): Promise<void> {
    const connection = this.getConnection(serverId)
    const tempPath = `/tmp/.relay-crontab-${randomUUID()}`
    const command = await this.buildCrontabCommand(serverId, target, tempPath)
    const normalized = content.endsWith('\n') ? content : `${content}\n`

    const sftp = await connection.getSftp()
    await new Promise<void>((resolve, reject) => {
      sftp.writeFile(tempPath, normalized, { encoding: 'utf8', mode: 0o600 }, (error) => {
        if (error) {
          reject(new SFTPError(error.message || 'Failed to stage crontab'))
          return
        }
        resolve()
      })
    })

    try {
      const result = await connection.exec(command, 20000)
      if (result.exitCode !== 0) {
        throw new CommandError(
          'Failed to install crontab',
          (result.stderr || result.stdout).trim()
        )
      }
    } finally {
      await connection.exec(`rm -f ${tempPath}`).catch(() => undefined)
    }
  }

  private assertSchedule(schedule: string): void {
    const validation = validateCronExpression(schedule)
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid schedule: ${validation.error ?? 'unsupported cron expression'}`
      )
    }
  }

  private assertCommand(command: string): void {
    if (!command.trim()) {
      throw new ValidationError('Invalid command: expected non-empty string')
    }
    if (/[\n\r\0]/.test(command)) {
      throw new ValidationError('Invalid command: expected a single line')
    }
  }

  private splitCrontabLines(content: string): string[] {
    if (!content) return []
    return content.replace(/\n+$/, '').split('\n')
  }

  async createJob(
    serverId: string,
    target: CronTarget,
    schedule: string,
    command: string
  ): Promise<void> {
    this.assertSchedule(schedule)
    this.assertCommand(command)

    const content = await this.readCrontab(serverId, target)
    const lines = this.splitCrontabLines(content)
    lines.push(`${schedule.trim()} ${command.trim()}`)
    await this.installCrontab(serverId, target, lines.join('\n'))
  }

  async updateJob(
    serverId: string,
    target: CronTarget,
    jobId: string,
    schedule: string,
    command: string
  ): Promise<void> {
    this.assertSchedule(schedule)
    this.assertCommand(command)

    const lineNumber = lineNumberFromJobId(jobId, target)
    const lines = this.splitCrontabLines(await this.readCrontab(serverId, target))
    const index = this.resolveJobLineIndex(lines, lineNumber)

    lines[index] = `${schedule.trim()} ${command.trim()}`
    await this.installCrontab(serverId, target, lines.join('\n'))
  }

  async deleteJob(serverId: string, target: CronTarget, jobId: string): Promise<void> {
    const lineNumber = lineNumberFromJobId(jobId, target)
    const lines = this.splitCrontabLines(await this.readCrontab(serverId, target))
    const index = this.resolveJobLineIndex(lines, lineNumber)

    lines.splice(index, 1)
    await this.installCrontab(serverId, target, lines.join('\n'))
  }

  private resolveJobLineIndex(lines: string[], lineNumber: number): number {
    const index = lineNumber - 1
    if (index < 0 || index >= lines.length || !parseCronLine(lines[index])) {
      throw new CommandError(
        'Cron job could not be found',
        'The crontab changed since it was loaded. Refresh and try again.'
      )
    }
    return index
  }
}

export const cronService = new CronService()
