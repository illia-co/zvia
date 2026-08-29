import { useCallback, useEffect, useRef, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import type { UsersListResponse } from '@shared/users'
import { parseRelayError } from '@renderer/lib/errors'

const EMPTY_LISTING: UsersListResponse = {
  users: [],
  connectedUsername: '',
  uidMin: 1000,
  adminGroup: null
}

const REFRESH_INTERVAL_MS = 10_000

interface UseUsersOptions {
  serverId: ServerId
  isConnected: boolean
  polling: boolean
}

interface UseUsersResult {
  listing: UsersListResponse
  available: boolean | null
  loaded: boolean
  loading: boolean
  error: RelayErrorPayload | null
  clearError: () => void
  reload: () => Promise<void>
}

export function useUsers({
  serverId,
  isConnected,
  polling
}: UseUsersOptions): UseUsersResult {
  const [listing, setListing] = useState<UsersListResponse>(EMPTY_LISTING)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<RelayErrorPayload | null>(null)

  useEffect(() => {
    setListing(EMPTY_LISTING)
    setAvailable(null)
    setLoaded(false)
    setError(null)
  }, [serverId])

  const reload = useCallback(async () => {
    if (!isConnected) {
      setAvailable(null)
      return
    }
    setLoading(true)
    try {
      const isAvailable = await window.relay.users.isAvailable({ serverId })
      setAvailable(isAvailable)
      if (!isAvailable) {
        setListing(EMPTY_LISTING)
        setError(null)
        return
      }
      setListing(await window.relay.users.list({ serverId }))
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setLoaded(true)
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

  return { listing, available, loaded, loading, error, clearError, reload }
}
