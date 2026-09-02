import type {
  TopologyChange,
  TopologyEntity,
  TopologySnapshot
} from '@shared/topology'

function entityState(entity: TopologyEntity): TopologyChange['before'] {
  return { status: entity.status, sourceRef: entity.sourceRef }
}

function sourcesEqual(
  before?: Record<string, string | number | boolean | null>,
  after?: Record<string, string | number | boolean | null>
): boolean {
  if (before === after) return true
  if (!before || !after) return false
  const beforeKeys = Object.keys(before)
  if (beforeKeys.length !== Object.keys(after).length) return false
  return beforeKeys.every((key) => before[key] === after[key])
}

function deploymentIdsFor(snapshot: TopologySnapshot, entityId: string): string[] {
  return snapshot.deployments
    .filter((deployment) => deployment.entityIds.includes(entityId))
    .map((deployment) => deployment.id)
}

/**
 * A relationship belongs to every deployment that owns either endpoint. The
 * main Deployments list assigns entities to a deployment via
 * `Deployment.entityIds` (built by `clusterDeployments`); relationship changes
 * reuse that same ownership so a link never leaks into a deployment that owns
 * neither side of it.
 */
function deploymentIdsForRelationship(
  snapshot: TopologySnapshot,
  fromId: string,
  toId: string
): string[] {
  const ids = new Set<string>()
  for (const entityId of [fromId, toId]) {
    for (const deploymentId of deploymentIdsFor(snapshot, entityId)) {
      ids.add(deploymentId)
    }
  }
  return [...ids]
}

function diffEntities(
  before: TopologySnapshot,
  after: TopologySnapshot,
  changes: TopologyChange[]
): void {
  for (const [id, entity] of Object.entries(after.entities)) {
    const previous = before.entities[id]
    if (!previous) {
      changes.push({
        kind: 'entity_added',
        entityId: id,
        kindLabel: entity.kind,
        label: entity.label,
        after: entityState(entity),
        deploymentIds: deploymentIdsFor(after, id)
      })
      continue
    }
    const statusChanged = previous.status !== entity.status
    const sourceChanged = !sourcesEqual(previous.sourceRef, entity.sourceRef)
    if (statusChanged || sourceChanged) {
      changes.push({
        kind: 'entity_modified',
        entityId: id,
        kindLabel: entity.kind,
        label: entity.label,
        before: entityState(previous),
        after: entityState(entity),
        deploymentIds: deploymentIdsFor(after, id)
      })
    }
  }

  for (const [id, entity] of Object.entries(before.entities)) {
    if (!after.entities[id]) {
      changes.push({
        kind: 'entity_removed',
        entityId: id,
        kindLabel: entity.kind,
        label: entity.label,
        before: entityState(entity),
        deploymentIds: deploymentIdsFor(before, id)
      })
    }
  }
}

function diffRelationships(
  before: TopologySnapshot,
  after: TopologySnapshot,
  changes: TopologyChange[]
): void {
  const beforeById = new Map(before.relationships.map((relationship) => [relationship.id, relationship]))
  const afterById = new Map(after.relationships.map((relationship) => [relationship.id, relationship]))

  for (const relationship of after.relationships) {
    if (!beforeById.has(relationship.id)) {
      changes.push({
        kind: 'relationship_added',
        entityId: relationship.id,
        relationship: {
          type: relationship.type,
          from: relationship.from.id,
          to: relationship.to.id,
          confidence: relationship.confidence
        },
        deploymentIds: deploymentIdsForRelationship(after, relationship.from.id, relationship.to.id)
      })
    }
  }

  for (const relationship of before.relationships) {
    if (!afterById.has(relationship.id)) {
      changes.push({
        kind: 'relationship_removed',
        entityId: relationship.id,
        relationship: {
          type: relationship.type,
          from: relationship.from.id,
          to: relationship.to.id,
          confidence: relationship.confidence
        },
        deploymentIds: deploymentIdsForRelationship(before, relationship.from.id, relationship.to.id)
      })
    }
  }
}

export function diffTopology(
  before: TopologySnapshot,
  after: TopologySnapshot
): TopologyChange[] {
  const changes: TopologyChange[] = []
  diffEntities(before, after, changes)
  diffRelationships(before, after, changes)
  return changes
}

function processComm(sourceRef?: Record<string, string | number | boolean | null>): string | null {
  const comm = sourceRef?.comm
  return typeof comm === 'string' ? comm : null
}

/**
 * Removes pure PID churn: a process entity that disappears and is replaced by
 * another process with the same runtime (`comm`) is a restart, not a structural
 * change. A process that is added or removed with no matching counterpart is
 * kept as a genuine structural change.
 */
export function filterProcessChurn(changes: TopologyChange[]): TopologyChange[] {
  const addedComms = new Set<string>()
  const removedComms = new Set<string>()

  for (const change of changes) {
    if (change.kindLabel !== 'process') continue
    if (change.kind === 'entity_added') {
      const comm = processComm(change.after?.sourceRef)
      if (comm) addedComms.add(comm)
    } else if (change.kind === 'entity_removed') {
      const comm = processComm(change.before?.sourceRef)
      if (comm) removedComms.add(comm)
    }
  }

  const churnComms = new Set([...addedComms].filter((comm) => removedComms.has(comm)))
  if (churnComms.size === 0) return changes

  return changes.filter((change) => {
    if (change.kindLabel !== 'process') return true
    if (change.kind === 'entity_added') {
      const comm = processComm(change.after?.sourceRef)
      return comm ? !churnComms.has(comm) : true
    }
    if (change.kind === 'entity_removed') {
      const comm = processComm(change.before?.sourceRef)
      return comm ? !churnComms.has(comm) : true
    }
    return true
  })
}

/**
 * Diffs two snapshots and returns only the changes that belong to a single
 * deployment (entities/relationships whose `deploymentIds` include the given
 * id), with PID churn filtered out. Removed entities and relationships carry
 * their ownership via the "before" snapshot, so the filter still surfaces
 * deletions correctly.
 */
export function diffTopologyForDeployment(
  before: TopologySnapshot,
  after: TopologySnapshot,
  deploymentId: string
): TopologyChange[] {
  return filterProcessChurn(
    diffTopology(before, after).filter((change) => change.deploymentIds.includes(deploymentId))
  )
}
