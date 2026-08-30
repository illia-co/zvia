import { useCallback, useEffect, useState } from 'react'
import type { CronListResponse } from '@shared/cron'
import type { ZviaErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import { parseZviaError } from '@renderer/lib/errors'

const EMPTY_LISTING: CronListResponse = {
  jobs: [],
  crontabAvailable: false,
  canEditUser: false,
  canEditRoot: false
}

interface UseCronOptions {
  serverId: ServerId
  isConnected: boolean
}

interface UseCronResult {
  listing: CronListResponse
  loaded: boolean
  loading: boolean
  error: ZviaErrorPayload | null
  clearError: () => void
  reload: () => Promise<void>
}

export function useCron({ serverId, isConnected }: UseCronOptions): UseCronResult {
  const [listing, setListing] = useState<CronListResponse>(EMPTY_LISTING)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<ZviaErrorPayload | null>(null)

  useEffect(() => {
    setListing(EMPTY_LISTING)
    setLoaded(false)
    setError(null)
  }, [serverId])

  const reload = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    try {
      setListing(await window.zvia.cron.list({ serverId }))
      setError(null)
    } catch (err) {
      setError(parseZviaError(err))
    } finally {
      setLoaded(true)
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void reload()
  }, [reload])

  const clearError = useCallback(() => setError(null), [])

  return { listing, loaded, loading, error, clearError, reload }
}
