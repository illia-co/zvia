import { useCallback, useEffect, useRef, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type {
  InstalledPackage,
  PackageDetail,
  PackageOverview,
  PackageSearchResult,
  PackageUpdate,
  PaginatedResult
} from '@shared/packages'
import type { ServerId } from '@shared/server'
import { parseRelayError } from '@renderer/lib/errors'

const SEARCH_DEBOUNCE_MS = 300
const LIST_CHUNK_SIZE = 500

async function fetchAllInstalled(
  serverId: ServerId,
  query?: string
): Promise<PaginatedResult<InstalledPackage>> {
  let offset = 0
  const items: InstalledPackage[] = []
  let total = 0

  while (true) {
    const page = await window.relay.packages.list({
      serverId,
      query,
      offset,
      limit: LIST_CHUNK_SIZE
    })
    total = page.total
    items.push(...page.items)
    if (items.length >= total || page.items.length === 0) break
    offset += LIST_CHUNK_SIZE
  }

  return { items, total, offset: 0, limit: items.length }
}

export type PackagesTab = 'installed' | 'updates' | 'search'

interface UsePackagesOptions {
  serverId: ServerId
  isConnected: boolean
  /** Polling pauses while a detail view is open. */
  polling: boolean
}

interface UsePackagesResult {
  available: boolean | null
  unavailableReason: string | null
  overview: PackageOverview | null
  installed: PaginatedResult<InstalledPackage> | null
  installedQuery: string
  updates: PackageUpdate[]
  searchResults: PackageSearchResult[]
  searchQuery: string
  detail: PackageDetail | null
  loading: boolean
  installedLoading: boolean
  updatesLoading: boolean
  searchLoading: boolean
  detailLoading: boolean
  error: RelayErrorPayload | null
  setInstalledQuery: (query: string) => void
  setSearchQuery: (query: string) => void
  loadDetail: (packageName: string) => Promise<void>
  clearDetail: () => void
  clearError: () => void
  reloadOverview: () => Promise<void>
  reloadInstalled: () => Promise<void>
  reloadUpdates: () => Promise<void>
  reloadSearch: () => Promise<void>
  reloadAll: () => Promise<void>
}

export function usePackages({
  serverId,
  isConnected,
  polling
}: UsePackagesOptions): UsePackagesResult {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null)
  const [overview, setOverview] = useState<PackageOverview | null>(null)
  const [installed, setInstalled] = useState<PaginatedResult<InstalledPackage> | null>(null)
  const [installedQuery, setInstalledQuery] = useState('')
  const [debouncedInstalledQuery, setDebouncedInstalledQuery] = useState('')
  const [updates, setUpdates] = useState<PackageUpdate[]>([])
  const [searchResults, setSearchResults] = useState<PackageSearchResult[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [detail, setDetail] = useState<PackageDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [installedLoading, setInstalledLoading] = useState(false)
  const [updatesLoading, setUpdatesLoading] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<RelayErrorPayload | null>(null)

  const debouncedInstalledQueryRef = useRef(debouncedInstalledQuery)
  const debouncedSearchQueryRef = useRef(debouncedSearchQuery)

  useEffect(() => {
    debouncedInstalledQueryRef.current = debouncedInstalledQuery
  }, [debouncedInstalledQuery])

  useEffect(() => {
    debouncedSearchQueryRef.current = debouncedSearchQuery
  }, [debouncedSearchQuery])

  useEffect(() => {
    setAvailable(null)
    setUnavailableReason(null)
    setOverview(null)
    setInstalled(null)
    setInstalledQuery('')
    setDebouncedInstalledQuery('')
    setUpdates([])
    setSearchResults([])
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setDetail(null)
    setError(null)
  }, [serverId])

  const reloadOverview = useCallback(async () => {
    if (!isConnected || available === false) return
    try {
      const next = await window.relay.packages.overview({ serverId })
      setOverview(next)
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    }
  }, [available, isConnected, serverId])

  const reloadInstalled = useCallback(async () => {
    if (!isConnected || available === false) return
    setInstalledLoading(true)
    try {
      const query = debouncedInstalledQueryRef.current.trim()
      const next = await fetchAllInstalled(serverId, query || undefined)
      setInstalled(next)
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setInstalledLoading(false)
    }
  }, [available, isConnected, serverId])

  const reloadUpdates = useCallback(async () => {
    if (!isConnected || available === false) return
    setUpdatesLoading(true)
    try {
      const next = await window.relay.packages.updates({ serverId })
      setUpdates(next)
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setUpdatesLoading(false)
    }
  }, [available, isConnected, serverId])

  const reloadSearch = useCallback(async () => {
    if (!isConnected || available === false) return
    const query = debouncedSearchQueryRef.current.trim()
    if (!query) {
      setSearchResults([])
      return
    }
    setSearchLoading(true)
    try {
      const next = await window.relay.packages.search({ serverId, query })
      setSearchResults(next)
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setSearchLoading(false)
    }
  }, [available, isConnected, serverId])

  const reloadAll = useCallback(async () => {
    if (!isConnected) {
      setAvailable(null)
      return
    }

    setLoading(true)
    try {
      const availability = await window.relay.packages.isAvailable({ serverId })
      setAvailable(availability.available)
      setUnavailableReason(availability.reason ?? null)
      if (!availability.available) {
        setOverview(null)
        setInstalled(null)
        setUpdates([])
        setSearchResults([])
        setError(null)
        return
      }

      const query = debouncedInstalledQueryRef.current.trim()
      const [nextOverview, nextInstalled, nextUpdates] = await Promise.all([
        window.relay.packages.overview({ serverId }),
        fetchAllInstalled(serverId, query || undefined),
        window.relay.packages.updates({ serverId })
      ])
      setOverview(nextOverview)
      setInstalled(nextInstalled)
      setUpdates(nextUpdates)
      setError(null)
    } catch (err) {
      setError(parseRelayError(err))
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void reloadAll()
  }, [reloadAll])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInstalledQuery(installedQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [installedQuery])

  useEffect(() => {
    if (available !== true) return
    void reloadInstalled()
  }, [available, debouncedInstalledQuery, reloadInstalled])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    if (available !== true) return
    void reloadSearch()
  }, [available, debouncedSearchQuery, reloadSearch])

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isConnected || !polling || available !== true) return

    timerRef.current = setInterval(() => {
      void reloadOverview()
      void reloadUpdates()
    }, 30_000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [available, isConnected, polling, reloadOverview, reloadUpdates])

  const loadDetail = useCallback(
    async (packageName: string) => {
      if (!isConnected || available !== true) return
      setDetailLoading(true)
      try {
        const next = await window.relay.packages.info({ serverId, packageName })
        setDetail(next)
        setError(null)
      } catch (err) {
        setError(parseRelayError(err))
      } finally {
        setDetailLoading(false)
      }
    },
    [available, isConnected, serverId]
  )

  const clearDetail = useCallback(() => setDetail(null), [])
  const clearError = useCallback(() => setError(null), [])

  return {
    available,
    unavailableReason,
    overview,
    installed,
    installedQuery,
    updates,
    searchResults,
    searchQuery,
    detail,
    loading,
    installedLoading,
    updatesLoading,
    searchLoading,
    detailLoading,
    error,
    setInstalledQuery,
    setSearchQuery,
    loadDetail,
    clearDetail,
    clearError,
    reloadOverview,
    reloadInstalled,
    reloadUpdates,
    reloadSearch,
    reloadAll
  }
}
