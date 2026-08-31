import type { Deployment, Relationship } from '@shared/topology'
import { deploymentEntityId } from '@shared/topology'
import type { OrbstackSession } from './orbstackSsh'
import { buildTopologyFromOrbstack } from './buildTopologyFromOrbstack'

export type TopologySnapshot = Awaited<ReturnType<typeof buildTopologyFromOrbstack>>

export function deploymentByDomain(deployments: Deployment[], domain: string): Deployment | undefined {
  return deployments.find((deployment) => deployment.id === deploymentEntityId(domain))
}

export function hasRelationship(
  relationships: Relationship[],
  fromId: string,
  toId: string,
  type: Relationship['type']
): boolean {
  return relationships.some(
    (relationship) =>
      relationship.type === type && relationship.from.id === fromId && relationship.to.id === toId
  )
}

export function entityIdsForDeployment(snapshot: TopologySnapshot, domain: string) {
  const deployment = deploymentByDomain(snapshot.deployments, domain)
  if (!deployment) {
    throw new Error(`Deployment not found for ${domain}`)
  }
  return deployment.entityIds
}

export async function stopApiContainer(session: OrbstackSession): Promise<void> {
  const result = await session.exec(
    'sudo docker ps -aq --filter "label=com.zvia.role=api" | head -1 | xargs -r sudo docker stop'
  )
  if (result.exitCode !== 0) {
    throw new Error(`Failed to stop API container: ${result.stderr || result.stdout}`)
  }
}

export async function restoreFullstack(session: OrbstackSession): Promise<void> {
  await session.exec('sudo docker compose -f /opt/zvia-demo/docker-compose.yml -p zvia-demo up -d', 120_000)
}
