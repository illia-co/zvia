import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { domainEntityId, portEntityId } from '@shared/topology'
import { buildTopologyFromOrbstack } from './buildTopologyFromOrbstack'
import {
  deploymentByDomain,
  deploymentByName,
  entityIdsForDeployment,
  hasRelationship,
  restoreFullstack
} from './deploymentsTopology.helpers'
import {
  ORBSTACK_DOMAIN,
  canConnectToOrbstack,
  connectOrbstack,
  isFullstackProvisioned,
  type OrbstackSession
} from './orbstackSsh'

const SHOP_DOMAIN = `shop.${ORBSTACK_DOMAIN}`
const API_DOMAIN = `api.${ORBSTACK_DOMAIN}`
const INTEGRATION_ENABLED = process.env.ZVIA_ORB_INTEGRATION === '1'

describe.skipIf(!INTEGRATION_ENABLED)('deployments topology (orbstack integration)', () => {
  let session: OrbstackSession

  beforeAll(async () => {
    const available = await canConnectToOrbstack()
    if (!available) {
      throw new Error(
        'OrbStack SSH is not reachable. Run `npm run orbstack:provision:fullstack` and set ZVIA_ORB_INTEGRATION=1.'
      )
    }

    session = await connectOrbstack()
    const fullstack = await isFullstackProvisioned(session)
    if (!fullstack) {
      session.close()
      throw new Error(
        'Fullstack marker not found. Run `npm run orbstack:provision:fullstack` before topology integration tests.'
      )
    }

    await restoreFullstack(session)
  }, 120_000)

  afterAll(() => {
    session?.close()
  })

  it('scan returns shop and api deployments', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const names = snapshot.deployments.map((deployment) => deployment.name)

    expect(snapshot.deployments.length).toBeGreaterThanOrEqual(2)
    expect(names).toContain(SHOP_DOMAIN)
    expect(names).toContain(API_DOMAIN)
  })

  it('builds nginx → port → container chains for shop and api', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const shopEntities = entityIdsForDeployment(snapshot, SHOP_DOMAIN)
    const apiEntities = entityIdsForDeployment(snapshot, API_DOMAIN)

    const shopSiteId = shopEntities.find((id) => id.startsWith('nginx:'))
    const apiSiteId = apiEntities.find((id) => id.startsWith('nginx:'))
    const shopPortId = shopEntities.find((id) => id.includes(':3000'))
    const apiPortId = apiEntities.find((id) => id.includes(':3001'))
    const shopContainerId = shopEntities.find((id) => id.startsWith('container:'))
    const apiContainerId = apiEntities.find((id) => id.startsWith('container:'))

    expect(shopSiteId).toBeDefined()
    expect(apiSiteId).toBeDefined()
    expect(shopPortId).toBeDefined()
    expect(apiPortId).toBeDefined()
    expect(shopContainerId).toBeDefined()
    expect(apiContainerId).toBeDefined()

    expect(hasRelationship(snapshot.relationships, shopSiteId!, shopPortId!, 'proxies_to')).toBe(true)
    expect(hasRelationship(snapshot.relationships, apiSiteId!, apiPortId!, 'proxies_to')).toBe(true)
    expect(hasRelationship(snapshot.relationships, shopPortId!, shopContainerId!, 'published_by')).toBe(true)
    expect(hasRelationship(snapshot.relationships, apiPortId!, apiContainerId!, 'published_by')).toBe(true)

    const shopContainer = snapshot.entities[shopContainerId!]
    const apiContainer = snapshot.entities[apiContainerId!]
    expect(shopContainer?.label).toMatch(/frontend/i)
    expect(apiContainer?.label).toMatch(/api/i)
  })

  it('uses distinct nginx site IDs per TLS server block', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const shopEntities = entityIdsForDeployment(snapshot, SHOP_DOMAIN)
    const apiEntities = entityIdsForDeployment(snapshot, API_DOMAIN)

    const shopSiteIds = shopEntities.filter((id) => id.startsWith('nginx:'))
    const apiSiteIds = apiEntities.filter((id) => id.startsWith('nginx:'))

    expect(shopSiteIds).toHaveLength(1)
    expect(apiSiteIds).toHaveLength(1)
    expect(shopSiteIds[0]).not.toBe(apiSiteIds[0])

    expect(shopSiteIds[0]).toContain('/zvia-fullstack')
    expect(apiSiteIds[0]).toContain('/zvia-fullstack')
  })

  it('does not leak shop entities into the api deployment', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const shopEntities = entityIdsForDeployment(snapshot, SHOP_DOMAIN)
    const apiEntities = entityIdsForDeployment(snapshot, API_DOMAIN)

    const shopPortId = portEntityId('tcp', '127.0.0.1', 3000)
    const shopDomainId = domainEntityId(SHOP_DOMAIN)

    expect(shopEntities).toContain(shopDomainId)
    expect(shopEntities).toContain(shopPortId)
    expect(apiEntities).not.toContain(shopDomainId)
    expect(apiEntities).not.toContain(shopPortId)

    for (const entityId of apiEntities) {
      const entity = snapshot.entities[entityId]
      expect(entity?.label.toLowerCase()).not.toContain('shop')
      if (entity?.kind === 'port') {
        expect(entity.sourceRef?.port).not.toBe(3000)
      }
    }
  })

  it('reports healthy deployments when the fullstack is running', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const shop = deploymentByDomain(snapshot.deployments, SHOP_DOMAIN)
    const api = deploymentByDomain(snapshot.deployments, API_DOMAIN)

    expect(shop?.health).toBe('healthy')
    expect(api?.health).toBe('healthy')
    expect(shop?.componentStatus.backend).toBe('healthy')
    expect(api?.componentStatus.backend).toBe('healthy')
    expect(shop?.componentStatus.container).toBe('healthy')
    expect(api?.componentStatus.container).toBe('healthy')
  })

  it('detects the no-nginx compose project as a deployment', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const deployment = deploymentByName(snapshot.deployments, 'zvia-nonnginx')

    expect(deployment).toBeDefined()
    expect(deployment?.name).toBe('zvia-nonnginx')
    expect(deployment?.id).toBe(`deployment:zvia-nonnginx`)
    expect(deployment?.entrypoints).toContainEqual({
      kind: 'docker_compose_service',
      id: 'compose:zvia-nonnginx'
    })

    const entityIds = deployment!.entityIds
    expect(entityIds).toContain('compose:zvia-nonnginx')

    const portId = entityIds.find((id) => id.includes(':4001'))
    expect(portId).toBeDefined()

    const containerInProject = entityIds.find((id) => {
      const entity = snapshot.entities[id]
      return entity?.kind === 'docker_container' && entity.sourceRef?.composeProject === 'zvia-nonnginx'
    })
    expect(containerInProject).toBeDefined()

    expect(
      hasRelationship(snapshot.relationships, portId!, containerInProject!, 'published_by')
    ).toBe(true)
  })

  it('reports healthy no-nginx deployment with api + db containers', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const deployment = deploymentByName(snapshot.deployments, 'zvia-nonnginx')

    expect(deployment?.health).toBe('healthy')
    expect(deployment?.componentStatus.backend).toBe('healthy')
    expect(deployment?.componentStatus.container).toBe('healthy')

    const apiContainerId = deployment!.entityIds.find((id) => {
      const entity = snapshot.entities[id]
      return entity?.kind === 'docker_container' && entity.sourceRef?.composeService === 'api'
    })
    const pgContainerId = deployment!.entityIds.find((id) => {
      const entity = snapshot.entities[id]
      return entity?.kind === 'docker_container' && entity.sourceRef?.composeService === 'postgres'
    })
    expect(apiContainerId).toBeDefined()
    expect(pgContainerId).toBeDefined()
    expect(
      hasRelationship(snapshot.relationships, apiContainerId!, 'compose:zvia-nonnginx', 'member_of')
    ).toBe(true)
    expect(
      hasRelationship(snapshot.relationships, pgContainerId!, 'compose:zvia-nonnginx', 'member_of')
    ).toBe(true)
  })
})
