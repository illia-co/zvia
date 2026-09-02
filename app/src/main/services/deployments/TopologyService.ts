import type { BrowserWindow } from 'electron'
import type { ServerId } from '@shared/server'
import type { TopologyScanProgress, TopologySnapshot } from '@shared/topology'
import { TOPOLOGY_CACHE_TTL_MS } from '@shared/topology'
import { buildTopologySnapshot } from './buildSnapshot'
import {
  productionTopologyCollector,
  type TopologyCollector,
  type TopologyCollectionResult
} from './collector'
import {
  containerEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId
} from '@shared/topology'
import { connectionManager } from '../../ssh/ConnectionManager'
import { topologyHistoryService } from './TopologyHistoryService'
import { diffTopology, filterProcessChurn } from './diff'

export { TOPOLOGY_CACHE_TTL_MS }

interface CacheEntry {
  snapshot: TopologySnapshot
  cachedAt: number
}

export type DeploymentLookupQuery =
  | { kind: 'port'; port: number }
  | { kind: 'container'; containerId: string }
  | { kind: 'domain'; domain: string }
  | { kind: 'nginxSite'; configPath: string; startLineNumber: number }

export interface DeploymentLookupResult {
  deploymentId: string
  entityId: string
}

export class TopologyService {
  private cache = new Map<ServerId, CacheEntry>()
  private mainWindow: BrowserWindow | null = null

  constructor(
    private readonly collector: TopologyCollector = productionTopologyCollector,
    private readonly recordHistory: (serverId: ServerId, snapshot: TopologySnapshot) => Promise<void> = async (
      serverId,
      snapshot
    ) => {
      const lastRecorded = topologyHistoryService.latest(serverId)
      if (lastRecorded) {
        const changes = diffTopology(lastRecorded.snapshot, snapshot)
        if (filterProcessChurn(changes).length === 0) return
      }
      await topologyHistoryService.record(serverId, snapshot)
    }
  ) {}

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  clearServer(serverId: ServerId): void {
    this.cache.delete(serverId)
  }

  invalidate(serverId: ServerId): void {
    this.clearServer(serverId)
  }

  async getSnapshot(serverId: ServerId, force = false): Promise<TopologySnapshot> {
    const cached = this.cache.get(serverId)
    if (!force && cached && Date.now() - cached.cachedAt < TOPOLOGY_CACHE_TTL_MS) {
      return cached.snapshot
    }
    return this.scan(serverId)
  }

  lookup(serverId: ServerId, query: DeploymentLookupQuery): DeploymentLookupResult | null {
    const cached = this.cache.get(serverId)
    if (!cached) return null

    const { snapshot } = cached
    let entityId: string | null = null

    switch (query.kind) {
      case 'port':
        entityId = this.findPortEntityId(snapshot, query.port)
        break
      case 'container':
        entityId = containerEntityId(query.containerId)
        if (!snapshot.entities[entityId]) entityId = null
        break
      case 'domain':
        entityId = domainEntityId(query.domain)
        if (!snapshot.entities[entityId]) entityId = null
        break
      case 'nginxSite':
        entityId = nginxSiteEntityId(query.configPath, query.startLineNumber)
        if (!snapshot.entities[entityId]) entityId = null
        break
    }

    if (!entityId) return null

    const deployment = snapshot.deployments.find((entry) => entry.entityIds.includes(entityId!))
    if (!deployment) return null

    return { deploymentId: deployment.id, entityId }
  }

  async scan(serverId: ServerId): Promise<TopologySnapshot> {
    const startedAt = Date.now()
    const observedAt = new Date().toISOString()

    const collection = await this.collector.collect(serverId, (phase, message) => {
      this.emitProgress(serverId, { phase, message })
    })

    this.emitProgress(serverId, { phase: 'building', message: 'Building topology…' })

    const snapshot = buildTopologySnapshot(
      serverId,
      collection,
      collection.nginxTopology,
      observedAt,
      startedAt,
      collection.warnings
    )

    this.cache.set(serverId, { snapshot, cachedAt: Date.now() })
    await this.recordHistory(serverId, snapshot)
    return snapshot
  }

  private findPortEntityId(snapshot: TopologySnapshot, port: number): string | null {
    for (const entity of Object.values(snapshot.entities)) {
      if (entity.kind !== 'port') continue
      if (entity.sourceRef?.port === port) return entity.id
    }
    for (const entity of Object.values(snapshot.entities)) {
      if (entity.kind === 'port' && entity.label === `:${port}`) return entity.id
    }
    const fallback = portEntityId('tcp', '127.0.0.1', port)
    return snapshot.entities[fallback] ? fallback : null
  }

  private emitProgress(serverId: ServerId, progress: TopologyScanProgress): void {
    this.mainWindow?.webContents.send('deployments:scanProgress', { serverId, ...progress })
  }
}

export const topologyService = new TopologyService()
connectionManager.registerTeardown((serverId) => topologyService.clearServer(serverId))
