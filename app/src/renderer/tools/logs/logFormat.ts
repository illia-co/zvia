import type { LogEntry } from '@shared/logs'

const PRIORITY_LABELS: Record<number, string> = {
  0: 'EMERG',
  1: 'ALERT',
  2: 'CRIT',
  3: 'ERR',
  4: 'WARN',
  5: 'NOTE',
  6: 'INFO',
  7: 'DEBUG'
}

export function formatLogTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

export function formatLogPriority(priority: number): string {
  return PRIORITY_LABELS[priority] ?? 'INFO'
}

export function formatLogLine(entry: LogEntry): string {
  const parts = [
    formatLogTimestamp(entry.timestamp),
    formatLogPriority(entry.priority).padEnd(5),
    entry.unit ? entry.unit.padEnd(24).slice(0, 24) : ''.padEnd(24),
    entry.message
  ]
  return parts.join('  ')
}

export function entryMatchesSearch(entry: LogEntry, query: string): boolean {
  if (!query) return true
  const haystack = [
    entry.message,
    entry.unit,
    entry.hostname,
    formatLogPriority(entry.priority),
    formatLogTimestamp(entry.timestamp)
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(query.toLowerCase())
}
