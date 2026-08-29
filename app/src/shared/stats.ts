export interface SystemInfo {
  hostname: string
  osName: string
  osVersion: string
  architecture: string
  uptimeSeconds: number
}

export interface CpuCoreStats {
  coreIndex: number
  usagePercent: number | null
}

export interface CpuStats {
  totalUsagePercent: number | null
  coreCount: number
  cores: CpuCoreStats[]
  loadAverage: [number, number, number]
}

export interface MemoryStats {
  totalBytes: number
  usedBytes: number
  freeBytes: number
  availableBytes: number
  usagePercent: number
  swapTotalBytes: number
  swapUsedBytes: number
  swapUsagePercent: number
}

export interface FilesystemStats {
  mount: string
  device: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  usagePercent: number
}

export interface NetworkInterfaceStats {
  name: string
  rxBytesPerSec: number | null
  txBytesPerSec: number | null
  rxBytesTotal: number
  txBytesTotal: number
}

export interface ServerStatsSnapshot {
  timestamp: number
  cpu: CpuStats
  memory: MemoryStats
  filesystems: FilesystemStats[]
  network: NetworkInterfaceStats[]
}

export type StatsSubscriptionMode = 'overview' | 'stats'

export interface StatsUpdatePayload {
  info: SystemInfo
  stats: ServerStatsSnapshot
}
