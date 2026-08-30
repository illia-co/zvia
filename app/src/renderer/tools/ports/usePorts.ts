import { useCallback, useEffect, useRef, useState } from 'react'
import type { FirewallRuleAction, PortProtocol, PortsSnapshot } from '@shared/ports'
import type { ServerId } from '@shared/server'
import { describeToolError } from '@renderer/lib/toolErrors'

const POLL_INTERVAL_MS = 5000

interface UsePortsOptions {
  serverId: ServerId
  isConnected: boolean
  paused?: boolean
}

export interface UsePortsResult {
  snapshot: PortsSnapshot | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  elevation: string | null
  refresh: () => Promise<void>
  clearError: () => void
  setFirewallRule: (
    action: FirewallRuleAction,
    port: number,
    protocol: PortProtocol
  ) => Promise<void>
  deleteFirewallRule: (ruleId: string) => Promise<void>
}

export function usePorts({ serverId, isConnected, paused = false }: UsePortsOptions): UsePortsResult {
  const [snapshot, setSnapshot] = useState<PortsSnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setSnapshot(null)
    setError(null)
    setElevation(null)
  }, [serverId])

  const refresh = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      const result = await window.zvia.ports.list({ serverId })
      setSnapshot(result)
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
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!isConnected || paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isConnected, paused, refresh])

  const runAction = useCallback(
    async (operation: () => Promise<void>) => {
      setActionLoading(true)
      setError(null)
      setElevation(null)
      try {
        await operation()
        await refresh()
      } catch (err) {
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
      } finally {
        setActionLoading(false)
      }
    },
    [refresh]
  )

  const setFirewallRule = useCallback(
    async (action: FirewallRuleAction, port: number, protocol: PortProtocol) => {
      await runAction(() =>
        window.zvia.ports.setFirewallRule({ serverId, action, port, protocol })
      )
    },
    [runAction, serverId]
  )

  const deleteFirewallRule = useCallback(
    async (ruleId: string) => {
      await runAction(() => window.zvia.ports.deleteFirewallRule({ serverId, ruleId }))
    },
    [runAction, serverId]
  )

  const clearError = useCallback(() => {
    setError(null)
    setElevation(null)
  }, [])

  return {
    snapshot,
    loading,
    actionLoading,
    error,
    elevation,
    refresh,
    clearError,
    setFirewallRule,
    deleteFirewallRule
  }
}
