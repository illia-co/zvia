import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { Button } from '@renderer/components/ui/button'
import { useServerStore } from '@renderer/state/serverStore'
import { useToolIntent } from '@renderer/state/navigationStore'
import { LogFiltersBar } from './LogFiltersBar'
import { LogList } from './LogList'
import { useLogs } from './useLogs'

function formatHeaderStatus(
  mode: 'live' | 'recent',
  status: string,
  paused: boolean,
  lines: number
): string {
  if (mode === 'live') {
    if (paused) return 'Live · Paused'
    if (status === 'streaming') return 'Live · Streaming'
    return `Live · ${status}`
  }
  if (status === 'streaming') return 'Recent · Loading'
  return `Recent · ${lines} lines`
}

export function LogsPanel() {
  const { server, serverId, connectionState } = useRequiredServerContext()
  const connect = useServerStore((s) => s.connect)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [serviceUnits, setServiceUnits] = useState<string[]>([])

  const {
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
  } = useLogs({ serverId, connectionState })

  const logsIntent = useToolIntent('logs')

  useEffect(() => {
    if (!logsIntent?.unit) return
    setQuery({ unit: logsIntent.unit })
  }, [logsIntent?.unit, setQuery])

  useEffect(() => {
    if (connectionState !== 'connected') {
      setServiceUnits([])
      return
    }

    let cancelled = false
    void window.relay.services.list({ serverId }).then((units) => {
      if (cancelled) return
      setServiceUnits(units.map((unit) => unit.unit))
    })

    return () => {
      cancelled = true
    }
  }, [connectionState, serverId])

  const availableUnits = useMemo(() => {
    const units = new Set(serviceUnits)
    for (const entry of entries) {
      if (entry.unit) units.add(entry.unit)
    }
    return [...units]
  }, [entries, serviceUnits])

  const isConnected = connectionState === 'connected'
  const isUnavailable = status === 'unavailable'
  const isDisconnected =
    connectionState === 'disconnected' ||
    connectionState === 'error' ||
    connectionState === 'reconnecting'

  const selectedList = useMemo(() => [...selectedIds], [selectedIds])

  const handleToggleSelect = useCallback((entryId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }, [])

  const handleCopy = useCallback(() => {
    if (selectedList.length === 0) return
    void copySelection(selectedList)
  }, [copySelection, selectedList])

  const handleClearFilters = useCallback(() => {
    clearFilters()
    setSearch('')
  }, [clearFilters])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-divider px-4 py-2">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium uppercase tracking-wide text-text">
            {server.name} — Logs
          </h2>
          <p className="text-xs text-text-secondary">
            {formatHeaderStatus(query.mode, status, paused, query.lines)}
          </p>
        </div>
        {isDisconnected && (
          <Button variant="ghost" size="sm" onClick={() => void connect(serverId)}>
            Reconnect
          </Button>
        )}
      </header>

      <LogFiltersBar
        search={search}
        query={query}
        status={status}
        paused={paused}
        availableUnits={availableUnits}
        onSearchChange={setSearch}
        onQueryChange={setQuery}
        onClearFilters={handleClearFilters}
        onCopy={handleCopy}
        canCopy={selectedList.length > 0}
        onPause={pause}
        onResume={resume}
        onRefresh={refresh}
        onJumpToLatest={jumpToLatest}
      />

      {isUnavailable ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-medium text-text">Logs unavailable</p>
          <p className="mt-2 max-w-md text-xs text-text-secondary">
            {statusMessage ??
              'systemd journal could not be accessed on this server. Try connecting as a user with journal access or add your user to the systemd-journal group.'}
          </p>
        </div>
      ) : !isConnected ? (
        <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
          <p className="text-sm font-medium text-text">Disconnected</p>
          <p className="mt-2 max-w-md text-xs text-text-secondary">
            Connect to {server.name} to stream journal logs. Existing entries are preserved while
            disconnected.
          </p>
        </div>
      ) : (
        <LogList
          entries={entries}
          search={search}
          mode={query.mode}
          paused={paused}
          loadGeneration={loadGeneration}
          onPause={pause}
          onJumpToLatest={jumpToLatest}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
        />
      )}
    </div>
  )
}
