import type {
  Deployment,
  Relationship,
  TopologyEntity,
  TopologyInsight
} from '@shared/topology'

function backendKeyFromRelationship(
  rel: Relationship,
  entities: Record<string, TopologyEntity>
): string | null {
  if (rel.type !== 'proxies_to' || rel.to.kind !== 'port') return null
  const portEntity = entities[rel.to.id]
  if (!portEntity?.sourceRef?.port) return null
  return `:${portEntity.sourceRef.port}`
}

export function detectSharedBackends(
  deployments: Deployment[],
  relationships: Relationship[],
  entities: Record<string, TopologyEntity>
): TopologyInsight[] {
  const backendToDeployments = new Map<
    string,
    { deploymentIds: string[]; evidence: Relationship[]; portEntityIds: Set<string> }
  >()

  for (const deployment of deployments) {
    const deploymentRels = relationships.filter(
      (rel) =>
        deployment.entityIds.includes(rel.from.id) || deployment.entityIds.includes(rel.to.id)
    )
    for (const rel of deploymentRels) {
      const key = backendKeyFromRelationship(rel, entities)
      if (!key) continue
      const entry = backendToDeployments.get(key) ?? {
        deploymentIds: [],
        evidence: [],
        portEntityIds: new Set<string>()
      }
      if (!entry.deploymentIds.includes(deployment.id)) {
        entry.deploymentIds.push(deployment.id)
      }
      entry.evidence.push(rel)
      entry.portEntityIds.add(rel.to.id)
      backendToDeployments.set(key, entry)
    }
  }

  const insights: TopologyInsight[] = []
  let insightCounter = 0

  for (const [backend, entry] of backendToDeployments) {
    if (entry.deploymentIds.length < 2) continue
    insightCounter += 1
    const evidence = entry.evidence.flatMap((rel) => rel.evidence)
    insights.push({
      id: `insight-shared-backend-${insightCounter}`,
      type: 'shared_backend',
      deploymentIds: entry.deploymentIds,
      label: `${entry.deploymentIds.length} domains → same backend ${backend}`,
      confidence: 'confirmed',
      evidence,
      portEntityIds: [...entry.portEntityIds]
    })
  }

  return insights
}
