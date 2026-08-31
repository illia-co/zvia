import type { Relationship, TopologyEntity, TopologyInsight, TopologySnapshot } from '@shared/topology'
import type { Deployment } from '@shared/topology'

export interface EntityRelationshipEntry {
  relationship: Relationship
  direction: 'incoming' | 'outgoing'
  peer: TopologyEntity
}

export function getEntityRelationships(
  entityId: string,
  snapshot: TopologySnapshot,
  scopeEntityIds?: Set<string>
): EntityRelationshipEntry[] {
  const entries: EntityRelationshipEntry[] = []

  for (const relationship of snapshot.relationships) {
    if (relationship.type === 'member_of') continue
    if (
      scopeEntityIds &&
      (!scopeEntityIds.has(relationship.from.id) || !scopeEntityIds.has(relationship.to.id))
    ) {
      continue
    }

    if (relationship.from.id === entityId) {
      const peer = snapshot.entities[relationship.to.id]
      if (peer) entries.push({ relationship, direction: 'outgoing', peer })
      continue
    }

    if (relationship.to.id === entityId) {
      const peer = snapshot.entities[relationship.from.id]
      if (peer) entries.push({ relationship, direction: 'incoming', peer })
    }
  }

  return entries
}

export function getEntityDependencies(
  entityId: string,
  snapshot: TopologySnapshot,
  scopeEntityIds?: Set<string>
): Map<TopologyEntity['kind'], TopologyEntity[]> {
  const byKind = new Map<TopologyEntity['kind'], TopologyEntity[]>()
  const seen = new Set<string>()

  for (const entry of getEntityRelationships(entityId, snapshot, scopeEntityIds)) {
    if (entry.peer.id === entityId || seen.has(entry.peer.id)) continue
    seen.add(entry.peer.id)
    const list = byKind.get(entry.peer.kind) ?? []
    list.push(entry.peer)
    byKind.set(entry.peer.kind, list)
  }

  return byKind
}

export function sharedPortEntityIds(
  deployment: Deployment,
  insights: TopologyInsight[]
): Set<string> {
  const shared = new Set<string>()
  for (const insight of insights) {
    if (insight.type !== 'shared_backend') continue
    if (!insight.deploymentIds.includes(deployment.id)) continue
    for (const portEntityId of insight.portEntityIds ?? []) {
      if (deployment.entityIds.includes(portEntityId)) {
        shared.add(portEntityId)
      }
    }
  }
  return shared
}
