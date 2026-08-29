import type { ProcessSummary } from '@shared/processes'
import { cn } from '@renderer/lib/utils'

export type ProcessFilter = 'all' | 'high-cpu' | 'high-memory' | 'running' | 'my-user'

export type ProcessSortKey =
  | 'cpuPercent'
  | 'memoryPercent'
  | 'comm'
  | 'pid'
  | 'user'
  | 'elapsedSeconds'

export interface ProcessThresholds {
  cpuPercent: number
  memoryMb: number
}

export const DEFAULT_PROCESS_THRESHOLDS: ProcessThresholds = {
  cpuPercent: 50,
  memoryMb: 500
}

export function formatCpuPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatMemoryPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function formatRss(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} KB`
  }
  return `${bytes} B`
}

export function formatRuntime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days}d`
}

export function isProcessRunning(stat: string): boolean {
  return stat.includes('R') || stat.includes('S') || stat.includes('D')
}

export function matchesProcessFilter(
  process: ProcessSummary,
  filter: ProcessFilter,
  thresholds: ProcessThresholds,
  connectedUser: string
): boolean {
  switch (filter) {
    case 'high-cpu':
      return process.cpuPercent > thresholds.cpuPercent
    case 'high-memory':
      return process.rssBytes > thresholds.memoryMb * 1024 * 1024
    case 'running':
      return isProcessRunning(process.stat)
    case 'my-user':
      return process.user === connectedUser
    default:
      return true
  }
}

export function compareProcesses(
  left: ProcessSummary,
  right: ProcessSummary,
  sortKey: ProcessSortKey,
  direction: 'asc' | 'desc'
): number {
  const factor = direction === 'asc' ? 1 : -1

  if (sortKey === 'comm' || sortKey === 'user') {
    return factor * left[sortKey].localeCompare(right[sortKey])
  }

  const leftValue = left[sortKey]
  const rightValue = right[sortKey]
  if (leftValue === rightValue) return left.pid - right.pid
  return factor * (leftValue < rightValue ? -1 : 1)
}

export function processDisplayName(process: ProcessSummary): string {
  return process.comm || process.args || `pid ${process.pid}`
}

export function isProcessNoteworthy(
  process: ProcessSummary,
  thresholds: ProcessThresholds
): boolean {
  return (
    process.cpuPercent > thresholds.cpuPercent ||
    process.rssBytes > thresholds.memoryMb * 1024 * 1024
  )
}

export const PROCESS_FILTERS: { id: ProcessFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'high-cpu', label: 'High CPU' },
  { id: 'high-memory', label: 'High Memory' },
  { id: 'running', label: 'Running' },
  { id: 'my-user', label: 'My User' }
]

export const PROCESS_INTERVAL_OPTIONS = [
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' }
] as const

export function sortIndicator(active: boolean, direction: 'asc' | 'desc'): string {
  if (!active) return ''
  return direction === 'asc' ? ' ↑' : ' ↓'
}

export function liveLabel(paused: boolean): string {
  return paused ? '● Paused' : '● Live'
}

export function cnSortableHeader(active: boolean): string {
  return cn(
    'cursor-pointer select-none hover:text-text',
    active && 'text-text'
  )
}
