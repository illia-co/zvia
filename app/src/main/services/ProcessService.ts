import type { BrowserWindow } from 'electron'
import type { ServerId } from '@shared/server'
import type {
  ProcessDetail,
  ProcessSignal,
  ProcessSummary,
  ProcessesSubscriptionInterval
} from '@shared/processes'
import {
  CommandError,
  ConnectionError,
  PrivilegeRequiredError,
  ZviaError,
  ValidationError
} from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { profileStore } from '../store/profiles'
import { privilegeService } from './PrivilegeService'
import {
  PS_LIST_COMMAND,
  SECTION_CMDLINE,
  SECTION_CGROUP,
  SECTION_CWD,
  SECTION_DOCKER,
  SECTION_EXE,
  SECTION_SSH_PIDS,
  SECTION_SS,
  SECTION_STATUS,
  SECTION_UNIT,
  buildProcessDetail,
  isProtectedProcess,
  parsePsOutput,
  parseSshPids,
  splitDetailSections
} from './processesParsers'
import { CGROUP_BLOCK_PREFIX, parseCgroupBlocks } from './portParsers'

const DEFAULT_INTERVAL_MS: ProcessesSubscriptionInterval = 2000

interface Subscriber {
  subscriberId: string
  intervalMs: ProcessesSubscriptionInterval
}

interface ServerSubscriptionState {
  subscribers: Map<string, Subscriber>
  timer: NodeJS.Timeout | null
  intervalMs: ProcessesSubscriptionInterval
  isPolling: boolean
}

function assertPid(pid: number): number {
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new ValidationError('Invalid pid: expected positive integer')
  }
  return pid
}

function buildDetailCommand(pid: number, unit: string | null): string {
  const unitShow = unit
    ? `echo '${SECTION_UNIT}'; systemctl show -p ActiveState --value ${unit} 2>/dev/null`
    : `echo '${SECTION_UNIT}'`

  return [
    `pid=${pid}`,
    `echo '${SECTION_STATUS}'`,
    `cat /proc/$pid/status 2>/dev/null`,
    `echo '${SECTION_CMDLINE}'`,
    `tr '\\0' ' ' < /proc/$pid/cmdline 2>/dev/null; echo`,
    `echo '${SECTION_EXE}'`,
    `readlink /proc/$pid/exe 2>/dev/null`,
    `echo '${SECTION_CWD}'`,
    `readlink /proc/$pid/cwd 2>/dev/null`,
    `echo '${SECTION_CGROUP}'`,
    `cat /proc/$pid/cgroup 2>/dev/null`,
    `echo '${SECTION_SS}'`,
    'ss -tulpnH 2>/dev/null',
    `echo '${SECTION_DOCKER}'`,
    "docker ps --format '{{.ID}} {{.Names}}' 2>/dev/null",
    unitShow,
    `echo '${SECTION_SSH_PIDS}'`,
    'pid=$$; while [ -n "$pid" ] && [ "$pid" -gt 0 ]; do',
    '  comm=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d " ");',
    '  if [ "$comm" = "sshd" ]; then echo "$pid"; fi;',
    '  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d " ");',
    '  [ -z "$ppid" ] || [ "$ppid" = "$pid" ] && break;',
    '  pid=$ppid;',
    'done',
    'pgrep -x sshd 2>/dev/null'
  ].join('\n')
}

export class ProcessService {
  private servers = new Map<ServerId, ServerSubscriptionState>()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  async list(serverId: ServerId): Promise<ProcessSummary[]> {
    this.ensureConnected(serverId)
    return this.fetchList(serverId)
  }

  async get(serverId: ServerId, pid: number): Promise<ProcessDetail> {
    this.ensureConnected(serverId)
    const validPid = assertPid(pid)
    const summaries = await this.fetchList(serverId)
    const summary = summaries.find((entry) => entry.pid === validPid)
    if (!summary) {
      throw new ZviaError('NOT_FOUND', `Process ${validPid} is no longer running`)
    }

    const sections = await this.fetchDetailSections(serverId, validPid, summary)
    return buildProcessDetail(summary, sections, sections.unit)
  }

  subscribe(
    serverId: ServerId,
    subscriberId: string,
    intervalMs: ProcessesSubscriptionInterval = DEFAULT_INTERVAL_MS
  ): void {
    this.ensureConnected(serverId)
    const state = this.getOrCreateState(serverId)
    state.subscribers.set(subscriberId, { subscriberId, intervalMs })
    this.reschedule(serverId)
    void this.poll(serverId)
  }

  unsubscribe(serverId: ServerId, subscriberId: string): void {
    const state = this.servers.get(serverId)
    if (!state) return

    state.subscribers.delete(subscriberId)
    if (state.subscribers.size === 0) {
      this.clearServer(serverId)
      return
    }

    this.reschedule(serverId)
  }

