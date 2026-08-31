import { describe, expect, it } from 'vitest'
import type { Relationship, TopologyEntity } from '@shared/topology'
import {
  containerEntityId,
  deploymentEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId
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
