import type { ProcessDetail, ProcessPort, ProcessState, ProcessSummary } from '@shared/processes'
import {
  CGROUP_BLOCK_PREFIX,
  parseCgroupBlocks,
  parseDockerPsIds,
  parseSsOutput,
  resolveContainerName
} from './portParsers'

export const PS_LIST_COMMAND =
  'ps -eo pid=,user=,pcpu=,pmem=,rss=,stat=,etimes=,comm=,args= --sort=-pcpu 2>/dev/null'

const PS_LINE =
  /^\s*(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\d+)\s+(\S+)(?:\s+(.*))?$/

export const SECTION_STATUS = '---RELAY:STATUS---'
export const SECTION_CMDLINE = '---RELAY:CMDLINE---'
export const SECTION_EXE = '---RELAY:EXE---'
export const SECTION_CWD = '---RELAY:CWD---'
export const SECTION_CGROUP = '---RELAY:CGROUP---'
export const SECTION_SS = '---RELAY:SS---'
export const SECTION_DOCKER = '---RELAY:DOCKER---'
export const SECTION_UNIT = '---RELAY:UNIT---'
export const SECTION_SSH_PIDS = '---RELAY:SSH-PIDS---'

/** Parses `ps -eo pid=,user=,pcpu=,pmem=,rss=,stat=,etimes=,comm=,args=` output. */
export function parsePsOutput(stdout: string): ProcessSummary[] {
  const processes: ProcessSummary[] = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const match = PS_LINE.exec(trimmed)
    if (!match) continue

    const pid = Number.parseInt(match[1], 10)
    const rssKb = Number.parseInt(match[5], 10)
    if (!Number.isInteger(pid) || pid <= 0) continue

    processes.push({
      pid,
      user: match[2],
      cpuPercent: Number.parseFloat(match[3]) || 0,
      memoryPercent: Number.parseFloat(match[4]) || 0,
      rssBytes: Number.isInteger(rssKb) ? rssKb * 1024 : 0,
      stat: match[6],
      elapsedSeconds: Number.parseInt(match[7], 10) || 0,
      comm: match[8],
      args: match[9]?.trim() ?? match[8]
    })
  }

  return processes
}

export interface ProcStatusFields {
  name: string
  state: ProcessState
  ppid: number
  uid: number
}

/** Parses `/proc/<pid>/status` key fields. */
export function parseProcStatus(content: string): ProcStatusFields {
  let name = ''
  let ppid = 0
  let uid = 0
  let state: ProcessState = 'unknown'

  for (const line of content.split('\n')) {
    if (line.startsWith('Name:')) {
      name = line.slice('Name:'.length).trim()
      continue
    }
    if (line.startsWith('State:')) {
      const letter = line.match(/State:\s*(\w)/)?.[1]
      state = mapProcState(letter)
      continue
    }
    if (line.startsWith('PPid:')) {
      ppid = Number.parseInt(line.slice('PPid:'.length).trim(), 10) || 0
      continue
    }
    if (line.startsWith('Uid:')) {
      const parts = line.slice('Uid:'.length).trim().split(/\s+/)
      uid = Number.parseInt(parts[0] ?? '', 10) || 0
    }
  }

  return { name, state, ppid, uid }
}

function mapProcState(letter: string | undefined): ProcessState {
  switch (letter) {
    case 'R':
      return 'running'
    case 'S':
    case 'D':
    case 'I':
      return 'sleeping'
    case 'T':
    case 't':
      return 'stopped'
    case 'Z':
      return 'zombie'
    default:
      return 'unknown'
  }
}

export function isKernelThread(comm: string, name?: string): boolean {
  const value = name || comm
  return value.startsWith('[') && value.endsWith(']')
}

