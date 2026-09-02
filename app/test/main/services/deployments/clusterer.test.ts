import { describe, expect, it } from 'vitest'
import type { Relationship, TopologyEntity } from '@shared/topology'
import {
  composeServiceEntityId,
  containerEntityId,
  deploymentEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId,
  processEntityId,
  unitEntityId
} from '@shared/topology'
import { clusterDeployments } from '@main/services/deployments/clusterer'
import { detectSharedBackends } from '@main/services/deployments/insights'

describe('topologyClusterer', () => {
  it('creates two deployments when two domains share a backend', () => {
    const appDomain = domainEntityId('app.example.com')
    const adminDomain = domainEntityId('admin.example.com')
    const appSite = nginxSiteEntityId('/etc/nginx/sites-enabled/app', 10)
    const adminSite = nginxSiteEntityId('/etc/nginx/sites-enabled/admin', 20)
    const backendPort = portEntityId('tcp', '127.0.0.1', 3000)

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: appDomain },
        to: { kind: 'nginx_site', id: appSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'domain', id: adminDomain },
        to: { kind: 'nginx_site', id: adminSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r3',
        from: { kind: 'nginx_site', id: appSite },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: [{ source: 'nginx-T', kind: 'directive', detail: 'app', observedAt: 't' }]
      },
      {
        id: 'r4',
        from: { kind: 'nginx_site', id: adminSite },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: [{ source: 'nginx-T', kind: 'directive', detail: 'admin', observedAt: 't' }]
      }
    ]

    const entities: Record<string, TopologyEntity> = {
      [backendPort]: {
        id: backendPort,
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    }

    const { deployments, insights } = clusterDeployments({
      serverBlocks: [
        { serverNames: ['app.example.com'] },
        { serverNames: ['admin.example.com'] }
      ],
      relationships,
      entities
    })

    expect(deployments).toHaveLength(2)
    expect(deployments.map((deployment) => deployment.id)).toEqual([
      deploymentEntityId('app.example.com'),
      deploymentEntityId('admin.example.com')
    ])
    expect(insights).toHaveLength(1)
    expect(insights[0].type).toBe('shared_backend')
    expect(insights[0].deploymentIds).toHaveLength(2)

    const appDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId('app.example.com')
    )
    const adminDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId('admin.example.com')
    )

    expect(appDeployment?.entityIds).toContain(appDomain)
    expect(appDeployment?.entityIds).toContain(appSite)
    expect(appDeployment?.entityIds).toContain(backendPort)
    expect(appDeployment?.entityIds).not.toContain(adminDomain)
    expect(appDeployment?.entityIds).not.toContain(adminSite)

    expect(adminDeployment?.entityIds).toContain(adminDomain)
    expect(adminDeployment?.entityIds).toContain(adminSite)
    expect(adminDeployment?.entityIds).toContain(backendPort)
    expect(adminDeployment?.entityIds).not.toContain(appDomain)
    expect(adminDeployment?.entityIds).not.toContain(appSite)
  })

  it('isolates entityIds per domain when three domains share a backend', () => {
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const apiDomain = domainEntityId('api.zvia-test.local')
    const adminDomain = domainEntityId('admin.zvia-test.local')
    const shopSite = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const apiSite = nginxSiteEntityId('/etc/nginx/sites-enabled/api', 20)
    const adminSite = nginxSiteEntityId('/etc/nginx/sites-enabled/admin', 30)
    const backendPort = portEntityId('tcp', '127.0.0.1', 3000)

    const relationships: Relationship[] = [
      {
        id: 'r-shop-domain',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: shopSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-api-domain',
        from: { kind: 'domain', id: apiDomain },
        to: { kind: 'nginx_site', id: apiSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-admin-domain',
        from: { kind: 'domain', id: adminDomain },
        to: { kind: 'nginx_site', id: adminSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-shop-proxy',
        from: { kind: 'nginx_site', id: shopSite },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-api-proxy',
        from: { kind: 'nginx_site', id: apiSite },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-admin-proxy',
        from: { kind: 'nginx_site', id: adminSite },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      }
    ]

    const entities: Record<string, TopologyEntity> = {
      [shopDomain]: {
        id: shopDomain,
        kind: 'domain',
        label: 'shop.zvia-test.local',
        status: 'healthy'
      },
      [apiDomain]: {
        id: apiDomain,
        kind: 'domain',
        label: 'api.zvia-test.local',
        status: 'healthy'
      },
      [adminDomain]: {
        id: adminDomain,
        kind: 'domain',
        label: 'admin.zvia-test.local',
        status: 'healthy'
      },
      [shopSite]: {
        id: shopSite,
        kind: 'nginx_site',
        label: 'shop.zvia-test.local',
        status: 'healthy'
      },
      [apiSite]: {
        id: apiSite,
        kind: 'nginx_site',
        label: 'api.zvia-test.local',
        status: 'healthy'
      },
      [adminSite]: {
        id: adminSite,
        kind: 'nginx_site',
        label: 'admin.zvia-test.local',
        status: 'healthy'
      },
      [backendPort]: {
        id: backendPort,
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    }

    const { deployments } = clusterDeployments({
      serverBlocks: [
        { serverNames: ['shop.zvia-test.local'] },
        { serverNames: ['api.zvia-test.local'] },
        { serverNames: ['admin.zvia-test.local'] }
      ],
      relationships,
      entities
    })

    expect(deployments).toHaveLength(3)

    const shopDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId('shop.zvia-test.local')
    )

    expect(shopDeployment?.entityIds).toContain(shopDomain)
    expect(shopDeployment?.entityIds).toContain(shopSite)
    expect(shopDeployment?.entityIds).toContain(backendPort)
    expect(shopDeployment?.entityIds).not.toContain(apiDomain)
    expect(shopDeployment?.entityIds).not.toContain(apiSite)
    expect(shopDeployment?.entityIds).not.toContain(adminDomain)
    expect(shopDeployment?.entityIds).not.toContain(adminSite)
  })

  it('does not leak shop backend into api deployment when redirect block shares primary name', () => {
    const configPath = '/etc/nginx/sites-available/zvia-fullstack'
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const apiDomain = domainEntityId('api.zvia-test.local')
    const redirectSite = nginxSiteEntityId(configPath, 1)
    const shopSite = nginxSiteEntityId(configPath, 20)
    const apiSite = nginxSiteEntityId(configPath, 40)
    const shopPort = portEntityId('tcp', '127.0.0.1', 3000)
    const apiPort = portEntityId('tcp', '127.0.0.1', 3001)
    const shopContainer = containerEntityId('shop-container')

    const relationships: Relationship[] = [
      {
        id: 'r-redirect-shop',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: redirectSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-redirect-api',
        from: { kind: 'domain', id: apiDomain },
        to: { kind: 'nginx_site', id: redirectSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-shop-site',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: shopSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-api-site',
        from: { kind: 'domain', id: apiDomain },
        to: { kind: 'nginx_site', id: apiSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-shop-proxy',
        from: { kind: 'nginx_site', id: shopSite },
        to: { kind: 'port', id: shopPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-api-proxy',
        from: { kind: 'nginx_site', id: apiSite },
        to: { kind: 'port', id: apiPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r-shop-container',
        from: { kind: 'port', id: shopPort },
        to: { kind: 'docker_container', id: shopContainer },
        type: 'published_by',
        confidence: 'confirmed',
        evidence: []
      }
    ]

    const entities: Record<string, TopologyEntity> = {
      [shopDomain]: { id: shopDomain, kind: 'domain', label: 'shop.zvia-test.local', status: 'healthy' },
      [apiDomain]: { id: apiDomain, kind: 'domain', label: 'api.zvia-test.local', status: 'healthy' },
      [redirectSite]: { id: redirectSite, kind: 'nginx_site', label: 'shop, api', status: 'healthy' },
      [shopSite]: { id: shopSite, kind: 'nginx_site', label: 'shop.zvia-test.local', status: 'healthy' },
      [apiSite]: { id: apiSite, kind: 'nginx_site', label: 'api.zvia-test.local', status: 'healthy' },
      [shopPort]: {
        id: shopPort,
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      },
      [apiPort]: {
        id: apiPort,
        kind: 'port',
        label: ':3001',
        status: 'healthy',
        sourceRef: { port: 3001 }
      },
      [shopContainer]: {
        id: shopContainer,
        kind: 'docker_container',
        label: 'zvia-demo-frontend',
        status: 'healthy'
      }
    }

    const { deployments } = clusterDeployments({
      serverBlocks: [
        { serverNames: ['shop.zvia-test.local', 'api.zvia-test.local'] },
        { serverNames: ['shop.zvia-test.local'] },
        { serverNames: ['api.zvia-test.local'] }
      ],
      relationships,
      entities
    })

    const apiDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId('api.zvia-test.local')
    )

    expect(apiDeployment?.entityIds).toContain(apiDomain)
    expect(apiDeployment?.entityIds).toContain(apiSite)
    expect(apiDeployment?.entityIds).toContain(apiPort)
    expect(apiDeployment?.entityIds).not.toContain(shopDomain)
    expect(apiDeployment?.entityIds).not.toContain(shopSite)
    expect(apiDeployment?.entityIds).not.toContain(shopPort)
    expect(apiDeployment?.entityIds).not.toContain(shopContainer)
    expect(apiDeployment?.entityIds).not.toContain(redirectSite)
  })
})

describe('topologyClusterer container deployments', () => {
  function makeComposeRel(
    id: string,
    containerId: string,
    composeId: string
  ): Relationship {
    return {
      id,
      from: { kind: 'docker_container', id: containerId },
      to: { kind: 'docker_compose_service', id: composeId },
      type: 'member_of',
      confidence: 'confirmed',
      evidence: []
    }
  }

  function makePublishRel(id: string, portId: string, containerId: string): Relationship {
    return {
      id,
      from: { kind: 'port', id: portId },
      to: { kind: 'docker_container', id: containerId },
      type: 'published_by',
      confidence: 'confirmed',
      evidence: []
    }
  }

  it('groups a compose project into one deployment with a compose entrypoint', () => {
    const composeId = composeServiceEntityId('zvia-nonnginx')
    const api = containerEntityId('api-container')
    const db = containerEntityId('db-container')
    const apiPort = portEntityId('tcp', '127.0.0.1', 4001)

    const relationships: Relationship[] = [
      makeComposeRel('m-api', api, composeId),
      makeComposeRel('m-db', db, composeId),
      makePublishRel('p-api', apiPort, api)
    ]

    const entities: Record<string, TopologyEntity> = {
      [composeId]: { id: composeId, kind: 'docker_compose_service', label: 'zvia-nonnginx', status: 'unknown' },
      [api]: { id: api, kind: 'docker_container', label: 'api', status: 'healthy' },
      [db]: { id: db, kind: 'docker_container', label: 'postgres', status: 'healthy' },
      [apiPort]: {
        id: apiPort,
        kind: 'port',
        label: ':4001',
        status: 'healthy',
        sourceRef: { port: 4001 }
      }
    }

    const { deployments } = clusterDeployments({ serverBlocks: [], relationships, entities })

    expect(deployments).toHaveLength(1)
    expect(deployments[0].name).toBe('zvia-nonnginx')
    expect(deployments[0].id).toBe(deploymentEntityId('zvia-nonnginx'))
    expect(deployments[0].entrypoints).toEqual([
      { kind: 'docker_compose_service', id: composeId }
    ])
    expect(deployments[0].entityIds).toEqual(
      expect.arrayContaining([api, db, apiPort, composeId])
    )
  })

  it('does not duplicate a compose project that backs an nginx deployment', () => {
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const composeId = composeServiceEntityId('zvia-demo')
    const frontend = containerEntityId('frontend-container')
    const api = containerEntityId('api-container')
    const shopSite = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const shopPort = portEntityId('tcp', '127.0.0.1', 3000)

    const relationships: Relationship[] = [
      {
        id: 'serves',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: shopSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'proxy',
        from: { kind: 'nginx_site', id: shopSite },
        to: { kind: 'port', id: shopPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      makePublishRel('pub', shopPort, frontend),
      makeComposeRel('m-front', frontend, composeId),
      makeComposeRel('m-api', api, composeId)
    ]

    const entities: Record<string, TopologyEntity> = {
      [shopDomain]: { id: shopDomain, kind: 'domain', label: 'shop.zvia-test.local', status: 'healthy' },
      [shopSite]: { id: shopSite, kind: 'nginx_site', label: 'shop.zvia-test.local', status: 'healthy' },
      [composeId]: { id: composeId, kind: 'docker_compose_service', label: 'zvia-demo', status: 'unknown' },
      [frontend]: { id: frontend, kind: 'docker_container', label: 'zvia-demo-frontend', status: 'healthy' },
      [api]: { id: api, kind: 'docker_container', label: 'zvia-demo-api', status: 'healthy' },
      [shopPort]: {
        id: shopPort,
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    }

    const { deployments } = clusterDeployments({
      serverBlocks: [{ serverNames: ['shop.zvia-test.local'] }],
      relationships,
      entities
    })

    expect(deployments).toHaveLength(1)
    expect(deployments.map((deployment) => deployment.id)).toEqual([
      deploymentEntityId('shop.zvia-test.local')
    ])
    expect(deployments.some((deployment) => deployment.name === 'zvia-demo')).toBe(false)
  })

  it('does not leak a sibling published port through shared compose membership', () => {
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const apiDomain = domainEntityId('api.zvia-test.local')
    const composeId = composeServiceEntityId('zvia-demo')
    const frontend = containerEntityId('frontend-container')
    const apiBackend = containerEntityId('api-container')
    const shopSite = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const apiSite = nginxSiteEntityId('/etc/nginx/sites-enabled/api', 20)
    const shopPort = portEntityId('tcp', '127.0.0.1', 3000)
    const apiPort = portEntityId('tcp', '127.0.0.1', 3001)

    const relationships: Relationship[] = [
      {
        id: 'serves-shop',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: shopSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'serves-api',
        from: { kind: 'domain', id: apiDomain },
        to: { kind: 'nginx_site', id: apiSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'proxy-shop',
        from: { kind: 'nginx_site', id: shopSite },
        to: { kind: 'port', id: shopPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'proxy-api',
        from: { kind: 'nginx_site', id: apiSite },
        to: { kind: 'port', id: apiPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      makePublishRel('pub-shop', shopPort, frontend),
      makePublishRel('pub-api', apiPort, apiBackend),
      makeComposeRel('m-front', frontend, composeId),
      makeComposeRel('m-api', apiBackend, composeId)
    ]

    const entities: Record<string, TopologyEntity> = {
      [shopDomain]: { id: shopDomain, kind: 'domain', label: 'shop.zvia-test.local', status: 'healthy' },
      [apiDomain]: { id: apiDomain, kind: 'domain', label: 'api.zvia-test.local', status: 'healthy' },
      [shopSite]: { id: shopSite, kind: 'nginx_site', label: 'shop.zvia-test.local', status: 'healthy' },
      [apiSite]: { id: apiSite, kind: 'nginx_site', label: 'api.zvia-test.local', status: 'healthy' },
      [composeId]: { id: composeId, kind: 'docker_compose_service', label: 'zvia-demo', status: 'unknown' },
      [frontend]: { id: frontend, kind: 'docker_container', label: 'zvia-demo-frontend', status: 'healthy' },
      [apiBackend]: { id: apiBackend, kind: 'docker_container', label: 'zvia-demo-api', status: 'healthy' },
      [shopPort]: { id: shopPort, kind: 'port', label: ':3000', status: 'healthy', sourceRef: { port: 3000 } },
      [apiPort]: { id: apiPort, kind: 'port', label: ':3001', status: 'healthy', sourceRef: { port: 3001 } }
    }

    const { deployments } = clusterDeployments({
      serverBlocks: [
        { serverNames: ['shop.zvia-test.local'] },
        { serverNames: ['api.zvia-test.local'] }
      ],
      relationships,
      entities
    })

    const apiDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId('api.zvia-test.local')
    )
    expect(apiDeployment?.entityIds).toContain(apiPort)
    expect(apiDeployment?.entityIds).toContain(apiBackend)
    expect(apiDeployment?.entityIds).not.toContain(shopPort)
    expect(apiDeployment?.entityIds).not.toContain(frontend)
  })

  it('does not skip a standalone compose project that shares a runtime unit with an nginx deployment', () => {
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const nonnginx = composeServiceEntityId('zvia-nonnginx')
    const frontend = containerEntityId('frontend-container')
    const api = containerEntityId('nonnginx-api')
    const db = containerEntityId('nonnginx-postgres')
    const shopSite = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const shopPort = portEntityId('tcp', '127.0.0.1', 3000)
    const apiPort = portEntityId('tcp', '127.0.0.1', 4001)
    const dockerUnit = unitEntityId('docker.service')
    const apiProcess = processEntityId(84299)

    const relationships: Relationship[] = [
      {
        id: 'serves-shop',
        from: { kind: 'domain', id: shopDomain },
        to: { kind: 'nginx_site', id: shopSite },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'proxy-shop',
        from: { kind: 'nginx_site', id: shopSite },
        to: { kind: 'port', id: shopPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      makePublishRel('pub-shop', shopPort, frontend),
      makePublishRel('pub-api', apiPort, api),
      {
        id: 'bound-api',
        from: { kind: 'port', id: apiPort },
        to: { kind: 'process', id: apiProcess },
        type: 'bound_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'managed-docker',
        from: { kind: 'process', id: apiProcess },
        to: { kind: 'systemd_unit', id: dockerUnit },
        type: 'managed_by',
        confidence: 'confirmed',
        evidence: []
      },
      makeComposeRel('m-api', api, nonnginx),
      makeComposeRel('m-db', db, nonnginx)
    ]

    const entities: Record<string, TopologyEntity> = {
      [shopDomain]: { id: shopDomain, kind: 'domain', label: 'shop.zvia-test.local', status: 'healthy' },
      [shopSite]: { id: shopSite, kind: 'nginx_site', label: 'shop.zvia-test.local', status: 'healthy' },
      [frontend]: { id: frontend, kind: 'docker_container', label: 'zvia-demo-frontend', status: 'healthy' },
      [nonnginx]: { id: nonnginx, kind: 'docker_compose_service', label: 'zvia-nonnginx', status: 'unknown' },
      [api]: { id: api, kind: 'docker_container', label: 'zvia-nonnginx-api', status: 'healthy' },
      [db]: { id: db, kind: 'docker_container', label: 'zvia-nonnginx-postgres', status: 'healthy' },
      [shopPort]: { id: shopPort, kind: 'port', label: ':3000', status: 'healthy', sourceRef: { port: 3000 } },
      [apiPort]: { id: apiPort, kind: 'port', label: ':4001', status: 'healthy', sourceRef: { port: 4001 } },
      [dockerUnit]: { id: dockerUnit, kind: 'systemd_unit', label: 'docker.service', status: 'healthy' },
      [apiProcess]: { id: apiProcess, kind: 'process', label: 'docker-proxy (84299)', status: 'healthy' }
    }

    const { deployments } = clusterDeployments({
      serverBlocks: [{ serverNames: ['shop.zvia-test.local'] }],
      relationships,
      entities
    })

    expect(deployments.map((deployment) => deployment.name)).toContain('zvia-nonnginx')
    const nonnginxDeployment = deployments.find(
      (deployment) => deployment.name === 'zvia-nonnginx'
    )
    expect(nonnginxDeployment?.entityIds).toEqual(
      expect.arrayContaining([api, db, apiPort, nonnginx])
    )
  })

  it('creates a port-entrypoint deployment for a standalone published container', () => {
    const web = containerEntityId('web-container')
    const webPort = portEntityId('tcp', '0.0.0.0', 8080)

    const relationships: Relationship[] = [makePublishRel('pub', webPort, web)]

    const entities: Record<string, TopologyEntity> = {
      [web]: {
        id: web,
        kind: 'docker_container',
        label: 'zvia-web',
        status: 'healthy',
        sourceRef: { networks: 'bridge' }
      },
      [webPort]: {
        id: webPort,
        kind: 'port',
        label: ':8080',
        status: 'healthy',
        sourceRef: { port: 8080 }
      }
    }

    const { deployments } = clusterDeployments({ serverBlocks: [], relationships, entities })

    expect(deployments).toHaveLength(1)
    expect(deployments[0].name).toBe('zvia-web')
    expect(deployments[0].entrypoints).toEqual([{ kind: 'port', id: webPort }])
    expect(deployments[0].entityIds).toEqual(expect.arrayContaining([web, webPort]))
  })

  it('uses a container entrypoint when a standalone container has no published port', () => {
    const db = containerEntityId('db-container')

    const { deployments } = clusterDeployments({
      serverBlocks: [],
      relationships: [],
      entities: {
        [db]: {
          id: db,
          kind: 'docker_container',
          label: 'postgres',
          status: 'healthy',
          sourceRef: { networks: 'bridge' }
        }
      }
    })

    expect(deployments).toHaveLength(1)
    expect(deployments[0].name).toBe('postgres')
    expect(deployments[0].entrypoints).toEqual([{ kind: 'docker_container', id: db }])
  })
})

describe('topologyInsights', () => {
  it('detects shared backend across deployments', () => {
    const backendPort = portEntityId('tcp', '127.0.0.1', 3000)
    const deployments = [
      {
        id: deploymentEntityId('a.example.com'),
        name: 'a.example.com',
        health: 'healthy' as const,
        entityIds: ['domain:a', 'nginx:a', backendPort],
        entrypoints: [{ kind: 'domain' as const, id: 'domain:a' }],
        stackSummary: '',
        componentStatus: {}
      },
      {
        id: deploymentEntityId('b.example.com'),
        name: 'b.example.com',
        health: 'healthy' as const,
        entityIds: ['domain:b', 'nginx:b', backendPort],
        entrypoints: [{ kind: 'domain' as const, id: 'domain:b' }],
        stackSummary: '',
        componentStatus: {}
      }
    ]

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'nginx_site', id: 'nginx:a' },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: 'nginx:b' },
        to: { kind: 'port', id: backendPort },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      }
    ]

    const entities: Record<string, TopologyEntity> = {
      [backendPort]: {
        id: backendPort,
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    }

    const insights = detectSharedBackends(deployments, relationships, entities)
    expect(insights).toHaveLength(1)
    expect(insights[0].label).toContain(':3000')
  })
})
