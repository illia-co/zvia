import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  DEFAULT_DOWNLOADS,
  fetchLatestDownloads,
  type DownloadLinks
} from '../lib/downloads'

const DownloadLinksContext = createContext<DownloadLinks>(DEFAULT_DOWNLOADS)

export function DownloadLinksProvider({ children }: { children: ReactNode }) {
  const [downloads, setDownloads] = useState(DEFAULT_DOWNLOADS)

  useEffect(() => {
    fetchLatestDownloads()
      .then(setDownloads)
      .catch(() => {
        // Keep build-time fallback URLs when the GitHub API is unavailable.
      })
  }, [])

  return (
    <DownloadLinksContext.Provider value={downloads}>{children}</DownloadLinksContext.Provider>
  )
}

export function useDownloadLinks(): DownloadLinks {
  return useContext(DownloadLinksContext)
}
