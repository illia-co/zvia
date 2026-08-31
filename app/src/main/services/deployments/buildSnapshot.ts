import type { ServerId } from '@shared/server'
import type { TopologySnapshot } from '@shared/topology'
import { normalizeEntities, type CollectorData } from './normalizers'
import { inferRelationships } from './inferrer'
import { clusterDeployments } from './clusterer'
import { applyEntityHealth, enrichDeployments } from './health'
import type { NginxTopology } from './types'

export function buildTopologySnapshot(
  serverId: ServerId,
  collectorData: CollectorData,
  nginxTopology: NginxTopology,
  observedAt: string,
  startedAt: number,
  warnings: string[]
): TopologySnapshot {
  const entities = normalizeEntities(collectorData)
  const relationships = inferRelationships(
    {
      topology: nginxTopology,
      certificates: collectorData.certificates,
      listeners: collectorData.listeners,
      containers: collectorData.containers,
      entities
    },
    observedAt
  )

  applyEntityHealth(entities, relationships, collectorData.listeners)

  const { deployments: rawDeployments, insights } = clusterDeployments({
    serverBlocks: nginxTopology.serverBlocks,
    relationships,
    entities
  })

  const deployments = enrichDeployments(rawDeployments, entities, relationships)

  return {
    serverId,
    scannedAt: observedAt,
    scanDurationMs: Date.now() - startedAt,
    entities,
    relationships,
    deployments,
    insights,
    warnings
  }
}
