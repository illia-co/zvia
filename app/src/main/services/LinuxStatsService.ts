import type {
  CpuStats,
  FilesystemStats,
  MemoryStats,
  NetworkInterfaceStats,
  ServerStatsSnapshot
} from '@shared/stats'
import { CommandError } from '@shared/errors'
import type { CommandRunner } from './CommandRunner'

const SECTION_MARKERS = {
  stat: '---RELAY:STAT---',
  mem: '---RELAY:MEM---',
  load: '---RELAY:LOAD---',
  uptime: '---RELAY:UPTIME---',
  net: '---RELAY:NET---',
  df: '---RELAY:DF---'
} as const

const STATS_COMMAND = [
  `echo '${SECTION_MARKERS.stat}'`,
  `head -n 64 /proc/stat`,
  `echo '${SECTION_MARKERS.mem}'`,
  `cat /proc/meminfo`,
  `echo '${SECTION_MARKERS.load}'`,
  `cat /proc/loadavg`,
  `echo '${SECTION_MARKERS.uptime}'`,
  `cat /proc/uptime`,
  `echo '${SECTION_MARKERS.net}'`,
  `cat /proc/net/dev`,
  `echo '${SECTION_MARKERS.df}'`,
  `df -P -B1 2>/dev/null | tail -n +2`
].join('\n')

export interface RawCpuSample {
  label: string
  total: number
  idle: number
}

export interface RawNetworkSample {
  name: string
  rxBytes: number
  txBytes: number
}

export interface RawStatsSample {
  timestamp: number
  uptimeSeconds: number
  cpu: RawCpuSample[]
  memory: MemoryStats
  loadAverage: [number, number, number]
  network: RawNetworkSample[]
  filesystems: FilesystemStats[]
}

function parseMeminfo(content: string): MemoryStats {
  const values = new Map<string, number>()

  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Za-z()]+):\s+(\d+)\s+kB$/)
    if (!match) continue
    values.set(match[1], Number.parseInt(match[2], 10) * 1024)
  }

  const totalBytes = values.get('MemTotal') ?? 0
  const freeBytes = values.get('MemFree') ?? 0
  const availableBytes = values.get('MemAvailable') ?? freeBytes
  const usedBytes = Math.max(0, totalBytes - availableBytes)
  const usagePercent = totalBytes > 0 ? (usedBytes / totalBytes) * 100 : 0

  const swapTotalBytes = values.get('SwapTotal') ?? 0
  const swapFreeBytes = values.get('SwapFree') ?? 0
  const swapUsedBytes = Math.max(0, swapTotalBytes - swapFreeBytes)
  const swapUsagePercent = swapTotalBytes > 0 ? (swapUsedBytes / swapTotalBytes) * 100 : 0

  return {
    totalBytes,
    usedBytes,
    freeBytes,
    availableBytes,
    usagePercent,
    swapTotalBytes,
    swapUsedBytes,
    swapUsagePercent
  }
}

function parseCpuLine(line: string): RawCpuSample | null {
  const parts = line.trim().split(/\s+/)
  if (parts.length < 5 || !parts[0].startsWith('cpu')) return null

  const values = parts.slice(1).map((value) => Number.parseInt(value, 10))
  if (values.some((value) => !Number.isFinite(value))) return null

  const user = values[0] ?? 0
  const nice = values[1] ?? 0
  const system = values[2] ?? 0
  const idle = values[3] ?? 0
  const iowait = values[4] ?? 0
  const irq = values[5] ?? 0
  const softirq = values[6] ?? 0
  const steal = values[7] ?? 0

  const idleTotal = idle + iowait
  const total = user + nice + system + idleTotal + irq + softirq + steal

  return { label: parts[0], total, idle: idleTotal }
}

function parseLoadAverage(content: string): [number, number, number] {
  const parts = content.trim().split(/\s+/)
  return [
    Number.parseFloat(parts[0] ?? '0'),
    Number.parseFloat(parts[1] ?? '0'),
    Number.parseFloat(parts[2] ?? '0')
  ]
}

function parseNetwork(content: string): RawNetworkSample[] {
  const interfaces: RawNetworkSample[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('Inter-') || trimmed.startsWith('face')) continue

    const colonIndex = trimmed.indexOf(':')
    if (colonIndex === -1) continue

    const name = trimmed.slice(0, colonIndex).trim()
    if (!name || name === 'lo') continue

    const fields = trimmed
      .slice(colonIndex + 1)
      .trim()
      .split(/\s+/)
      .map((value) => Number.parseInt(value, 10))

    if (fields.length < 16 || fields.some((value) => !Number.isFinite(value))) continue

    interfaces.push({
      name,
      rxBytes: fields[0] ?? 0,
      txBytes: fields[8] ?? 0
    })
  }

  return interfaces
}

