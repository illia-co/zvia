import { useCallback, useEffect, useState } from 'react'
import type { TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import type {
  DeploymentsDeploymentHistoryEntry,
  DeploymentsDiffResult,
  DeploymentsHistorySummary,
  DeploymentsSnapshotDiffResult
} from '@shared/ipc'
import { describeToolError } from '@renderer/lib/toolErrors'

interface UseSnapshotsOptions {
  serverId: ServerId
  isConnected: boolean
  snapshot: TopologySnapshot | null
}

export interface UseSnapshotsResult {
  history: DeploymentsHistorySummary[]
  deploymentHistory: DeploymentsDeploymentHistoryEntry[]
  historyLoading: boolean
  diffResult: DeploymentsSnapshotDiffResult | null
  liveDiffResult: DeploymentsDiffResult | null
  loading: boolean
  error: string | null
  addDeploymentTag: (snapshotId: string, deploymentId: string, tag: string) => Promise<void>
  removeDeploymentTag: (snapshotId: string, deploymentId: string, tag: string) => Promise<void>
  tagCurrent: (deploymentId: string, tag: string) => Promise<void>
  compareWithCurrent: (snapshotId: string, deploymentId: string) => Promise<void>
  compareSnapshots: (fromId: string, toId: string, deploymentId: string) => Promise<void>
  loadDeploymentHistory: (deploymentId: string) => Promise<void>
  refresh: () => Promise<void>
}

export function useSnapshots({
  serverId,
  isConnected,
  snapshot
}: UseSnapshotsOptions): UseSnapshotsResult {
  const [history, setHistory] = useState<DeploymentsHistorySummary[]>([])
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentsDeploymentHistoryEntry[]>([])
  const [deploymentHistoryFor, setDeploymentHistoryFor] = useState<string | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [diffResult, setDiffResult] = useState<DeploymentsSnapshotDiffResult | null>(null)
  const [liveDiffResult, setLiveDiffResult] = useState<DeploymentsDiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedServer, setLoadedServer] = useState<ServerId | null>(null)

  const loadHistory = useCallback(
    async (server: ServerId) => {
      if (!isConnected) return
      try {
        const list = await window.zvia.deployments.historyList({ serverId: server })
        setHistory(list)
        setLoadedServer(server)
      } catch (err) {
        setError(describeToolError(err).message)
      }
    },
    [isConnected]
  )

  const loadDeploymentHistory = useCallback(
    async (deploymentId: string) => {
      if (!isConnected) return
      setHistoryLoading(true)
      try {
        const entries = await window.zvia.deployments.deploymentHistory({
          serverId,
          deploymentId
        })
        setDeploymentHistory(entries)
        setDeploymentHistoryFor(deploymentId)
        setError(null)
      } catch (err) {
        setError(describeToolError(err).message)
      } finally {
        setHistoryLoading(false)
      }
    },
    [isConnected, serverId]
  )

  useEffect(() => {
    setHistory([])
    setDeploymentHistory([])
    setDeploymentHistoryFor(null)
    setDiffResult(null)
    setLiveDiffResult(null)
    setError(null)
    setLoadedServer(null)
    if (isConnected) {
      void loadHistory(serverId)
    }
  }, [serverId, isConnected, loadHistory])

  useEffect(() => {
    if (!isConnected || !snapshot || loadedServer !== serverId) return
    if (history.some((entry) => entry.id === snapshot.scannedAt)) return
    void loadHistory(serverId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot?.scannedAt])

  const addDeploymentTag = useCallback(
    async (snapshotId: string, deploymentId: string, tag: string) => {
      if (!isConnected) return
      try {
        await window.zvia.deployments.tag({ serverId, snapshotId, deploymentId, tag })
        setHistory((current) =>
          current.map((entry) => {
            if (entry.id !== snapshotId) return entry
            const existing = entry.deploymentTags[deploymentId] ?? []
            if (existing.includes(tag)) return entry
            return {
              ...entry,
              deploymentTags: {
                ...entry.deploymentTags,
                [deploymentId]: [...existing, tag]
              }
            }
          })
        )
        if (deploymentHistoryFor === deploymentId) {
          void loadDeploymentHistory(deploymentId)
        }
      } catch (err) {
        setError(describeToolError(err).message)
      }
    },
    [isConnected, serverId, deploymentHistoryFor, loadDeploymentHistory]
  )

  const removeDeploymentTag = useCallback(
    async (snapshotId: string, deploymentId: string, tag: string) => {
      if (!isConnected) return
      try {
        await window.zvia.deployments.tag({ serverId, snapshotId, deploymentId, tag, remove: true })
        setHistory((current) =>
          current.map((entry) => {
            if (entry.id !== snapshotId) return entry
            const existing = entry.deploymentTags[deploymentId] ?? []
            return {
              ...entry,
              deploymentTags: {
                ...entry.deploymentTags,
                [deploymentId]: existing.filter((t) => t !== tag)
              }
            }
          })
        )
        if (deploymentHistoryFor === deploymentId) {
          void loadDeploymentHistory(deploymentId)
        }
      } catch (err) {
        setError(describeToolError(err).message)
      }
    },
    [isConnected, serverId, deploymentHistoryFor, loadDeploymentHistory]
  )

  const compareSnapshots = useCallback(
    async (fromId: string, toId: string, deploymentId: string) => {
      if (!isConnected) return
      setLoading(true)
      try {
        const result = await window.zvia.deployments.snapshotDiff({
          serverId,
          fromSnapshotId: fromId,
          toSnapshotId: toId,
          deploymentId
        })
        setDiffResult(result)
        setLiveDiffResult(null)
        setError(null)
      } catch (err) {
        setError(describeToolError(err).message)
      } finally {
        setLoading(false)
      }
    },
    [isConnected, serverId]
  )

  const tagCurrent = useCallback(
    async (deploymentId: string, tag: string) => {
      if (!isConnected) return
      try {
        await window.zvia.deployments.tagCurrent({ serverId, deploymentId, tag })
        await loadHistory(serverId)
        if (deploymentHistoryFor === deploymentId) {
          await loadDeploymentHistory(deploymentId)
        }
        setError(null)
      } catch (err) {
        setError(describeToolError(err).message)
      }
    },
    [isConnected, serverId, loadHistory, loadDeploymentHistory, deploymentHistoryFor]
  )

  const compareWithCurrent = useCallback(
    async (snapshotId: string, deploymentId: string) => {
      if (!isConnected) return
      setLoading(true)
      try {
        const result = await window.zvia.deployments.diff({
          serverId,
          baselineId: snapshotId,
          deploymentId
        })
        setLiveDiffResult(result)
        setDiffResult(null)
        setError(null)
      } catch (err) {
        setError(describeToolError(err).message)
      } finally {
        setLoading(false)
      }
    },
    [isConnected, serverId]
  )

  const refresh = useCallback(async () => {
    await loadHistory(serverId)
    if (deploymentHistoryFor) {
      await loadDeploymentHistory(deploymentHistoryFor)
    }
  }, [loadHistory, loadDeploymentHistory, serverId, deploymentHistoryFor])

  return {
    history,
    deploymentHistory,
    historyLoading,
    diffResult,
    liveDiffResult,
    loading,
    error,
    addDeploymentTag,
    removeDeploymentTag,
    tagCurrent,
    compareWithCurrent,
    compareSnapshots,
    loadDeploymentHistory,
    refresh
  }
}
