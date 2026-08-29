import { useEffect, useMemo, useState } from 'react'
import type { ProcessSignal, ProcessSummary, ProcessesSubscriptionInterval } from '@shared/processes'
import type { ProcessSortKey } from './processLabels'
import { BackButton } from '@renderer/components/ui/back-button'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useToolIntent } from '@renderer/state/navigationStore'
import { ProcessDetailView } from './ProcessDetailView'
import { ProcessFilters } from './ProcessFilters'
import { ProcessSignalDialog, type PendingProcessSignal } from './ProcessSignalDialog'
import { ProcessesTable } from './ProcessesTable'
import {
  DEFAULT_PROCESS_THRESHOLDS,
  matchesProcessFilter,
  processDisplayName,
  type ProcessFilter,
  type ProcessThresholds
} from './processLabels'
import { useProcesses } from './useProcesses'

export function ProcessesPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const isConnected = connectionState === 'connected'
  const intent = useToolIntent('processes')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ProcessFilter>('all')
  const [thresholds, setThresholds] = useState<ProcessThresholds>(DEFAULT_PROCESS_THRESHOLDS)
  const [intervalMs, setIntervalMs] = useState<ProcessesSubscriptionInterval>(2000)
  const [sortKey, setSortKey] = useState<ProcessSortKey>('cpuPercent')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const [pendingSignal, setPendingSignal] = useState<PendingProcessSignal | null>(null)
  const [detailRefreshToken, setDetailRefreshToken] = useState(0)

  const paused = selectedPid !== null
  const processes = useProcesses({
    serverId,
    isConnected,
    paused,
    intervalMs
  })

  useEffect(() => {
    setSelectedPid(null)
    setSearch('')
    setFilter('all')
    setPendingSignal(null)
  }, [serverId])

  useEffect(() => {
    if (!intent?.pid) return
    setSelectedPid(intent.pid)
  }, [intent])

  const visibleProcesses = useMemo(() => {
    const query = search.trim().toLowerCase()
    return processes.processes.filter((process) => {
      if (!matchesProcessFilter(process, filter, thresholds, server.username)) return false
      if (!query) return true
      return (
        String(process.pid).includes(query) ||
        process.user.toLowerCase().includes(query) ||
        process.comm.toLowerCase().includes(query) ||
        process.args.toLowerCase().includes(query)
      )
    })
  }, [filter, processes.processes, search, server.username, thresholds])

  const selectedSummary = useMemo(() => {
    if (selectedPid === null) return null
    return processes.processes.find((process) => process.pid === selectedPid) ?? null
  }, [processes.processes, selectedPid])

  const handleSort = (key: ProcessSortKey): void => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(key)
    setSortDirection(key === 'comm' || key === 'user' ? 'asc' : 'desc')
  }

  const requestSignal = (pid: number, name: string, signal: ProcessSignal): void => {
    setPendingSignal({ pid, name, signal })
  }

  const confirmSignal = async (): Promise<void> => {
    if (!pendingSignal) return
    const { pid, signal } = pendingSignal
    setPendingSignal(null)
    try {
      await processes.signal(pid, signal)
      setDetailRefreshToken((token) => token + 1)
      if (signal === 'kill') {
        setSelectedPid(null)
      }
    } catch {
      // Error surface is handled in the hook.
    }
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to inspect processes.
          </p>
        </div>
      </div>
    )
  }

  const errorSurface = processes.elevation ? (
    <div className="border-b border-divider p-3">
      <ElevationRequired serverId={serverId} command={processes.elevation} />
    </div>
  ) : processes.error ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface
        error={processes.error}
        onRetry={() => void processes.refresh()}
        onDismiss={processes.clearError}
      />
    </div>
  ) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedPid !== null ? (
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelectedPid(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">
            {selectedSummary
              ? `${processDisplayName(selectedSummary)} · pid ${selectedSummary.pid}`
              : `pid ${selectedPid}`}
          </span>
        </div>
      ) : (
        <ProcessFilters
          search={search}
          filter={filter}
          thresholds={thresholds}
          intervalMs={intervalMs}
          paused={paused}
          loading={processes.loading}
          onSearchChange={setSearch}
          onFilterChange={setFilter}
          onThresholdsChange={setThresholds}
          onIntervalChange={setIntervalMs}
          onRefresh={processes.refresh}
        />
      )}

      {errorSurface}

      <div className="min-h-0 flex-1 overflow-auto">
        {selectedPid !== null ? (
          <ProcessDetailView
            serverId={serverId}
            pid={selectedPid}
            actionLoading={processes.actionLoading}
            refreshToken={detailRefreshToken}
            onSignalRequest={requestSignal}
            loadDetail={processes.getDetail}
          />
        ) : (
          <ProcessesTable
            processes={visibleProcesses}
            loading={processes.loading}
            thresholds={thresholds}
            sortKey={sortKey}
            sortDirection={sortDirection}
            onSort={handleSort}
            onSelect={(process: ProcessSummary) => setSelectedPid(process.pid)}
          />
        )}
      </div>

      <ProcessSignalDialog
        pending={pendingSignal}
        busy={processes.actionLoading}
        onCancel={() => setPendingSignal(null)}
        onConfirm={() => void confirmSignal()}
      />
    </div>
  )
}
