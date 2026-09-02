import type {
  Deployment,
  DeploymentComponentStatus,
  HealthStatus,
  Relationship,
  TopologyEntity
} from '@shared/topology'
import type { PortListener } from '@shared/ports'

const HEALTH_RANK: Record<HealthStatus, number> = {
  failed: 4,
  degraded: 3,
  unknown: 2,
  discovering: 1,
  healthy: 0
}

function worstStatus(...statuses: HealthStatus[]): HealthStatus {
  return statuses.reduce<HealthStatus>((worst, status) => {
    return HEALTH_RANK[status] > HEALTH_RANK[worst] ? status : worst
  }, 'healthy')
}

function entityStatus(entities: Record<string, TopologyEntity>, id: string): HealthStatus {
  return entities[id]?.status ?? 'unknown'
}

function addressesCompatible(
  targetAddress: string | undefined,
  listenerAddress: string
): boolean {
  if (!targetAddress || targetAddress === '127.0.0.1' || targetAddress === 'localhost') {
    return (
      listenerAddress === '127.0.0.1' ||
      listenerAddress === '::1' ||
      listenerAddress === '0.0.0.0' ||
      listenerAddress === '*'
    )
  }
  return listenerAddress === targetAddress || listenerAddress === '0.0.0.0' || listenerAddress === '*'
}

function hasActiveListener(portEntity: TopologyEntity, listeners: PortListener[]): boolean {
  const port = portEntity.sourceRef?.port
  if (typeof port !== 'number') return false
  const targetAddress =
    typeof portEntity.sourceRef?.address === 'string' ? portEntity.sourceRef.address : undefined
  return listeners.some(
    (listener) =>
      listener.pid !== null &&
      listener.port === port &&
      addressesCompatible(targetAddress, listener.address)
  )
}

function syncEntrypointEntityHealth(
  deployments: Deployment[],
  entities: Record<string, TopologyEntity>
): void {
  for (const deployment of deployments) {
    for (const entrypoint of deployment.entrypoints) {
      const entity = entities[entrypoint.id]
      if (!entity) continue
      entity.status = deployment.health
    }
  }
}

function runtimeLabel(entity: TopologyEntity | undefined): string {
  if (!entity) return 'Unknown'
  if (entity.kind === 'process') {
    const comm = entity.sourceRef?.comm
    if (typeof comm === 'string' && comm.length > 0) {
      return comm.charAt(0).toUpperCase() + comm.slice(1)
    }
  }
  if (entity.kind === 'docker_container') return 'Docker'
  if (entity.kind === 'systemd_unit') return entity.label.replace(/\.service$/, '')
  if (entity.kind === 'file_path') return 'Static'
  return entity.label
}

