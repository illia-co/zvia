import type { LogTimeRange, LogsQuery } from './logs'

export const DEFAULT_LOGS_QUERY: LogsQuery = {
  mode: 'live',
  lines: 500
}

export const LOG_LINE_PRESETS = [100, 500, 1000, 2000, 5000] as const

export function mapTimeRangeToSince(timeRange: LogTimeRange | undefined): string | undefined {
  switch (timeRange) {
    case '15m':
      return '15 minutes ago'
    case '1h':
      return '1 hour ago'
    case '6h':
      return '6 hours ago'
    case '24h':
      return '24 hours ago'
    case 'today':
      return 'today'
    case 'all':
    default:
      return undefined
  }
}

export function normalizeLogsQuery(partial?: Partial<LogsQuery>): LogsQuery {
  const query: LogsQuery = {
    mode: partial?.mode ?? DEFAULT_LOGS_QUERY.mode,
    lines: partial?.lines ?? DEFAULT_LOGS_QUERY.lines
  }

  if (partial?.timeRange !== undefined) {
    query.timeRange = partial.timeRange
  }
  if (partial?.priority !== undefined) {
    query.priority = partial.priority
  }
  if (partial?.unit !== undefined) {
    query.unit = partial.unit
  }

  return query
}
