import type { TopologySnapshot } from '@shared/topology'
import {
  containerEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId
} from '@shared/topology'

export interface DeploymentLookupMatch {
  deploymentId: string
  entityId: string
}

export function findDeploymentByEntityId(
  snapshot: TopologySnapshot,
  entityId: string
): DeploymentLookupMatch | null {
  const deployment = snapshot.deployments.find((entry) => entry.entityIds.includes(entityId))
  if (!deployment) return null
  return { deploymentId: deployment.id, entityId }
}

export function findDeploymentByPort(
  snapshot: TopologySnapshot,
  port: number
): DeploymentLookupMatch | null {
  for (const entity of Object.values(snapshot.entities)) {
    if (entity.kind !== 'port') continue
    if (entity.sourceRef?.port !== port) continue
    const match = findDeploymentByEntityId(snapshot, entity.id)
    if (match) return match
  }

  const fallback = portEntityId('tcp', '127.0.0.1', port)
  return findDeploymentByEntityId(snapshot, fallback)
}

export function findDeploymentByContainer(
  snapshot: TopologySnapshot,
  containerId: string
): DeploymentLookupMatch | null {
  return findDeploymentByEntityId(snapshot, containerEntityId(containerId))
}

export function findDeploymentByDomain(
  snapshot: TopologySnapshot,
  domain: string
): DeploymentLookupMatch | null {
  return findDeploymentByEntityId(snapshot, domainEntityId(domain))
}

export function findDeploymentByNginxSite(
  snapshot: TopologySnapshot,
  configPath: string,
  startLineNumber: number
): DeploymentLookupMatch | null {
  return findDeploymentByEntityId(snapshot, nginxSiteEntityId(configPath, startLineNumber))
}
