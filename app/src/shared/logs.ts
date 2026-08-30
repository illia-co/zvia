import type { ServerId } from './server'

export type LogPriority =
  | 'emerg'
  | 'alert'
  | 'crit'
  | 'err'
  | 'warning'
  | 'notice'
  | 'info'
  | 'debug'

/** @deprecated Use LogsQuery with timeRange presets instead. */
export interface LogFilters {
  since?: string
  until?: string
  priority?: LogPriority | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
  unit?: string
}

export type LogViewMode = 'live' | 'recent'

export type LogTimeRange = '15m' | '1h' | '6h' | '24h' | 'today' | 'all'

export interface LogsQuery {
  mode: LogViewMode
  lines: number
  timeRange?: LogTimeRange
  priority?: LogPriority | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
  unit?: string
  pid?: number
}

export interface LogEntry {
  id: string
  timestamp: number
  priority: number
  unit?: string
  message: string
  hostname?: string
  pid?: number
}

export type LogStreamStatus = 'idle' | 'streaming' | 'unavailable' | 'error'

export interface LogsStatusEvent {
  serverId: ServerId
  status: LogStreamStatus
  message?: string
}

export interface LogsEntriesEvent {
  serverId: ServerId
  entries: LogEntry[]
  /** When true, replace the client buffer instead of appending. */
  reset?: boolean
}

export interface LogsStartRequest {
  serverId: ServerId
  query?: Partial<LogsQuery>
  /** @deprecated Use query instead. */
  filters?: LogFilters
}

export interface LogsSetFiltersRequest {
  serverId: ServerId
  query: LogsQuery
  /** @deprecated Use query instead. */
  filters?: LogFilters
}
