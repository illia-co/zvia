import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProcessDetail, ProcessSignal, ProcessSummary } from '@shared/processes'
import type { ProcessesSubscriptionInterval } from '@shared/processes'
import type { ServerId } from '@shared/server'
import { describeToolError } from '@renderer/lib/toolErrors'
import { generateId } from '@renderer/lib/utils'

interface UseProcessesOptions {
  serverId: ServerId
  isConnected: boolean
  paused?: boolean
  intervalMs: ProcessesSubscriptionInterval
}

export interface UseProcessesResult {
  processes: ProcessSummary[]
  capturedAt: string | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  elevation: string | null
  refresh: () => Promise<void>
  getDetail: (pid: number) => Promise<ProcessDetail>
  signal: (pid: number, signal: ProcessSignal) => Promise<void>
  clearError: () => void
}

export function useProcesses({
  serverId,
  isConnected,
  paused = false,
  intervalMs
}: UseProcessesOptions): UseProcessesResult {
  const [processes, setProcesses] = useState<ProcessSummary[]>([])
  const [capturedAt, setCapturedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)
  const subscriberId = useRef(generateId())

  useEffect(() => {
    setProcesses([])
    setCapturedAt(null)
    setError(null)
    setElevation(null)
  }, [serverId])

  const refresh = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      const result = await window.relay.processes.list({ serverId })
      setProcesses(result)
      setCapturedAt(new Date().toISOString())
      setError(null)
      setElevation(null)
    } catch (err) {
      const described = describeToolError(err)
      setError(described.message)
      setElevation(described.elevation)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    if (!isConnected || paused) {
      void window.relay.processes.unsubscribe({
        serverId,
        subscriberId: subscriberId.current
      })
      return
    }

    const id = subscriberId.current
    const unsubscribeEvents = window.relay.processes.onUpdate((event) => {
      if (event.serverId !== serverId) return
      setProcesses(event.processes)
      setCapturedAt(event.capturedAt)
      setError(null)
      setElevation(null)
    })

    void window.relay.processes.subscribe({ serverId, subscriberId: id, intervalMs })

    return () => {
      unsubscribeEvents()
      void window.relay.processes.unsubscribe({ serverId, subscriberId: id })
    }
  }, [intervalMs, isConnected, paused, serverId])

  useEffect(() => {
    if (!isConnected || paused) return
    void refresh()
  }, [isConnected, paused, refresh])

  const getDetail = useCallback(
    async (pid: number): Promise<ProcessDetail> => {
      return window.relay.processes.get({ serverId, pid })
    },
    [serverId]
  )

  const signal = useCallback(
    async (pid: number, signalName: ProcessSignal): Promise<void> => {
      setActionLoading(true)
      setError(null)
      setElevation(null)
      try {
        await window.relay.processes.signal({ serverId, pid, signal: signalName })
        await refresh()
      } catch (err) {
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
        throw err
      } finally {
        setActionLoading(false)
      }
    },
    [refresh, serverId]
  )

  const clearError = useCallback(() => {
    setError(null)
    setElevation(null)
  }, [])

  return {
    processes,
    capturedAt,
    loading,
    actionLoading,
    error,
    elevation,
    refresh,
    getDetail,
    signal,
    clearError
  }
}
