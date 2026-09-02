import type { ServerId } from '@shared/server'
import { ZviaError } from '@shared/errors'
import type { TopologyChange, TopologySnapshot } from '@shared/topology'
import {
  topologyHistoryStore,
  type PersistedSnapshot
} from '../../store/topologyHistory'
import { diffTopology, diffTopologyForDeployment } from './diff'
import { summarizeChanges } from './summarize'

export interface HistorySummary {
  id: string
  scannedAt: string
  deploymentTags: Record<string, string[]>
}

export interface DiffResponse {
  changes: TopologyChange[]
  baselineId: string | null
  baselineScannedAt: string | null
}

export interface SnapshotDiffResponse {
  changes: TopologyChange[]
  fromId: string
  fromScannedAt: string
  toId: string
  toScannedAt: string
}

export interface DeploymentHistoryEntry {
  id: string
  scannedAt: string
  tags: string[]
  changeCount: number
  summary: string
}

export class TopologyHistoryService {
  async list(serverId: ServerId): Promise<HistorySummary[]> {
    return topologyHistoryStore.list(serverId).map((entry) => ({
      id: entry.id,
      scannedAt: entry.scannedAt,
      deploymentTags: entry.deploymentTags
    }))
  }

  latest(serverId: ServerId): PersistedSnapshot | null {
    return topologyHistoryStore.latest(serverId)
  }

  async addDeploymentTag(
    serverId: ServerId,
    snapshotId: string,
    deploymentId: string,
    tagName: string
  ): Promise<void> {
    await topologyHistoryStore.addDeploymentTag(serverId, snapshotId, deploymentId, tagName)
  }

  async tagCurrent(
    serverId: ServerId,
    snapshot: TopologySnapshot,
    deploymentId: string,
    tagName: string
  ): Promise<string> {
    const snapshotId = await topologyHistoryStore.record(serverId, snapshot)
    await topologyHistoryStore.addDeploymentTag(serverId, snapshotId, deploymentId, tagName)
    return snapshotId
  }

  async removeDeploymentTag(
    serverId: ServerId,
    snapshotId: string,
    deploymentId: string,
    tagName: string
  ): Promise<void> {
    await topologyHistoryStore.removeDeploymentTag(serverId, snapshotId, deploymentId, tagName)
  }

  async record(serverId: ServerId, snapshot: TopologySnapshot): Promise<string> {
    return topologyHistoryStore.record(serverId, snapshot)
  }

  async diff(
    serverId: ServerId,
    current: TopologySnapshot,
    baselineId?: string | null,
    deploymentId?: string
  ): Promise<DiffResponse> {
    const id = baselineId ?? topologyHistoryStore.latest(serverId)?.id ?? null
    const baseline: PersistedSnapshot | null = id
      ? topologyHistoryStore.get(serverId, id)
      : null

    if (!baseline) {
      return { changes: [], baselineId: null, baselineScannedAt: null }
    }

    const changes = deploymentId
      ? diffTopologyForDeployment(baseline.snapshot, current, deploymentId)
      : diffTopology(baseline.snapshot, current)

    return {
      changes,
      baselineId: baseline.id,
      baselineScannedAt: baseline.scannedAt
    }
  }

  async snapshotDiff(
    serverId: ServerId,
    fromSnapshotId: string,
    toSnapshotId: string,
    deploymentId?: string
  ): Promise<SnapshotDiffResponse> {
    const from = topologyHistoryStore.get(serverId, fromSnapshotId)
    const to = topologyHistoryStore.get(serverId, toSnapshotId)

    if (!from || !to) {
      throw new ZviaError(
        'NOT_FOUND',
        !from
          ? `Snapshot not found: ${fromSnapshotId}`
          : `Snapshot not found: ${toSnapshotId}`
      )
    }

    const changes = deploymentId
      ? diffTopologyForDeployment(from.snapshot, to.snapshot, deploymentId)
      : diffTopology(from.snapshot, to.snapshot)

    return {
      changes,
      fromId: from.id,
      fromScannedAt: from.scannedAt,
      toId: to.id,
      toScannedAt: to.scannedAt
    }
  }

  async deploymentHistory(
    serverId: ServerId,
    deploymentId: string
  ): Promise<DeploymentHistoryEntry[]> {
    const newestFirst = topologyHistoryStore.list(serverId)
    const oldestFirst = [...newestFirst].reverse()

    const entries: DeploymentHistoryEntry[] = []
    for (let index = 0; index < oldestFirst.length; index += 1) {
      const entry = oldestFirst[index]
      const tags = entry.deploymentTags[deploymentId] ?? []

      const changes =
        index === 0
          ? []
          : diffTopologyForDeployment(oldestFirst[index - 1].snapshot, entry.snapshot, deploymentId)

      if (changes.length === 0 && tags.length === 0) continue

      entries.push({
        id: entry.id,
        scannedAt: entry.scannedAt,
        tags,
        changeCount: changes.length,
        summary: summarizeChanges(changes)
      })
    }

    return entries.reverse()
  }

  async removeServer(serverId: ServerId): Promise<void> {
    await topologyHistoryStore.removeServer(serverId)
  }
}

export const topologyHistoryService = new TopologyHistoryService()
