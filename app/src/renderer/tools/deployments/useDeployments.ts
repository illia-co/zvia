import { useCallback, useEffect, useRef, useState } from 'react'
import type { TopologySnapshot } from '@shared/topology'
import { TOPOLOGY_CACHE_TTL_MS } from '@shared/topology'
import type { ServerId } from '@shared/server'
import { describeToolError } from '@renderer/lib/toolErrors'

export { TOPOLOGY_CACHE_TTL_MS }

interface UseDeploymentsOptions {
  serverId: ServerId
  isConnected: boolean
  paused?: boolean
}

export interface UseDeploymentsResult {
  snapshot: TopologySnapshot | null
  loading: boolean
  scanning: boolean
  scanPhase: string | null
  error: string | null
  refresh: () => Promise<void>
  scan: () => Promise<void>
}

export function useDeployments({
  serverId,
  isConnected,
  paused = false
}: UseDeploymentsOptions): UseDeploymentsResult {
  const [snapshot, setSnapshot] = useState<TopologySnapshot | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanPhase, setScanPhase] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setSnapshot(null)
    setError(null)
    if (isConnected) {
      setLoading(true)
    }
  }, [serverId, isConnected])

  const loadSnapshot = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      const result = await window.zvia.deployments.getSnapshot({ serverId })
      setSnapshot(result)
      setError(null)
    } catch (err) {
      setError(describeToolError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  const scan = useCallback(async () => {
    if (!isConnected) return
    setScanning(true)
    setScanPhase(null)
    try {
      const result = await window.zvia.deployments.scan({ serverId })
      setSnapshot(result)
      setError(null)
    } catch (err) {
      setError(describeToolError(err).message)
    } finally {
      setScanning(false)
      setScanPhase(null)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void loadSnapshot()
  }, [loadSnapshot])

  useEffect(() => {
    if (!isConnected || paused) {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      return
    }

    timerRef.current = setInterval(() => {
      void loadSnapshot()
    }, TOPOLOGY_CACHE_TTL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isConnected, loadSnapshot, paused])

  useEffect(() => {
    const unsubscribe = window.zvia.deployments.onScanProgress((event) => {
      if (event.serverId !== serverId) return
      setScanPhase(event.message)
    })
    return unsubscribe
  }, [serverId])

  return {
    snapshot,
    loading,
    scanning,
    scanPhase,
    error,
    refresh: scan,
    scan
  }
}
