import { useCallback, useEffect, useRef, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import type { SystemdUnit } from '@shared/systemd'
import { parseRelayError } from '@renderer/lib/errors'

const REFRESH_INTERVAL_MS = 5000

interface UseServicesOptions {
  serverId: ServerId
  isConnected: boolean
  /** Polling pauses while a detail view is open. */
  polling: boolean
}

interface UseServicesResult {
  units: SystemdUnit[]
  available: boolean | null
  loading: boolean
  error: RelayErrorPayload | null
  clearError: () => void
  reload: () => Promise<void>
}

export function useServices({
  serverId,
  isConnected,
  polling
}: UseServicesOptions): UseServicesResult {
  const [units, setUnits] = useState<SystemdUnit[]>([])
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<RelayErrorPayload | null>(null)

  useEffect(() => {
    setUnits([])
    setAvailable(null)
    setError(null)
  }, [serverId])

  const reload = useCallback(async () => {
    if (!isConnected) {
      setAvailable(null)
      return
    }
    setLoading(true)
    try {
      const isAvailable = await window.relay.services.isAvailable({ serverId })
      setAvailable(isAvailable)
      if (!isAvailable) {
        setUnits([])
        return
      }
      setUnits(await window.relay.services.list({ serverId }))
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void reload()
  }, [reload])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isConnected || !polling) return

    timerRef.current = setInterval(() => {
      void reload()
    }, REFRESH_INTERVAL_MS)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isConnected, polling, reload])

  const clearError = useCallback(() => setError(null), [])

  return { units, available, loading, error, clearError, reload }
}
