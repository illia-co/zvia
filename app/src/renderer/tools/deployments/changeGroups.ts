import type {
  Deployment,
  DeploymentComponentStatus,
  EntityKind,
  HealthStatus,
  TopologyChange,
  TopologySnapshot
} from '@shared/topology'
import { DEPLOYMENT_COMPONENT_LABELS } from './topologyPresentation'

const LAYER_ORDER: Array<keyof DeploymentComponentStatus> = [
  'ssl',
  'nginx',
  'backend',
  'service',
  'container',
  'files'
]

const KIND_TO_LAYER: Partial<Record<EntityKind, keyof DeploymentComponentStatus>> = {
  ssl_certificate: 'ssl',
  nginx_site: 'nginx',
  port: 'backend',
  process: 'backend',
  systemd_unit: 'service',
  docker_container: 'container',
  docker_compose_service: 'container',
  file_path: 'files'
}

export interface LayerGroup {
  key: keyof DeploymentComponentStatus
  label: string
  changes: TopologyChange[]
}

export interface DeploymentChangeGroup {
  deployment: Deployment
  layers: LayerGroup[]
  changeCount: number
}

function severityRank(health: HealthStatus): number {
  switch (health) {
    case 'failed':
      return 0
    case 'degraded':
      return 1
    case 'healthy':
      return 2
    default:
      return 3
  }
}

function groupChangesByDeployment(
  changes: TopologyChange[],
  snapshot: TopologySnapshot
): DeploymentChangeGroup[] {
  const deploymentMap = new Map<
    string,
    { deployment: Deployment; changes: TopologyChange[] }
  >()
  for (const deployment of snapshot.deployments) {
    deploymentMap.set(deployment.id, { deployment, changes: [] })
  }

  for (const change of changes) {
    for (const depId of change.deploymentIds) {
      deploymentMap.get(depId)?.changes.push(change)
    }
  }

  const groups: DeploymentChangeGroup[] = []
  for (const { deployment, changes } of deploymentMap.values()) {
    if (changes.length === 0) continue

    const layerMap = new Map<keyof DeploymentComponentStatus, TopologyChange[]>()
    for (const change of changes) {
      const layer = change.kindLabel ? KIND_TO_LAYER[change.kindLabel] : undefined
      if (layer) {
        layerMap.get(layer)?.push(change) ?? layerMap.set(layer, [change])
      } else {
        // domain or unknown — place in backend as the default visible layer
        layerMap.get('backend')?.push(change) ?? layerMap.set('backend', [change])
      }
    }

    const layers: LayerGroup[] = []
    for (const key of LAYER_ORDER) {
      const layerChanges = layerMap.get(key)
      if (layerChanges && layerChanges.length > 0) {
        layers.push({ key, label: DEPLOYMENT_COMPONENT_LABELS[key], changes: layerChanges })
      }
    }

    groups.push({ deployment, layers, changeCount: changes.length })
  }

  groups.sort((a, b) => {
    const severity = severityRank(a.deployment.health) - severityRank(b.deployment.health)
    if (severity !== 0) return severity
    return b.changeCount - a.changeCount
  })

  return groups
}

function groupUnaffiliatedChanges(
  changes: TopologyChange[],
  snapshot: TopologySnapshot
): TopologyChange[] {
  return changes.filter((change) => {
    if (change.deploymentIds.length === 0) return true
    return !change.deploymentIds.some((id) => snapshot.deployments.some((d) => d.id === id))
  })
}

export { groupChangesByDeployment, groupUnaffiliatedChanges, LAYER_ORDER, KIND_TO_LAYER }

const STRUCTURAL_CHANGE_RANK = 0
const STATUS_CHANGE_RANK = 1
const ADD_REMOVE_RANK = 2
const RELATIONSHIP_RANK = 3

export function changeSortRank(change: TopologyChange): number {
  if (change.kind === 'relationship_added' || change.kind === 'relationship_removed') {
    return RELATIONSHIP_RANK
  }
  if (change.kind === 'entity_added' || change.kind === 'entity_removed') {
    return ADD_REMOVE_RANK
  }
  if (change.kind === 'entity_modified') {
    const hasSourceRefChange =
      change.before?.sourceRef && change.after?.sourceRef
        ? JSON.stringify(change.before.sourceRef) !== JSON.stringify(change.after.sourceRef)
        : change.before?.sourceRef !== change.after?.sourceRef
    return hasSourceRefChange ? STRUCTURAL_CHANGE_RANK : STATUS_CHANGE_RANK
  }
  return ADD_REMOVE_RANK
}

export function sortChangesWithinLayer(changes: TopologyChange[]): TopologyChange[] {
  return [...changes].sort((a, b) => changeSortRank(a) - changeSortRank(b))
}