  async signal(serverId: ServerId, pid: number, signal: ProcessSignal): Promise<void> {
    this.ensureConnected(serverId)
    const validPid = assertPid(pid)
    const summaries = await this.fetchList(serverId)
    const summary = summaries.find((entry) => entry.pid === validPid)
    if (!summary) {
      throw new ZviaError('NOT_FOUND', `Process ${validPid} is no longer running`)
    }

    const sshPids = new Set(await this.fetchSshPids(serverId))
    const protection = isProtectedProcess(validPid, summary.comm, sshPids)
    if (protection.protected) {
      throw new ValidationError(protection.reason ?? 'This process cannot be signaled')
    }

    const sigFlag = signal === 'kill' ? '-KILL' : '-TERM'
    const baseCommand = `kill ${sigFlag} ${validPid}`
    const context = await privilegeService.getContext(serverId)
    const connectedUser = profileStore.get(serverId).username

    let command = baseCommand
    if (!context.isRoot && summary.user !== connectedUser) {
      command = privilegeService.buildPrivileged(context, baseCommand)
    }

    const result = await connectionManager.exec(serverId, command, 15000)
    if (result.exitCode !== 0) {
      const stderr = result.stderr.trim()
      if (/operation not permitted|not allowed/i.test(stderr)) {
        throw new PrivilegeRequiredError(
          'Elevated privileges are required to signal this process',
          privilegeService.buildPrivileged(
            { isRoot: false, canSudoNonInteractive: true },
            baseCommand
          )
        )
      }
      throw new CommandError(
        `Failed to signal process ${validPid}`,
        stderr || result.stdout.trim() || undefined
      )
    }
  }

  clearServer(serverId: ServerId): void {
    const state = this.servers.get(serverId)
    if (!state) return

    if (state.timer) {
      clearInterval(state.timer)
    }
    this.servers.delete(serverId)
  }

  private ensureConnected(serverId: ServerId): void {
    if (connectionManager.getState(serverId) !== 'connected') {
      throw new ConnectionError('Server is not connected')
    }
  }

  private getOrCreateState(serverId: ServerId): ServerSubscriptionState {
    const existing = this.servers.get(serverId)
    if (existing) return existing

    const state: ServerSubscriptionState = {
      subscribers: new Map(),
      timer: null,
      intervalMs: DEFAULT_INTERVAL_MS,
      isPolling: false
    }
    this.servers.set(serverId, state)
    return state
  }

  private getDesiredInterval(state: ServerSubscriptionState): ProcessesSubscriptionInterval {
    let interval: ProcessesSubscriptionInterval = DEFAULT_INTERVAL_MS
    for (const subscriber of state.subscribers.values()) {
      if (subscriber.intervalMs < interval) {
        interval = subscriber.intervalMs
      }
    }
    return interval
  }

  private reschedule(serverId: ServerId): void {
    const state = this.servers.get(serverId)
    if (!state || state.subscribers.size === 0) return

    const nextInterval = this.getDesiredInterval(state)
    if (nextInterval === state.intervalMs && state.timer) return

    if (state.timer) {
      clearInterval(state.timer)
    }

    state.intervalMs = nextInterval
    state.timer = setInterval(() => {
      void this.poll(serverId)
    }, nextInterval)
  }

  private async poll(serverId: ServerId): Promise<void> {
    const state = this.servers.get(serverId)
    if (!state || state.subscribers.size === 0 || state.isPolling) return

    if (connectionManager.getState(serverId) !== 'connected') {
      this.clearServer(serverId)
      return
    }

    state.isPolling = true
    try {
      const processes = await this.fetchList(serverId)
      this.emitUpdate(serverId, processes)
    } catch {
      // Transient polling failures are ignored; the next interval will retry.
    } finally {
      state.isPolling = false
    }
  }

  private async fetchList(serverId: ServerId): Promise<ProcessSummary[]> {
    const result = await connectionManager.exec(serverId, PS_LIST_COMMAND, 30000)
    if (result.exitCode !== 0 && !result.stdout.trim()) {
      throw new CommandError(
        'Could not list processes',
        result.stderr.trim() || undefined
      )
    }
    return parsePsOutput(result.stdout)
  }

  private async fetchSshPids(serverId: ServerId): Promise<number[]> {
    const command = [
      `echo '${SECTION_SSH_PIDS}'`,
      'pid=$$; while [ -n "$pid" ] && [ "$pid" -gt 0 ]; do',
      '  comm=$(ps -o comm= -p "$pid" 2>/dev/null | tr -d " ");',
      '  if [ "$comm" = "sshd" ]; then echo "$pid"; fi;',
      '  ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d " ");',
      '  [ -z "$ppid" ] || [ "$ppid" = "$pid" ] && break;',
      '  pid=$ppid;',
      'done',
      'pgrep -x sshd 2>/dev/null'
    ].join('\n')

    const result = await connectionManager.exec(serverId, command, 10000)
    const sections = splitDetailSections(`${SECTION_SSH_PIDS}\n${result.stdout}`)
    return parseSshPids(sections.sshPids)
  }

  private async fetchDetailSections(
    serverId: ServerId,
    pid: number,
    _summary: ProcessSummary
  ): Promise<ReturnType<typeof splitDetailSections> & { unit: string | null }> {
    const cgroupResult = await connectionManager.exec(
      serverId,
      `cat /proc/${pid}/cgroup 2>/dev/null`,
      5000
    )
    const cgroupAttributions = parseCgroupBlocks(
      `${CGROUP_BLOCK_PREFIX}${pid}---\n${cgroupResult.stdout}`
    )
    const unit = cgroupAttributions.get(pid)?.unit ?? null

    const result = await connectionManager.exec(serverId, buildDetailCommand(pid, unit), 30000)
    if (result.exitCode !== 0 && !result.stdout.includes(SECTION_STATUS)) {
      throw new CommandError(
        `Could not read details for process ${pid}`,
        result.stderr.trim() || undefined
      )
    }

    const sections = splitDetailSections(result.stdout)
    return { ...sections, unit }
  }

  private emitUpdate(serverId: ServerId, processes: ProcessSummary[]): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) return
    this.mainWindow.webContents.send('processes:update', {
      serverId,
      processes,
      capturedAt: new Date().toISOString()
    })
  }
}

export const processService = new ProcessService()
connectionManager.registerTeardown((serverId) => processService.clearServer(serverId))