export function isProtectedProcess(
  pid: number,
  comm: string,
  sshPids: Set<number>,
  name?: string
): { protected: boolean; reason?: string } {
  if (pid === 1) {
    return { protected: true, reason: 'PID 1 (init) cannot be signaled.' }
  }
  if (isKernelThread(comm, name)) {
    return { protected: true, reason: 'Kernel threads cannot be signaled.' }
  }
  if (sshPids.has(pid) || comm === 'sshd') {
    return { protected: true, reason: 'SSH server processes are protected to avoid lockout.' }
  }
  return { protected: false }
}

export function parseSshPids(stdout: string): number[] {
  const pids = new Set<number>()
  for (const line of stdout.split('\n')) {
    const pid = Number.parseInt(line.trim(), 10)
    if (Number.isInteger(pid) && pid > 0) pids.add(pid)
  }
  return [...pids]
}

export function filterPortsForPid(stdout: string, pid: number): ProcessPort[] {
  const listeners = parseSsOutput(stdout)
  const ports: ProcessPort[] = []

  for (const listener of listeners) {
    if (listener.pid !== pid) continue
    ports.push({
      protocol: listener.protocol,
      address: listener.address,
      port: listener.port
    })
  }

  return ports
}

export interface ProcessDetailSections {
  status: string
  cmdline: string
  exe: string
  cwd: string
  cgroup: string
  ss: string
  docker: string
  unitState: string
  sshPids: string
}

export function splitDetailSections(stdout: string): ProcessDetailSections {
  const sections: ProcessDetailSections = {
    status: '',
    cmdline: '',
    exe: '',
    cwd: '',
    cgroup: '',
    ss: '',
    docker: '',
    unitState: '',
    sshPids: ''
  }

  let current: keyof ProcessDetailSections | null = null
  const buffers = new Map<keyof ProcessDetailSections, string[]>()

  const push = (key: keyof ProcessDetailSections, line: string): void => {
    const existing = buffers.get(key)
    if (existing) {
      existing.push(line)
      return
    }
    buffers.set(key, [line])
  }

  const markers: Record<string, keyof ProcessDetailSections> = {
    [SECTION_STATUS]: 'status',
    [SECTION_CMDLINE]: 'cmdline',
    [SECTION_EXE]: 'exe',
    [SECTION_CWD]: 'cwd',
    [SECTION_CGROUP]: 'cgroup',
    [SECTION_SS]: 'ss',
    [SECTION_DOCKER]: 'docker',
    [SECTION_UNIT]: 'unitState',
    [SECTION_SSH_PIDS]: 'sshPids'
  }

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    const marker = line.trim()
    const next = markers[marker]
    if (next) {
      current = next
      continue
    }
    if (current) push(current, line)
  }

  for (const [key, lines] of buffers.entries()) {
    sections[key] = lines.join('\n').trim()
  }

  return sections
}

export function buildProcessDetail(
  summary: ProcessSummary,
  sections: ProcessDetailSections,
  unit: string | null
): ProcessDetail {
  const status = parseProcStatus(sections.status)
  const cgroupAttributions = parseCgroupBlocks(
    `${CGROUP_BLOCK_PREFIX}${summary.pid}---\n${sections.cgroup}`
  )
  const attribution = cgroupAttributions.get(summary.pid)
  const cgroupUnit = attribution?.unit ?? null
  const containerId = attribution?.containerId ?? null
  const containers = parseDockerPsIds(sections.docker)
  const containerName = containerId ? resolveContainerName(containerId, containers) : null
  const sshPids = new Set(parseSshPids(sections.sshPids))
  const protection = isProtectedProcess(summary.pid, summary.comm, sshPids, status.name)

  return {
    ...summary,
    ppid: status.ppid,
    state: status.state,
    uid: status.uid,
    cmdline: sections.cmdline || summary.args,
    exe: sections.exe || null,
    cwd: sections.cwd || null,
    cgroupUnit,
    containerId,
    containerName,
    unit: unit ?? cgroupUnit,
    unitActiveState: sections.unitState || null,
    listeningPorts: filterPortsForPid(sections.ss, summary.pid),
    protected: protection.protected,
    protectedReason: protection.reason
  }
}
