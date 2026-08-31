import type { Deployment, Relationship, TopologyEntity, TopologySnapshot } from '@shared/topology'
import type { Edge, Node } from '@xyflow/react'
import { entityKindLabel } from './topologyPresentation'
import { sharedPortEntityIds } from './topologyGraphQueries'

export interface TopologyNodeData extends Record<string, unknown> {
  entity: TopologyEntity
  kindLabel: string
  isEntrypoint: boolean
  isShared: boolean
}

export interface TopologyEdgeData extends Record<string, unknown> {
  relationship: Relationship
  confidence: Relationship['confidence']
}

export interface DeploymentGraph {
  nodes: Node<TopologyNodeData>[]
  edges: Edge<TopologyEdgeData>[]
  relationshipById: Map<string, Relationship>
}

function edgeLabel(relationship: Relationship): string {
  return relationship.label ?? relationship.type
}

export function buildDeploymentGraph(
  deployment: Deployment,
  snapshot: TopologySnapshot
): DeploymentGraph {
  const entityIdSet = new Set(deployment.entityIds)
  const entrypointIds = new Set(deployment.entrypoints.map((entry) => entry.id))
  const sharedPortIds = sharedPortEntityIds(deployment, snapshot.insights)

  const nodes: Node<TopologyNodeData>[] = deployment.entityIds
    .map((id) => snapshot.entities[id])
    .filter((entity): entity is TopologyEntity => entity !== undefined)
    .map((entity) => ({
      id: entity.id,
      type: 'topologyNode',
      position: { x: 0, y: 0 },
      data: {
        entity,
        kindLabel: entityKindLabel(entity.kind),
        isEntrypoint: entrypointIds.has(entity.id),
        isShared: sharedPortIds.has(entity.id)
      }
    }))

  const relationshipById = new Map<string, Relationship>()
  const edges: Edge<TopologyEdgeData>[] = []

  for (const relationship of snapshot.relationships) {
    if (relationship.type === 'member_of') continue
    if (!entityIdSet.has(relationship.from.id) || !entityIdSet.has(relationship.to.id)) {
      continue
    }

    relationshipById.set(relationship.id, relationship)
    edges.push({
      id: relationship.id,
      source: relationship.from.id,
      target: relationship.to.id,
      type: 'smoothstep',
      label: edgeLabel(relationship),
      data: {
        relationship,
        confidence: relationship.confidence
      }
    })
  }

  return { nodes, edges, relationshipById }
}

export {
  entityKindLabel,
  deploymentHealthDotClass,
  DEPLOYMENT_COMPONENT_LABELS,
  listDeploymentComponents,
  listDeploymentComponentIssues,
  formatComponentIssueMessage,
  formatDeploymentIssueSummary,
  deploymentHealthLabel,
  healthChipClass,
  componentChipClass,
  entityStatusDotClass,
  entityStatusBorderClass,
  type DeploymentComponentEntry
} from './topologyPresentation'

export {
  getEntityRelationships,
  getEntityDependencies,
  sharedPortEntityIds,
  type EntityRelationshipEntry
} from './topologyGraphQueries'
