import type {
  Deployment,
  EntityRef,
  Relationship,
  TopologyEntity,
  TopologyInsight
} from '@shared/topology'
import { deploymentEntityId, domainEntityId } from '@shared/topology'
import { detectSharedBackends } from './insights'

const SKIP_DOMAINS = new Set(['_', 'default_server', 'localhost'])

export interface ClusterInput {
  serverBlocks: Array<{ serverNames: string[] }>
  relationships: Relationship[]
  entities: Record<string, TopologyEntity>
}

function primaryDomains(serverBlocks: ClusterInput['serverBlocks']): string[] {
  const domains: string[] = []
  const seen = new Set<string>()

  for (const block of serverBlocks) {
    for (const name of block.serverNames) {
      const normalized = name.toLowerCase()
      if (SKIP_DOMAINS.has(normalized) || seen.has(normalized)) continue
      seen.add(normalized)
      domains.push(name)
    }
  }

  if (domains.length === 0) {
    for (const block of serverBlocks) {
      if (block.serverNames.length > 0) {
        const fallback = block.serverNames[0]
        if (!seen.has(fallback.toLowerCase())) {
          seen.add(fallback.toLowerCase())
          domains.push(fallback)
        }
      }
    }
  }

  return domains
}

function nginxSitesForDomain(domainId: string, relationships: Relationship[]): Set<string> {
  const sites = new Set<string>()
  for (const rel of relationships) {
    if (rel.type !== 'serves') continue
    if (rel.from.kind === 'domain' && rel.from.id === domainId) {
      sites.add(rel.to.id)
    }
    if (rel.to.kind === 'domain' && rel.to.id === domainId) {
      sites.add(rel.from.id)
    }
  }

  const appSites = new Set<string>()
  for (const siteId of sites) {
    const hasBackend = relationships.some(
      (rel) =>
        rel.from.id === siteId &&
        (rel.type === 'proxies_to' || rel.type === 'serves_static') &&
        rel.confidence !== 'unknown'
    )
    if (hasBackend) appSites.add(siteId)
  }

  return appSites.size > 0 ? appSites : sites
}

function entityKindForId(
  entityId: string,
  entities: Record<string, TopologyEntity>,
  relationships: Relationship[]
): TopologyEntity['kind'] | null {
  const entity = entities[entityId]
  if (entity) return entity.kind

  for (const rel of relationships) {
    if (rel.from.id === entityId) return rel.from.kind
    if (rel.to.id === entityId) return rel.to.kind
  }

  return null
}

function collectRelatedEntityIds(
  startDomainId: string,
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>
): Set<string> {
  const allowedNginxSites = nginxSitesForDomain(startDomainId, relationships)
  const visited = new Set<string>([startDomainId])
  const queue = [startDomainId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const rel of relationships) {
      const neighbors: string[] = []
      if (rel.from.id === current) neighbors.push(rel.to.id)
      if (rel.to.id === current) neighbors.push(rel.from.id)
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        const kind = entityKindForId(neighbor, entities, relationships)
        if (!kind) continue
        if (kind === 'domain' && neighbor !== startDomainId) continue
        if (kind === 'nginx_site' && !allowedNginxSites.has(neighbor)) continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return visited
}

export function clusterDeployments(input: ClusterInput): {
  deployments: Deployment[]
  insights: TopologyInsight[]
} {
  const domains = primaryDomains(input.serverBlocks)
  const deployments: Deployment[] = []

  for (const domain of domains) {
    const domainId = domainEntityId(domain)
    const entityIds = collectRelatedEntityIds(domainId, input.relationships, input.entities)
    const entrypoints: EntityRef[] = [{ kind: 'domain', id: domainId }]

    deployments.push({
      id: deploymentEntityId(domain),
      name: domain,
      health: 'unknown',
      entityIds: [...entityIds],
      entrypoints,
      stackSummary: '',
      componentStatus: {}
    })
  }

  const insights = detectSharedBackends(deployments, input.relationships, input.entities)
  return { deployments, insights }
}
