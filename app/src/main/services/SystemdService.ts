import type {
  SystemdAction,
  SystemdUnit,
  SystemdUnitDetail,
  SystemdUnitFile
} from '@shared/systemd'
import { CommandError, ConnectionError, ValidationError } from '@shared/errors'
import { isSystemdAction, getProtectedSystemdUnitActionBlock } from '@shared/systemd'
import { assertSystemdUnit } from '@shared/validate'
import { connectionManager } from '../ssh/ConnectionManager'
import { getServerConnection } from './ServiceBase'
import { privilegeService } from './PrivilegeService'
import { topologyService } from './deployments'
import {
  buildUnitDetail,
  mergeUnits,
  parseJournalOutput,
  parseListUnitsJson,
  parseListUnitsPlain,
  parseShowProperties,
  parseUnitFilePaths,
  parseUnitFileStates
} from './systemdParsers'

const AVAILABILITY_TTL_MS = 5000
const ACTION_TIMEOUT_MS = 60000
const DEFAULT_LOG_LINES = 200

const SHOW_PROPERTIES = [
  'Id',
  'Description',
  'LoadState',
  'ActiveState',
  'SubState',
  'MainPID',
  'ActiveEnterTimestamp',
  'UnitFileState',
  'FragmentPath'
].join(',')

export class SystemdService {
  private availabilityCache = new Map<string, { available: boolean; checkedAt: number }>()

  private getConnection(serverId: string) {
    return getServerConnection(serverId)
  }

  async isAvailable(serverId: string): Promise<boolean> {
    const cached = this.availabilityCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < AVAILABILITY_TTL_MS) {
      return cached.available
    }

    let available = false
    try {
      const result = await this.getConnection(serverId).exec('systemctl --version', 10000)
      available = result.exitCode === 0 && result.stdout.includes('systemd')
    } catch {
      available = false
    }

    this.availabilityCache.set(serverId, { available, checkedAt: Date.now() })
    return available
  }

  private async ensureAvailable(serverId: string): Promise<void> {
    if (await this.isAvailable(serverId)) return
    throw new CommandError(
      'systemd is not available on this server',
      'systemctl --version did not succeed.'
    )
  }

  async listUnits(serverId: string): Promise<SystemdUnit[]> {
    await this.ensureAvailable(serverId)
    const connection = this.getConnection(serverId)

    const jsonResult = await connection.exec(
      'systemctl list-units --type=service --all --no-pager --output=json'
    )
    let rows =
      jsonResult.exitCode === 0 ? parseListUnitsJson(jsonResult.stdout) : null

    if (!rows) {
      const plainResult = await connection.exec(
        'systemctl list-units --type=service --all --no-pager --plain --no-legend'
      )
      if (plainResult.exitCode !== 0) {
        throw new CommandError(
          'Failed to list systemd services',
          (plainResult.stderr || plainResult.stdout).trim()
        )
      }
      rows = parseListUnitsPlain(plainResult.stdout)
    }

    const filesResult = await connection.exec(
      'systemctl list-unit-files --type=service --no-pager --plain --no-legend'
    )
    const unitFileStates =
      filesResult.exitCode === 0
        ? parseUnitFileStates(filesResult.stdout)
        : new Map<string, string>()

    return mergeUnits(rows, unitFileStates)
  }

  async getUnit(serverId: string, unit: string): Promise<SystemdUnitDetail> {
    await this.ensureAvailable(serverId)
    const name = assertSystemdUnit(unit)

    const result = await this.getConnection(serverId).exec(
      `systemctl show ${name} --no-pager --property=${SHOW_PROPERTIES}`
    )
    if (result.exitCode !== 0) {
      throw new CommandError(
        `Failed to read ${name}`,
        (result.stderr || result.stdout).trim()
      )
    }

    return buildUnitDetail(name, parseShowProperties(result.stdout))
  }

  /**
   * Read-only view of the unit definition. `systemctl cat` includes drop-ins,
   * so it shows what systemd actually runs rather than just the main fragment.
   */
  async getUnitFile(serverId: string, unit: string): Promise<SystemdUnitFile> {
    await this.ensureAvailable(serverId)
    const name = assertSystemdUnit(unit)

    const result = await this.getConnection(serverId).exec(`systemctl cat ${name} --no-pager`)
    if (result.exitCode !== 0) {
      throw new CommandError(
        `Failed to read the unit file for ${name}`,
        (result.stderr || result.stdout).trim()
      )
    }

    const content = result.stdout.replace(/\r/g, '')
    return { unit: name, content, paths: parseUnitFilePaths(content) }
  }

  async getUnitLogs(
    serverId: string,
    unit: string,
    lines = DEFAULT_LOG_LINES
  ): Promise<string[]> {
    const name = assertSystemdUnit(unit)
    const count = Number.isInteger(lines) ? Math.min(Math.max(lines, 1), 2000) : DEFAULT_LOG_LINES

    const result = await this.getConnection(serverId).exec(
      `journalctl -u ${name} -n ${count} --no-pager`
    )
    if (result.exitCode !== 0) {
      throw new CommandError(
        `Failed to read logs for ${name}`,
        (result.stderr || result.stdout).trim()
      )
    }

    return parseJournalOutput(result.stdout)
  }

  async runAction(serverId: string, unit: string, action: SystemdAction): Promise<void> {
    await this.ensureAvailable(serverId)
    if (!isSystemdAction(action)) {
      throw new ValidationError('Invalid action: expected a supported systemctl action')
    }
    const name = assertSystemdUnit(unit)
    const blockReason = getProtectedSystemdUnitActionBlock(name, action)
    if (blockReason) {
      throw new ValidationError(blockReason)
    }

    const context = await privilegeService.getContext(serverId)
    const command = privilegeService.buildPrivileged(context, `systemctl ${action} ${name}`)

    const result = await this.getConnection(serverId).exec(command, ACTION_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      throw new CommandError(
        `systemctl ${action} ${name} failed`,
        (result.stderr || result.stdout).trim()
      )
    }
    if (action === 'start' || action === 'stop' || action === 'restart') {
      topologyService.invalidate(serverId)
    }
  }
}

export const systemdService = new SystemdService()
