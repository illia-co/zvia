import { useCallback, useEffect, useState } from 'react'
import type { NginxAction, NginxStatus, NginxValidation } from '@shared/nginx'
import type { ServerId } from '@shared/server'
import { describeToolError } from '@renderer/lib/toolErrors'

interface UseNginxOptions {
  serverId: ServerId
  isConnected: boolean
}

export interface UseNginxResult {
  status: NginxStatus | null
  loading: boolean
  actionLoading: boolean
  error: string | null
  elevation: string | null
  refresh: () => Promise<void>
  clearError: () => void
  runAction: (action: NginxAction) => Promise<void>
  validate: () => Promise<NginxValidation | null>
}

export function useNginx({ serverId, isConnected }: UseNginxOptions): UseNginxResult {
  const [status, setStatus] = useState<NginxStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [elevation, setElevation] = useState<string | null>(null)

  useEffect(() => {
    setStatus(null)
    setError(null)
    setElevation(null)
  }, [serverId])

  const refresh = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      const result = await window.zvia.nginx.status({ serverId })
      setStatus(result)
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

  const runAction = useCallback(
    async (action: NginxAction) => {
      setActionLoading(true)
      setError(null)
      setElevation(null)
      try {
        await window.zvia.nginx.action({ serverId, action })
        await refresh()
      } catch (err) {
        const described = describeToolError(err)
        setError(described.message)
        setElevation(described.elevation)
      } finally {
        setActionLoading(false)
      }
    },
    [refresh, serverId]
  )

  const validate = useCallback(async () => {
    setActionLoading(true)
    setError(null)
    setElevation(null)
    try {
      const result = await window.zvia.nginx.validate({ serverId })
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
  }, [refresh, serverId])

  const clearError = useCallback(() => {
    setError(null)
    setElevation(null)
  }, [])

  return {
    status,
    loading,
    actionLoading,
    error,
    elevation,
    refresh,
    clearError,
    runAction,
    validate
  }
}
