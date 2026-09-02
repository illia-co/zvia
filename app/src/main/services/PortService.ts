import type { ServerId } from '@shared/server'
import type {
  FirewallBackend,
  FirewallRule,
  FirewallRuleAction,
  FirewallState,
  PortListener,
  PortProtocol,
  PortsSnapshot
} from '@shared/ports'
import { FIREWALL_NO_BACKEND_REASON } from '@shared/ports'
import { CommandError, ConnectionError, PrivilegeRequiredError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { getServerConnection } from './ServiceBase'
import { profileStore } from '../store/profiles'
import { privilegeService } from './PrivilegeService'
import {
  CGROUP_BLOCK_PREFIX,
  classifyExposure,
  dedupeListeners,
  parseCgroupBlocks,
  parseDockerPsIds,
  parseIptablesRules,
  parseLsofOutput,
  parseNftRules,
  parseSsOutput,
  parseUfwStatus,
  resolveContainerName,
  ruleCoversPort,
  ruleScopeIsUnknown,
  ufwVerdictForPort,
  type RawListener,
  type UfwState
} from './portParsers'

const BACKEND_CACHE_TTL_MS = 60000
const FIREWALL_CACHE_TTL_MS = 10000

const VERBOSE_MARKER = '---RELAY:UFW-VERBOSE---'
const NUMBERED_MARKER = '---RELAY:UFW-NUMBERED---'

interface CachedBackend {
  backend: FirewallBackend
  checkedAt: number
}

interface CachedFirewall {
  state: FirewallState
  ufw: UfwState | null
  checkedAt: number
}

function sectionBetween(stdout: string, start: string, end?: string): string {
  const startIndex = stdout.indexOf(start)
  if (startIndex === -1) return ''
  const from = startIndex + start.length
  if (!end) return stdout.slice(from)
  const endIndex = stdout.indexOf(end, from)
  return endIndex === -1 ? stdout.slice(from) : stdout.slice(from, endIndex)
}

function assertPortNumber(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ValidationError('Invalid port: expected integer between 1 and 65535')
  }
  return value
}

function assertProtocol(value: string): PortProtocol {
  if (value !== 'tcp' && value !== 'udp') {
    throw new ValidationError('Invalid protocol: expected tcp or udp')
  }
  return value
}

function assertRuleId(value: string): string {
  if (!/^\d{1,4}$/.test(value)) {
    throw new ValidationError('Invalid firewall rule id: expected ufw rule number')
  }
  return value
}

export class PortService {
  private backendCache = new Map<ServerId, CachedBackend>()
  private firewallCache = new Map<ServerId, CachedFirewall>()

  private getConnection(serverId: ServerId) {
    return getServerConnection(serverId)
  }

  private async exec(serverId: ServerId, command: string, timeoutMs = 20000) {
    return this.getConnection(serverId).exec(command, timeoutMs)
  }

  /**
   * Elevates a fixed command template when possible, but falls back to running
   * it unprivileged rather than failing — read paths degrade, they do not break.
   */
  private async elevateIfPossible(serverId: ServerId, command: string): Promise<string> {
    try {
      const context = await privilegeService.getContext(serverId)
      return privilegeService.buildPrivileged(context, command)
    } catch {
      return command
    }
  }

  /** Throws PrivilegeRequiredError when the command cannot be elevated. */
  private async requireElevation(serverId: ServerId, command: string): Promise<string> {
    const context = await privilegeService.getContext(serverId)
    return privilegeService.buildPrivileged(context, command)
  }

  /**
   * Elevated attempts come first because unprivileged `ss` hides the process
   * behind other users' sockets, but every elevated form has a plain fallback
   * so a restricted sudoers file degrades instead of breaking the tool.
   */
  private async collectListeners(
    serverId: ServerId
  ): Promise<{ listeners: RawListener[]; source: 'ss' | 'lsof' }> {
    const candidates: { command: string; source: 'ss' | 'lsof' }[] = []

    for (const base of ['ss -tulpnH', 'ss -tulpn', 'lsof -nP -iTCP -sTCP:LISTEN -iUDP']) {
      const source = base.startsWith('ss') ? 'ss' : 'lsof'
      const elevated = await this.elevateIfPossible(serverId, base)
      if (elevated !== base) candidates.push({ command: elevated, source })
      candidates.push({ command: base, source })
    }

    for (const candidate of candidates) {
      const result = await this.exec(serverId, `${candidate.command} 2>/dev/null`)
      if (result.exitCode !== 0 || !result.stdout.trim()) continue
      return {
        listeners:
          candidate.source === 'ss'
            ? parseSsOutput(result.stdout)
            : parseLsofOutput(result.stdout),
        source: candidate.source
      }
    }

    throw new CommandError(
      'Could not enumerate listening ports',
      'Neither ss nor lsof produced output on this server.'
    )
  }

