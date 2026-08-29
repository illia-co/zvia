import { useCallback, useEffect, useState } from 'react'
import type { SslOverview } from '@shared/ssl'
import type { ServerId } from '@shared/server'
import { describeToolError } from '@renderer/lib/toolErrors'

interface UseSslOptions {
  serverId: ServerId
  isConnected: boolean
  paused?: boolean
}

export interface UseSslResult {
  overview: SslOverview | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  elevation: string | null
  refresh: () => Promise<void>
  clearError: () => void
  renew: (certName: string) => Promise<void>
  testRenewal: (certName: string) => Promise<string | null>
  enableAutoRenewal: () => Promise<void>
  installCertbot: () => Promise<void>
}

export function useSsl({ serverId, isConnected, paused = false }: UseSslOptions): UseSslResult {
  const [overview, setOverview] = useState<SslOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)

  useEffect(() => {
    setOverview(null)
    setError(null)
    setElevation(null)
  }, [serverId])

  const refresh = useCallback(async () => {
    if (!isConnected || paused) return
    setLoading(true)
    try {
      const result = await window.relay.ssl.overview({ serverId })
      setOverview(result)
      setError(null)
      setElevation(null)
    } catch (err) {
      const described = describeToolError(err)
      setError(described.message)
      setElevation(described.elevation)
    } finally {
      setLoading(false)
    }
  }, [isConnected, paused, serverId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runAction = useCallback(
    async <T,>(operation: () => Promise<T>): Promise<T | null> => {
      setActionLoading(true)
      setError(null)
      setElevation(null)
      try {
        const result = await operation()
        await refresh()
        return result
      } catch (err) {
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
        return null
      } finally {
        setActionLoading(false)
      }
    },
    [refresh]
  )

  const renew = useCallback(
    async (certName: string) => {
      await runAction(() => window.relay.ssl.renew({ serverId, certName }))
    },
    [runAction, serverId]
  )

  const testRenewal = useCallback(
    async (certName: string) => {
      return runAction(() => window.relay.ssl.testRenewal({ serverId, certName }))
    },
    [runAction, serverId]
  )

  const enableAutoRenewal = useCallback(async () => {
    await runAction(() => window.relay.ssl.enableAutoRenewal({ serverId }))
  }, [runAction, serverId])

  const installCertbot = useCallback(async () => {
    await runAction(() => window.relay.ssl.installCertbot({ serverId }))
  }, [runAction, serverId])

  const clearError = useCallback(() => {
    setError(null)
    setElevation(null)
  }, [])

  return {
    overview,
    loading,
    actionLoading,
    error,
    elevation,
    refresh,
    clearError,
    renew,
    testRenewal,
    enableAutoRenewal,
    installCertbot
  }
}
