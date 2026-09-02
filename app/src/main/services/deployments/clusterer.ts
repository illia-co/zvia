import type {
  Deployment,
  EntityRef,
  Relationship,
  TopologyEntity,
  TopologyInsight
} from '@shared/topology'
import { composeServiceEntityId, deploymentEntityId, domainEntityId } from '@shared/topology'
import { detectSharedBackends } from './insights'

const SKIP_DOMAINS = new Set(['_', 'default_server', 'localhost'])
const DEFAULT_NETWORKS = new Set(['bridge', 'host', 'none', 'default'])

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
    const currentKind = entityKindForId(current, entities, relationships)
    // The nginx-domain BFS must not widen through orchestration hubs. A
    // systemd_unit like docker.service (or nginx.service) is a shared runtime
    // node whose only back-edges fan out to every container/process of the
    // host, and a docker_compose_service links every member container in a
    // project. Expanding from either would swallow unrelated compose projects
    // (and their published ports) that share the same docker.service or compose
    // project. Claim them but treat them as leaves.
    if (currentKind === 'systemd_unit' || currentKind === 'docker_compose_service') continue
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

function containerComposeService(
  containerId: string,
  relationships: Relationship[]
): string | null {
  for (const rel of relationships) {
    if (rel.type === 'member_of' && rel.from.id === containerId) return rel.to.id
  }
  return null
}

function networkKeyOf(
  containerId: string,
  entities: Record<string, TopologyEntity>
): string | null {
  const networks = entities[containerId]?.sourceRef?.networks
  if (typeof networks !== 'string') return null
  const custom = networks
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .filter((name) => !DEFAULT_NETWORKS.has(name))
  if (custom.length === 0) return null
  return custom.sort().join(',')
}

function publishedPortForContainer(
  containerId: string,
  relationships: Relationship[]
): string | null {
  for (const rel of relationships) {
    if (rel.type === 'published_by' && rel.to.id === containerId && rel.from.kind === 'port') {
      return rel.from.id
    }
  }
  return null
}

function groupPublishedPort(
  members: string[],
  relationships: Relationship[]
): string | null {
  for (const member of members) {
    const port = publishedPortForContainer(member, relationships)
    if (port) return port
  }
  return null
}

function collectContainerDeploymentEntities(
  seeds: string[],
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>
): Set<string> {
  const visited = new Set<string>(seeds)
  const queue = [...seeds]

  while (queue.length > 0) {
    const current = queue.shift()!
    const currentKind = entityKindForId(current, entities, relationships)
    // Same boundary as the domain pass: a systemd_unit like docker.service is a
    // shared orchestration hub. Expanding from it would fan out to every
    // container/process on the host and cause the overlap check to claim this
    // cluster (and skip it). Treat it as a leaf.
    if (currentKind === 'systemd_unit') continue
    for (const rel of relationships) {
      const neighbors: string[] = []
      if (rel.from.id === current) neighbors.push(rel.to.id)
      if (rel.to.id === current) neighbors.push(rel.from.id)
      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue
        const kind = entityKindForId(neighbor, entities, relationships)
        if (!kind) continue
        // Never bridge a container-only deployment through nginx or a domain.
        if (kind === 'domain' || kind === 'nginx_site') continue
        visited.add(neighbor)
        queue.push(neighbor)
      }
    }
  }

  return visited
}

function uniqueDeploymentId(base: string, taken: Set<string>): string {
  let id = deploymentEntityId(base)
  let suffix = 2
  while (taken.has(id)) {
    id = deploymentEntityId(`${base}-${suffix}`)
    suffix += 1
  }
  taken.add(id)
  return id
}

function clusterContainerDeployments(
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>,
  claimedIds: Set<string>
): Deployment[] {
  const deployments: Deployment[] = []
  const containerIds = Object.values(entities)
    .filter((entity) => entity.kind === 'docker_container')
    .map((entity) => entity.id)

  interface ContainerCluster {
    members: string[]
    composeId?: string
    label?: string
  }

  const composeClusters = new Map<string, ContainerCluster>()
  const netClusters = new Map<string, ContainerCluster>()
  const orphans: ContainerCluster[] = []

  for (const cid of containerIds) {
    const composeId = containerComposeService(cid, relationships)
    if (composeId) {
      let cluster = composeClusters.get(composeId)
      if (!cluster) {
        cluster = { members: [], composeId, label: entities[composeId]?.label }
        composeClusters.set(composeId, cluster)
      }
      cluster.members.push(cid)
      continue
    }
    const netKey = networkKeyOf(cid, entities)
    if (netKey) {
      let cluster = netClusters.get(netKey)
      if (!cluster) {
        const label = netKey.split(',')[0] ?? netKey
        cluster = { members: [], label }
        netClusters.set(netKey, cluster)
      }
      cluster.members.push(cid)
      continue
    }
    const orphan = { members: [cid], label: entities[cid]?.label }
    orphans.push(orphan)
  }

  const clusters = [...composeClusters.values(), ...netClusters.values(), ...orphans]

  // Only resource-level nodes (containers, ports, compose services) define a
  // deployment's footprint. Shared orchestration leaves such as systemd units
  // (docker.service, nginx.service) and their processes are attached to every
  // deployment and must not count towards overlap.
  const FOOTPRINT_KINDS = new Set<TopologyEntity['kind']>([
    'docker_container',
    'port',
    'docker_compose_service'
  ])

  for (const cluster of clusters) {
    if (cluster.members.some((id) => claimedIds.has(id))) continue

    const entityIds = collectContainerDeploymentEntities(cluster.members, relationships, entities)
    const footprintOverlaps = [...entityIds].some(
      (id) =>
        FOOTPRINT_KINDS.has(entityKindForId(id, entities, relationships) as TopologyEntity['kind']) &&
        claimedIds.has(id)
    )
    if (footprintOverlaps) continue

    const name = cluster.label ?? 'container'
    let entrypoint: EntityRef

    if (cluster.composeId) {
      entrypoint = { kind: 'docker_compose_service', id: cluster.composeId }
    } else {
      const portId = groupPublishedPort(cluster.members, relationships)
      if (portId) {
        entrypoint = { kind: 'port', id: portId }
      } else {
        entrypoint = { kind: 'docker_container', id: cluster.members[0] }
      }
    }

    const id = uniqueDeploymentId(name, claimedIds)
    deployments.push({
      id,
      name,
      health: 'unknown',
      entityIds: [...entityIds],
      entrypoints: [entrypoint],
      stackSummary: '',
      componentStatus: {}
    })

    for (const entityId of entityIds) claimedIds.add(entityId)
  }

  return deployments
}

export function clusterDeployments(input: ClusterInput): {
  deployments: Deployment[]
  insights: TopologyInsight[]
} {
  const domains = primaryDomains(input.serverBlocks)
  const deployments: Deployment[] = []
  const claimedIds = new Set<string>()

  for (const domain of domains) {
    const domainId = domainEntityId(domain)
    const entityIds = collectRelatedEntityIds(domainId, input.relationships, input.entities)
    for (const entityId of entityIds) claimedIds.add(entityId)

    deployments.push({
      id: deploymentEntityId(domain),
      name: domain,
      health: 'unknown',
      entityIds: [...entityIds],
      entrypoints: [{ kind: 'domain', id: domainId }],
      stackSummary: '',
      componentStatus: {}
    })
  }

  deployments.push(
    ...clusterContainerDeployments(input.relationships, input.entities, claimedIds)
  )

  const insights = detectSharedBackends(deployments, input.relationships, input.entities)
  return { deployments, insights }
}
