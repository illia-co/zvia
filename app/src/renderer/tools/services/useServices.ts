import { useCallback, useEffect, useRef, useState } from 'react'
import type { ZviaErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import type { SystemdUnit } from '@shared/systemd'
import { parseZviaError } from '@renderer/lib/errors'

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
  error: ZviaErrorPayload | null
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
  const [error, setError] = useState<ZviaErrorPayload | null>(null)

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
      const isAvailable = await window.zvia.services.isAvailable({ serverId })
      setAvailable(isAvailable)
      if (!isAvailable) {
        setUnits([])
        return
      }
      setUnits(await window.zvia.services.list({ serverId }))
      setError(null)
    } catch (err) {
      setError(parseZviaError(err))
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
