import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { portEntityId } from '@shared/topology'
import { buildTopologyFromOrbstack } from './buildTopologyFromOrbstack'
import {
  deploymentByDomain,
  entityIdsForDeployment,
  restoreFullstack,
  stopApiContainer
} from './deploymentsTopology.helpers'
import { ORBSTACK_DOMAIN, connectOrbstack, type OrbstackSession } from './orbstackSsh'

const SHOP_DOMAIN = `shop.${ORBSTACK_DOMAIN}`
const API_DOMAIN = `api.${ORBSTACK_DOMAIN}`
const INTEGRATION_ENABLED = process.env.ZVIA_ORB_INTEGRATION === '1'

describe.skipIf(!INTEGRATION_ENABLED)('deployments topology broken API container', () => {
  let session: OrbstackSession

  beforeAll(async () => {
    session = await connectOrbstack()
    await restoreFullstack(session)
    await stopApiContainer(session)
  }, 120_000)

  afterAll(async () => {
    await restoreFullstack(session)
    session.close()
  }, 120_000)

  it('marks api deployment failed while shop stays healthy', async () => {
    const snapshot = await buildTopologyFromOrbstack(session)
    const shop = deploymentByDomain(snapshot.deployments, SHOP_DOMAIN)
    const api = deploymentByDomain(snapshot.deployments, API_DOMAIN)

    expect(shop?.health).toBe('healthy')
    expect(api?.health).toBe('failed')
    expect(api?.componentStatus.backend).toBe('failed')

    const apiPortId = portEntityId('tcp', '127.0.0.1', 3001)
    const apiEntities = entityIdsForDeployment(snapshot, API_DOMAIN)
    expect(apiEntities).toContain(apiPortId)
    expect(snapshot.entities[apiPortId]?.status).toBe('failed')

    const apiContainer = Object.values(snapshot.entities).find(
      (entity) => entity.kind === 'docker_container' && /api/i.test(entity.label)
    )
    expect(apiContainer?.status).toBe('failed')
  }, 60_000)
})