export function applyEntityHealth(
  entities: Record<string, TopologyEntity>,
  relationships: Relationship[],
  listeners: PortListener[]
): void {
  for (const rel of relationships) {
    if (rel.type !== 'proxies_to' || rel.confidence === 'conflicting') continue
    const portEntity = entities[rel.to.id]
    if (portEntity?.kind === 'port' && !hasActiveListener(portEntity, listeners)) {
      portEntity.status = 'failed'
    }
  }

  for (const entity of Object.values(entities)) {
    if (entity.kind === 'systemd_unit' && entity.sourceRef?.activeState === 'failed') {
      entity.status = 'failed'
    }
    if (entity.kind === 'docker_container' && entity.sourceRef?.state === 'exited') {
      entity.status = 'failed'
    }
  }

  // Propagate backend port failure to published containers and bound processes.
  for (const rel of relationships) {
    if (rel.type !== 'published_by' && rel.type !== 'bound_to') continue
    const portEntity = entities[rel.from.id]
    if (portEntity?.kind !== 'port' || portEntity.status !== 'failed') continue
    const downstream = entities[rel.to.id]
    if (!downstream) continue
    if (downstream.status === 'healthy' || downstream.status === 'unknown') {
      downstream.status = 'failed'
    }
  }

  // Propagate exited containers back to their published host ports.
  for (const rel of relationships) {
    if (rel.type !== 'published_by') continue
    const container = entities[rel.to.id]
    const portEntity = entities[rel.from.id]
    if (container?.kind !== 'docker_container' || container.status !== 'failed') continue
    if (portEntity?.kind === 'port' && portEntity.status !== 'failed') {
      portEntity.status = 'failed'
    }
  }
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

function containerBackendPort(
  deployment: Deployment,
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>
): string | null {
  const entry = deployment.entrypoints[0]
  if (!entry) return null

  if (entry.kind === 'port') return entry.id

  if (entry.kind === 'docker_container') {
    return publishedPortForContainer(entry.id, relationships)
  }

  if (entry.kind === 'docker_compose_service') {
    for (const rel of relationships) {
      if (rel.type !== 'member_of' || rel.to.id !== entry.id) continue
      const port = publishedPortForContainer(rel.from.id, relationships)
      if (port) return port
    }
  }

  return null
}

function containerBackendEntities(
  deployment: Deployment,
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>
): { backendPortId: string; containerId: string | null } | null {
  const backendPortId = containerBackendPort(deployment, relationships, entities)
  if (!backendPortId) return null
  const dockerRel = relationships.find(
    (rel) => rel.type === 'published_by' && rel.from.id === backendPortId
  )
  return { backendPortId, containerId: dockerRel?.to.id ?? null }
}

function composeSiblingLabels(
  deployment: Deployment,
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>,
  skipContainerId: string | null
): string[] {
  const entry = deployment.entrypoints[0]
  if (!entry || entry.kind !== 'docker_compose_service') return []
  const labels: string[] = []
  for (const rel of relationships) {
    if (rel.type !== 'member_of' || rel.to.id !== entry.id) continue
    if (rel.from.id === skipContainerId) continue
    const sibling = entities[rel.from.id]
    if (sibling) labels.push(sibling.label)
  }
  return labels
}

export function buildStackSummary(
  deployment: Deployment,
  entities: Record<string, TopologyEntity>,
  relationships: Relationship[]
): string {
  const parts: string[] = []
  const deploymentRels = relationships.filter(
    (rel) =>
      deployment.entityIds.includes(rel.from.id) || deployment.entityIds.includes(rel.to.id)
  )

  const domainId = deployment.entrypoints[0]?.id
  const siteId = deploymentSiteId(deployment, deploymentRels)
  if (siteId) parts.push('Nginx')

  const proxyRel = proxyRelationshipForSite(siteId, deploymentRels)
  if (proxyRel) {
    const portEntity = entities[proxyRel.to.id]
    parts.push(portEntity?.label ?? ':backend')

    const dockerRel = deploymentRels.find(
      (rel) => rel.type === 'published_by' && rel.from.id === proxyRel.to.id
    )
    if (dockerRel) {
      parts.push(runtimeLabel(entities[dockerRel.to.id]))
    } else {
      const portToProcess = deploymentRels.find(
        (rel) => rel.type === 'bound_to' && rel.from.id === proxyRel.to.id
      )
      if (portToProcess) {
        parts.push(runtimeLabel(entities[portToProcess.to.id]))
      }
    }
  } else if (!siteId) {
    const backend = containerBackendEntities(deployment, deploymentRels, entities)
    if (backend) {
      parts.push(entities[backend.backendPortId]?.label ?? ':backend')
      if (backend.containerId) {
        parts.push(entities[backend.containerId]?.label ?? 'Docker')
        const siblings = composeSiblingLabels(
          deployment,
          deploymentRels,
          entities,
          backend.containerId
        )
        parts.push(...siblings)
      }
    }
  }

  const staticRel = deploymentRels.find(
    (rel) => rel.type === 'serves_static' && (siteId ? rel.from.id === siteId : true)
  )
  if (staticRel && parts.length <= 1) {
    parts.push('Static')
  }

  const processToUnit = deploymentRels.find((rel) => rel.type === 'managed_by')
  if (processToUnit && !proxyRel) {
    parts.push(runtimeLabel(entities[processToUnit.to.id]))
  }

  return parts.length > 0 ? parts.join(' → ') : 'Discovered resources'
}

function deploymentSiteId(
  deployment: Deployment,
  relationships: Relationship[]
): string | null {
  const domainId = deployment.entrypoints[0]?.id
  if (!domainId) return null

  const servedSiteIds = relationships
    .filter(
      (rel) =>
        rel.type === 'serves' &&
        rel.confidence !== 'unknown' &&
        ((rel.from.kind === 'domain' && rel.from.id === domainId && rel.to.kind === 'nginx_site') ||
          (rel.to.kind === 'domain' && rel.to.id === domainId && rel.from.kind === 'nginx_site'))
    )
    .map((rel) => (rel.from.kind === 'nginx_site' ? rel.from.id : rel.to.id))

  const proxySite = servedSiteIds.find((siteId) =>
    relationships.some(
      (rel) =>
        rel.type === 'proxies_to' &&
        rel.from.id === siteId &&
        rel.confidence !== 'unknown'
    )
  )
  if (proxySite) return proxySite

  const staticSite = servedSiteIds.find((siteId) =>
    relationships.some((rel) => rel.type === 'serves_static' && rel.from.id === siteId)
  )
  if (staticSite) return staticSite

  return servedSiteIds[0] ?? null
}

function proxyRelationshipForSite(
  siteId: string | null,
  deploymentRels: Relationship[]
): Relationship | undefined {
  if (!siteId) return undefined
  return deploymentRels.find(
    (rel) =>
      rel.type === 'proxies_to' &&
      rel.from.id === siteId &&
      rel.confidence !== 'unknown'
  )
}

export function computeDeploymentHealth(
  deployment: Deployment,
  entities: Record<string, TopologyEntity>,
  relationships: Relationship[]
): { health: HealthStatus; componentStatus: DeploymentComponentStatus } {
  const deploymentRels = relationships.filter(
    (rel) =>
      deployment.entityIds.includes(rel.from.id) || deployment.entityIds.includes(rel.to.id)
  )

  const componentStatus: DeploymentComponentStatus = {}
  const siteId = deploymentSiteId(deployment, deploymentRels)

  const tlsRel = deploymentRels.find(
    (rel) =>
      rel.type === 'terminates_tls' &&
      rel.confidence === 'confirmed' &&
      (siteId ? rel.from.id === siteId : true)
  )
  if (tlsRel) {
    componentStatus.ssl = entityStatus(entities, tlsRel.to.id)
  }

  if (siteId) {
    componentStatus.nginx = entityStatus(entities, siteId)
  }

  const proxyRel = proxyRelationshipForSite(siteId, deploymentRels)
  if (proxyRel) {
    componentStatus.backend = entityStatus(entities, proxyRel.to.id)

    const backendPortId = proxyRel.to.id
    const dockerRel = deploymentRels.find(
      (rel) => rel.type === 'published_by' && rel.from.id === backendPortId
    )
    if (dockerRel) {
      componentStatus.container = entityStatus(entities, dockerRel.to.id)
    }

    const processRel = deploymentRels.find(
      (rel) => rel.type === 'bound_to' && rel.from.id === backendPortId
    )
    if (processRel) {
      const unitRel = deploymentRels.find(
        (rel) => rel.type === 'managed_by' && rel.from.id === processRel.to.id
      )
      if (unitRel) {
        componentStatus.service = entityStatus(entities, unitRel.to.id)
      }
    }
  } else if (!siteId) {
    const backend = containerBackendEntities(deployment, deploymentRels, entities)
    if (backend) {
      componentStatus.backend = entityStatus(entities, backend.backendPortId)
      if (backend.containerId) {
        componentStatus.container = entityStatus(entities, backend.containerId)
      }
    }
  }

  const staticRel = deploymentRels.find(
    (rel) => rel.type === 'serves_static' && (siteId ? rel.from.id === siteId : true)
  )
  if (staticRel) {
    componentStatus.files = entityStatus(entities, staticRel.to.id)
  }

  const confirmedStatuses = Object.values(componentStatus).filter(Boolean) as HealthStatus[]
  const health = confirmedStatuses.length > 0 ? worstStatus(...confirmedStatuses) : 'unknown'

  return { health, componentStatus }
}

export function enrichDeployments(
  deployments: Deployment[],
  entities: Record<string, TopologyEntity>,
  relationships: Relationship[]
): Deployment[] {
  const enriched = deployments.map((deployment) => {
    const stackSummary = buildStackSummary(deployment, entities, relationships)
    const { health, componentStatus } = computeDeploymentHealth(deployment, entities, relationships)
    return { ...deployment, stackSummary, health, componentStatus }
  })
  syncEntrypointEntityHealth(enriched, entities)
  return enriched
}