  private async attributeListeners(
    serverId: ServerId,
    listeners: RawListener[]
  ): Promise<PortListener[]> {
    const pids = [...new Set(listeners.map((listener) => listener.pid))].filter(
      (pid): pid is number => Number.isInteger(pid) && pid !== null && pid > 0
    )

    let attributions = new Map<number, { unit: string | null; containerId: string | null }>()
    if (pids.length > 0) {
      const command = pids
        .map((pid) => `echo '${CGROUP_BLOCK_PREFIX}${pid}---'; cat /proc/${pid}/cgroup 2>/dev/null`)
        .join('; ')
      const result = await this.exec(serverId, command)
      attributions = parseCgroupBlocks(result.stdout)
    }

    const hasContainers = [...attributions.values()].some((entry) => entry.containerId)
    let containers: { id: string; name: string }[] = []
    if (hasContainers) {
      try {
        const result = await this.exec(serverId, "docker ps --format '{{.ID}} {{.Names}}'", 10000)
        if (result.exitCode === 0) {
          containers = parseDockerPsIds(result.stdout)
        }
      } catch {
        // Container names are a convenience; the ID is still shown without them.
      }
    }

    return listeners.map((listener) => {
      const attribution = listener.pid === null ? undefined : attributions.get(listener.pid)
      const containerId = attribution?.containerId ?? null
      return {
        protocol: listener.protocol,
        address: listener.address,
        port: listener.port,
        pid: listener.pid,
        process: listener.process,
        exposure: classifyExposure(listener.address),
        unit: attribution?.unit ?? null,
        containerId,
        containerName: containerId ? resolveContainerName(containerId, containers) : null,
        firewall: 'unknown'
      }
    })
  }

  private async detectBackend(serverId: ServerId): Promise<FirewallBackend> {
    const cached = this.backendCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < BACKEND_CACHE_TTL_MS) {
      return cached.backend
    }

    const result = await this.exec(
      serverId,
      [
        'command -v ufw >/dev/null 2>&1 && echo ufw',
        'command -v nft >/dev/null 2>&1 && echo nft',
        'command -v iptables >/dev/null 2>&1 && echo iptables'
      ].join('; ')
    )

    const available = new Set(
      result.stdout
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    )

    const backend: FirewallBackend = available.has('ufw')
      ? 'ufw'
      : available.has('nft')
        ? 'nftables'
        : available.has('iptables')
          ? 'iptables'
          : 'none'