function parseFilesystems(content: string): FilesystemStats[] {
  const filesystems: FilesystemStats[] = []

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const parts = trimmed.split(/\s+/)
    if (parts.length < 6) continue

    const device = parts[0]
    const totalBytes = Number.parseInt(parts[1], 10)
    const usedBytes = Number.parseInt(parts[2], 10)
    const availableBytes = Number.parseInt(parts[3], 10)
    const mount = parts.slice(5).join(' ')

    if (!Number.isFinite(totalBytes) || totalBytes <= 0) continue

    const usagePercent = (usedBytes / totalBytes) * 100
    filesystems.push({ device, mount, totalBytes, usedBytes, availableBytes, usagePercent })
  }

  return filesystems.sort((a, b) => a.mount.localeCompare(b.mount))
}

function splitSections(stdout: string): Map<string, string> {
  const sections = new Map<string, string>()
  const markerEntries = Object.entries(SECTION_MARKERS)
  let cursor = 0

  for (let index = 0; index < markerEntries.length; index += 1) {
    const [key, marker] = markerEntries[index]
    const start = stdout.indexOf(marker, cursor)
    if (start === -1) {
      throw new CommandError(`Missing stats section: ${key}`)
    }

    const contentStart = start + marker.length + 1
    const nextMarker = markerEntries[index + 1]?.[1]
    const end = nextMarker ? stdout.indexOf(nextMarker, contentStart) : stdout.length
    if (end === -1) {
      throw new CommandError(`Malformed stats section: ${key}`)
    }

    sections.set(key, stdout.slice(contentStart, end).trim())
    cursor = end
  }

  return sections
}

export class LinuxStatsService {
  constructor(private readonly runner: CommandRunner) {}

  async collectRawSample(): Promise<RawStatsSample> {
    const result = await this.runner.exec(STATS_COMMAND, 10_000)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to read server statistics', result.stderr || undefined)
    }

    const sections = splitSections(result.stdout)
    const cpu = (sections.get('stat') ?? '')
      .split('\n')
      .map(parseCpuLine)
      .filter((sample): sample is RawCpuSample => sample !== null)

    const uptimeSeconds = Number.parseFloat((sections.get('uptime') ?? '0').split(/\s+/)[0] ?? '0')

    return {
      timestamp: Date.now(),
      uptimeSeconds: Number.isFinite(uptimeSeconds) ? uptimeSeconds : 0,
      cpu,
      memory: parseMeminfo(sections.get('mem') ?? ''),
      loadAverage: parseLoadAverage(sections.get('load') ?? ''),
      network: parseNetwork(sections.get('net') ?? ''),
      filesystems: parseFilesystems(sections.get('df') ?? '')
    }
  }
}

export function computeCpuUsage(
  previous: RawCpuSample[] | null,
  current: RawCpuSample[]
): CpuStats {
  const cores: ServerStatsSnapshot['cpu']['cores'] = []
  let totalUsagePercent: number | null = null

  const previousByLabel = new Map(previous?.map((sample) => [sample.label, sample]) ?? [])

  for (const sample of current) {
    if (sample.label === 'cpu') {
      const prev = previousByLabel.get('cpu')
      if (prev) {
        const totalDelta = sample.total - prev.total
        const idleDelta = sample.idle - prev.idle
        totalUsagePercent =
          totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : null
      }
      continue
    }

    const coreMatch = sample.label.match(/^cpu(\d+)$/)
    if (!coreMatch) continue

    const coreIndex = Number.parseInt(coreMatch[1], 10)
    const prev = previousByLabel.get(sample.label)
    let usagePercent: number | null = null

    if (prev) {
      const totalDelta = sample.total - prev.total
      const idleDelta = sample.idle - prev.idle
      usagePercent = totalDelta > 0 ? ((totalDelta - idleDelta) / totalDelta) * 100 : null
    }

    cores.push({ coreIndex, usagePercent })
  }

  cores.sort((a, b) => a.coreIndex - b.coreIndex)

  return {
    totalUsagePercent,
    coreCount: cores.length,
    cores,
    loadAverage: [0, 0, 0]
  }
}

export function buildStatsSnapshot(
  raw: RawStatsSample,
  previous: RawStatsSample | null
): ServerStatsSnapshot {
  const cpuBase = computeCpuUsage(previous?.cpu ?? null, raw.cpu)
  const cpu: CpuStats = {
    ...cpuBase,
    loadAverage: raw.loadAverage
  }

  const previousNetwork = new Map(previous?.network.map((item) => [item.name, item]) ?? [])
  const elapsedSeconds =
    previous && raw.timestamp > previous.timestamp
      ? (raw.timestamp - previous.timestamp) / 1000
      : 0

  const network: NetworkInterfaceStats[] = raw.network.map((item) => {
    const prev = previousNetwork.get(item.name)
    let rxBytesPerSec: number | null = null
    let txBytesPerSec: number | null = null

    if (prev && elapsedSeconds > 0) {
      rxBytesPerSec = Math.max(0, (item.rxBytes - prev.rxBytes) / elapsedSeconds)
      txBytesPerSec = Math.max(0, (item.txBytes - prev.txBytes) / elapsedSeconds)
    }

    return {
      name: item.name,
      rxBytesPerSec,
      txBytesPerSec,
      rxBytesTotal: item.rxBytes,
      txBytesTotal: item.txBytes
    }
  })

  return {
    timestamp: raw.timestamp,
    cpu,
    memory: raw.memory,
    filesystems: raw.filesystems,
    network
  }
}
