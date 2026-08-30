import { useCallback, useEffect, useRef, useState } from 'react'
import type { LogEntry, LogsQuery, LogStreamStatus } from '@shared/logs'
import { DEFAULT_LOGS_QUERY, normalizeLogsQuery } from '@shared/logQuery'
import type { ServerId } from '@shared/server'
import type { ConnectionState } from '@shared/server'

const MAX_ENTRIES = 5000

interface UseLogsOptions {
  serverId: ServerId
  connectionState: ConnectionState
  initialQuery?: Partial<LogsQuery>
}

interface UseLogsResult {
  entries: LogEntry[]
  status: LogStreamStatus
  statusMessage?: string
  paused: boolean
  query: LogsQuery
  setQuery: (
    query: LogsQuery | Partial<LogsQuery>,
    options?: { resetFilters?: boolean }
  ) => void
  clearFilters: () => void
  pause: () => void
  resume: () => void
  refresh: () => void
  loadGeneration: number
  jumpToLatest: () => boolean
  copySelection: (entryIds: string[]) => Promise<void>
}

export function useLogs({ serverId, connectionState, initialQuery }: UseLogsOptions): UseLogsResult {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [status, setStatus] = useState<LogStreamStatus>('idle')
  const [statusMessage, setStatusMessage] = useState<string | undefined>()
  const [paused, setPaused] = useState(false)
  const [query, setQueryState] = useState(() =>
    normalizeLogsQuery({ ...DEFAULT_LOGS_QUERY, ...initialQuery })
  )
  const [loadGeneration, setLoadGeneration] = useState(0)
  const queryRef = useRef(query)
  queryRef.current = query
  const initialQueryRef = useRef(initialQuery)
  initialQueryRef.current = initialQuery

  const isConnected = connectionState === 'connected'

  useEffect(() => {
    const nextQuery = normalizeLogsQuery({ ...DEFAULT_LOGS_QUERY, ...initialQueryRef.current })
    queryRef.current = nextQuery
    setEntries([])
    setStatus('idle')
    setStatusMessage(undefined)
    setPaused(false)
    setQueryState(nextQuery)
    setLoadGeneration(0)
    void window.zvia.logs.stop({ serverId })
  }, [serverId])

  useEffect(() => {
    const unsubscribeEntries = window.zvia.logs.onEntries((event) => {
      if (event.serverId !== serverId) return

      setEntries((current) => {
        if (event.reset) {
          return event.entries.slice(-MAX_ENTRIES)
        }
        const next = [...current, ...event.entries]
        if (next.length <= MAX_ENTRIES) return next
        return next.slice(next.length - MAX_ENTRIES)
      })
    })

    const unsubscribeStatus = window.zvia.logs.onStatus((event) => {
      if (event.serverId !== serverId) return
      setStatus(event.status)
      setStatusMessage(event.message)
    })

    return () => {
      unsubscribeEntries()
      unsubscribeStatus()
    }
  }, [serverId])

  useEffect(() => {
    if (!isConnected) {
      void window.zvia.logs.stop({ serverId })
      return
    }

    void window.zvia.logs.start({ serverId, query: queryRef.current }).catch(() => {
      setStatus('error')
    })

    return () => {
      void window.zvia.logs.stop({ serverId })
    }
  }, [isConnected, serverId])

  const setQuery = useCallback(
    (next: LogsQuery | Partial<LogsQuery>, options?: { resetFilters?: boolean }) => {
      const merged = options?.resetFilters
        ? { mode: queryRef.current.mode, lines: queryRef.current.lines, ...next }
        : { ...queryRef.current, ...next }
      const normalized = normalizeLogsQuery(merged)
      setQueryState(normalized)
      setEntries([])
      setLoadGeneration((current) => current + 1)
      if (normalized.mode === 'recent') {
        setPaused(false)
      }
      if (!isConnected) return
      void window.zvia.logs.setFilters({ serverId, query: normalized })
    },
    [isConnected, serverId]
  )

  const clearFilters = useCallback(() => {
    setQuery({}, { resetFilters: true })
  }, [setQuery])

  const pause = useCallback(() => {
    setPaused(true)
  }, [])

  const resume = useCallback(() => {
    setPaused(false)
  }, [])

  const refresh = useCallback(() => {
    if (!isConnected) return
    setLoadGeneration((current) => current + 1)
    void window.zvia.logs.setFilters({ serverId, query: queryRef.current })
  }, [isConnected, serverId])

  const jumpToLatest = useCallback(() => {
    setPaused(false)
    return true
  }, [])

  const copySelection = useCallback(async (entryIds: string[]) => {
    const selected = entries.filter((entry) => entryIds.includes(entry.id))
    const text = selected.map((entry) => entry.message).join('\n')
    await navigator.clipboard.writeText(text)
  }, [entries])

  return {
    entries,
    status,
    statusMessage,
    paused,
    query,
    setQuery,
    clearFilters,
    pause,
    resume,
    refresh,
    loadGeneration,
    jumpToLatest,
    copySelection
  }
}