    this.backendCache.set(serverId, { backend, checkedAt: Date.now() })
    return backend
  }

  private async readUfwState(serverId: ServerId): Promise<CachedFirewall> {
    let verboseCommand: string
    let numberedCommand: string
    try {
      verboseCommand = await this.requireElevation(serverId, 'ufw status verbose')
      numberedCommand = await this.requireElevation(serverId, 'ufw status numbered')
    } catch (error) {
      const reason =
        error instanceof PrivilegeRequiredError
          ? 'Reading the ufw ruleset requires root or passwordless sudo.'
          : 'Could not read the ufw ruleset.'
      return {
        state: {
          backend: 'ufw',
          status: 'unknown',
          defaultIncoming: 'unknown',
          editable: false,
          rules: [],
          unavailableReason: reason,
          inspectCommand: 'sudo ufw status verbose'
        },
        ufw: null,
        checkedAt: Date.now()
      }
    }

    const result = await this.exec(
      serverId,
      `echo '${VERBOSE_MARKER}'; ${verboseCommand} 2>&1; echo '${NUMBERED_MARKER}'; ${numberedCommand} 2>&1`
    )

    const ufw = parseUfwStatus(
      sectionBetween(result.stdout, VERBOSE_MARKER, NUMBERED_MARKER),
      sectionBetween(result.stdout, NUMBERED_MARKER)
    )

    const state: FirewallState = {
      backend: 'ufw',
      status: ufw.status,
      defaultIncoming: ufw.defaultIncoming,
      editable: ufw.status !== 'unknown',
      rules: ufw.rules,
      inspectCommand: 'sudo ufw status verbose'
    }
    if (ufw.status === 'unknown') {
      state.unavailableReason = 'ufw did not report a status.'
    }

    return { state, ufw, checkedAt: Date.now() }
  }

  private async readReadOnlyBackend(
    serverId: ServerId,
    backend: 'nftables' | 'iptables'
  ): Promise<CachedFirewall> {
    const listCommand = backend === 'nftables' ? 'nft list ruleset' : 'iptables -S'
    const inspectCommand = `sudo ${listCommand}`

    let elevated: string
    try {
      elevated = await this.requireElevation(serverId, listCommand)
    } catch {
      return {
        state: {
          backend,
          status: 'unknown',
          defaultIncoming: 'unknown',
          editable: false,
          rules: [],
          unavailableReason: `Reading the ${backend} ruleset requires root or passwordless sudo.`,
          inspectCommand
        },
        ufw: null,
        checkedAt: Date.now()
      }
    }

    const result = await this.exec(serverId, `${elevated} 2>/dev/null`)
    const rules: FirewallRule[] =
      backend === 'nftables' ? parseNftRules(result.stdout) : parseIptablesRules(result.stdout)

    return {
      state: {
        backend,
        status: result.exitCode !== 0 ? 'unknown' : rules.length > 0 ? 'active' : 'inactive',
        defaultIncoming: 'unknown',
        editable: false,
        rules,
        unavailableReason:
          result.exitCode !== 0 ? `Could not read the ${backend} ruleset.` : undefined,
        inspectCommand
      },
      ufw: null,
      checkedAt: Date.now()
    }
  }

  private async readFirewall(serverId: ServerId): Promise<CachedFirewall> {
    const cached = this.firewallCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < FIREWALL_CACHE_TTL_MS) {
      return cached
    }

    const backend = await this.detectBackend(serverId)
    let snapshot: CachedFirewall

    if (backend === 'ufw') {
      snapshot = await this.readUfwState(serverId)
    } else if (backend === 'nftables' || backend === 'iptables') {
      snapshot = await this.readReadOnlyBackend(serverId, backend)
    } else {
      snapshot = {
        state: {
          backend: 'none',
          status: 'inactive',
          defaultIncoming: 'unknown',
          editable: false,
          rules: [],
          unavailableReason: FIREWALL_NO_BACKEND_REASON
        },
        ufw: null,
        checkedAt: Date.now()
      }
    }

    this.firewallCache.set(serverId, snapshot)
    return snapshot
  }

  private getSshPort(serverId: ServerId): number {
    return profileStore.get(serverId).port
  }

  async list(serverId: ServerId): Promise<PortsSnapshot> {
    const { listeners, source } = await this.collectListeners(serverId)
    const attributed = await this.attributeListeners(serverId, dedupeListeners(listeners))
    const firewall = await this.readFirewall(serverId)

    const withVerdicts = attributed.map((listener) => ({
      ...listener,
      firewall: firewall.ufw
        ? ufwVerdictForPort(firewall.ufw, listener.port, listener.protocol)
        : ('unknown' as const)
    }))

    withVerdicts.sort((a, b) => a.port - b.port || a.protocol.localeCompare(b.protocol))

    return {
      listeners: withVerdicts,
      firewall: firewall.state,
      sshPort: this.getSshPort(serverId),
      source
    }
  }

  /**
   * Refuses any rule that could affect the port this SSH session depends on.
   * This is a service-layer guard, not a UI warning.
   */
  private assertNoSshLockout(serverId: ServerId, port: number, protocol: PortProtocol): void {
    const sshPort = this.getSshPort(serverId)
    if (protocol === 'tcp' && port === sshPort) {
      throw new ValidationError(
        `Refusing to change firewall rules for port ${sshPort}: it is the SSH port for this server.`,
        'Change SSH firewall rules from the Terminal, where you can verify access before disconnecting.'
      )
    }
  }

  async setRule(
    serverId: ServerId,
    action: FirewallRuleAction,
    port: number,
    protocol: PortProtocol
  ): Promise<void> {
    const validPort = assertPortNumber(port)
    const validProtocol = assertProtocol(protocol)
    this.assertNoSshLockout(serverId, validPort, validProtocol)

    const backend = await this.detectBackend(serverId)
    if (backend !== 'ufw') {
      throw new ValidationError(
        'Firewall rule changes are only supported for ufw in this version.',
        `Detected backend: ${backend}`
      )
    }

    const verb = action === 'allow' ? 'allow' : 'deny'
    const command = await this.requireElevation(
      serverId,
      `ufw ${verb} ${validPort}/${validProtocol}`
    )
    const result = await this.exec(serverId, `${command} 2>&1`)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to update the firewall rule', result.stdout.trim())
    }
    this.firewallCache.delete(serverId)
  }

  async deleteRule(serverId: ServerId, ruleId: string): Promise<void> {
    const validRuleId = assertRuleId(ruleId)

    const backend = await this.detectBackend(serverId)
    if (backend !== 'ufw') {
      throw new ValidationError(
        'Firewall rule changes are only supported for ufw in this version.',
        `Detected backend: ${backend}`
      )
    }

    const firewall = await this.readFirewall(serverId)
    const rule = firewall.state.rules.find((candidate) => candidate.id === validRuleId)
    if (!rule) {
      throw new ValidationError(`Firewall rule ${validRuleId} no longer exists`)
    }

    const sshPort = this.getSshPort(serverId)
    if (ruleScopeIsUnknown(rule)) {
      throw new ValidationError(
        `Refusing to delete rule ${validRuleId}: its port scope could not be determined.`,
        `Rule: ${rule.raw}`
      )
    }
    if (ruleCoversPort(rule, sshPort, 'tcp')) {
      throw new ValidationError(
        `Refusing to delete rule ${validRuleId}: it covers SSH port ${sshPort}.`,
        `Rule: ${rule.raw}`
      )
    }

    const command = await this.requireElevation(serverId, `ufw --force delete ${validRuleId}`)
    const result = await this.exec(serverId, `${command} 2>&1`)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to delete the firewall rule', result.stdout.trim())
    }
    this.firewallCache.delete(serverId)
  }

  clearServer(serverId: ServerId): void {
    this.backendCache.delete(serverId)
    this.firewallCache.delete(serverId)
  }
}

export const portService = new PortService()
connectionManager.registerTeardown((serverId) => portService.clearServer(serverId))
