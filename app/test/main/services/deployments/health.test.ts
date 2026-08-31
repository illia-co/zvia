import { describe, expect, it } from 'vitest'
import type { Deployment, Relationship, TopologyEntity } from '@shared/topology'
import {
  containerEntityId,
  deploymentEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId,
  processEntityId,
  unitEntityId
} from '@shared/topology'
import {
  applyEntityHealth,
  buildStackSummary,
  computeDeploymentHealth,
  enrichDeployments
} from '@main/services/deployments/health'

describe('topologyHealth', () => {
  it('reflects backend failure in deployment health', () => {
    const portId = portEntityId('tcp', '127.0.0.1', 3000)
    const processId = processEntityId(42)
    const unitId = unitEntityId('myapp.service')

    const deployment: Deployment = {
      id: deploymentEntityId('myapp.com'),
      name: 'myapp.com',
      health: 'unknown',
      entityIds: ['domain:myapp.com', 'nginx:site', portId, processId, unitId],
      entrypoints: [{ kind: 'domain', id: 'domain:myapp.com' }],
      stackSummary: '',
      componentStatus: {}
    }

    const entities: Record<string, TopologyEntity> = {
      'nginx:site': { id: 'nginx:site', kind: 'nginx_site', label: 'myapp.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3000',
        status: 'failed',
        sourceRef: { port: 3000 }
      },
      [processId]: { id: processId, kind: 'process', label: 'node', status: 'healthy' },
      [unitId]: {
        id: unitId,
        kind: 'systemd_unit',
        label: 'myapp.service',
        status: 'failed',
        sourceRef: { activeState: 'failed' }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: 'domain:myapp.com' },
        to: { kind: 'nginx_site', id: 'nginx:site' },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: 'nginx:site' },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r3',
        from: { kind: 'port', id: portId },
        to: { kind: 'process', id: processId },
        type: 'bound_to',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r4',
        from: { kind: 'process', id: processId },
        to: { kind: 'systemd_unit', id: unitId },
        type: 'managed_by',
        confidence: 'confirmed',
        evidence: []
      }
    ]

    const stackSummary = buildStackSummary(deployment, entities, relationships)
    expect(stackSummary).toContain('Nginx')
    expect(stackSummary).toContain(':3000')

    const { health, componentStatus } = computeDeploymentHealth(deployment, entities, relationships)
    expect(componentStatus.backend).toBe('failed')
    expect(health).toBe('failed')

    const enriched = enrichDeployments([deployment], entities, relationships)
    expect(enriched[0].stackSummary).toBe(stackSummary)
    expect(enriched[0].health).toBe('failed')
  })

  it('marks deployment failed when nginx is up but backend port is down', () => {
    const domainId = domainEntityId('api.example.com')
    const siteId = nginxSiteEntityId('/etc/nginx/sites-enabled/api', 10)
    const portId = portEntityId('tcp', '127.0.0.1', 3001)

    const deployment: Deployment = {
      id: deploymentEntityId('api.example.com'),
      name: 'api.example.com',
      health: 'unknown',
      entityIds: [domainId, siteId, portId],
      entrypoints: [{ kind: 'domain', id: domainId }],
      stackSummary: '',
      componentStatus: {}
    }

    const entities: Record<string, TopologyEntity> = {
      [domainId]: { id: domainId, kind: 'domain', label: 'api.example.com', status: 'healthy' },
      [siteId]: { id: siteId, kind: 'nginx_site', label: 'api.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3001',
        status: 'unknown',
        sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 3001 }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: domainId },
        to: { kind: 'nginx_site', id: siteId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'likely',
        evidence: []
      }
    ]

    const listeners: PortListener[] = []
    applyEntityHealth(entities, relationships, listeners)

    expect(entities[portId].status).toBe('failed')
    expect(entities[siteId].status).toBe('healthy')

    const { health, componentStatus } = computeDeploymentHealth(deployment, entities, relationships)
    expect(componentStatus.nginx).toBe('healthy')
    expect(componentStatus.backend).toBe('failed')
    expect(health).toBe('failed')
  })

  it('marks deployment failed when the backend container has exited', () => {
    const domainId = domainEntityId('api.example.com')
    const siteId = nginxSiteEntityId('/etc/nginx/sites-enabled/api', 10)
    const portId = portEntityId('tcp', '127.0.0.1', 3001)
    const containerId = containerEntityId('abc123')

    const deployment: Deployment = {
      id: deploymentEntityId('api.example.com'),
      name: 'api.example.com',
      health: 'unknown',
      entityIds: [domainId, siteId, portId, containerId],
      entrypoints: [{ kind: 'domain', id: domainId }],
      stackSummary: '',
      componentStatus: {}
    }

    const entities: Record<string, TopologyEntity> = {
      [domainId]: { id: domainId, kind: 'domain', label: 'api.example.com', status: 'healthy' },
      [siteId]: { id: siteId, kind: 'nginx_site', label: 'api.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3001',
        status: 'failed',
        sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 3001 }
      },
      [containerId]: {
        id: containerId,
        kind: 'docker_container',
        label: 'zvia-demo-api',
        status: 'healthy',
        sourceRef: { state: 'exited' }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: domainId },
        to: { kind: 'nginx_site', id: siteId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'likely',
        evidence: []
      },
      {
        id: 'r3',
        from: { kind: 'port', id: portId },
        to: { kind: 'docker_container', id: containerId },
        type: 'published_by',
        confidence: 'likely',
        evidence: []
      }
    ]

    applyEntityHealth(entities, relationships, [])

    expect(entities[containerId].status).toBe('failed')

    const { health, componentStatus } = computeDeploymentHealth(deployment, entities, relationships)
    expect(componentStatus.backend).toBe('failed')
    expect(componentStatus.container).toBe('failed')
    expect(health).toBe('failed')
  })

  it('propagates failed backend port to linked container', () => {
    const domainId = domainEntityId('shop.example.com')
    const siteId = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const portId = portEntityId('tcp', '127.0.0.1', 3000)
    const containerId = containerEntityId('frontend')

    const deployment: Deployment = {
      id: deploymentEntityId('shop.example.com'),
      name: 'shop.example.com',
      health: 'unknown',
      entityIds: [domainId, siteId, portId, containerId],
      entrypoints: [{ kind: 'domain', id: domainId }],
      stackSummary: '',
      componentStatus: {}
    }

    const entities: Record<string, TopologyEntity> = {
      [domainId]: { id: domainId, kind: 'domain', label: 'shop.example.com', status: 'healthy' },
      [siteId]: { id: siteId, kind: 'nginx_site', label: 'shop.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3000',
        status: 'unknown',
        sourceRef: { port: 3000 }
      },
      [containerId]: {
        id: containerId,
        kind: 'docker_container',
        label: 'frontend',
        status: 'healthy',
        sourceRef: { state: 'running' }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: domainId },
        to: { kind: 'nginx_site', id: siteId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'likely',
        evidence: []
      },
      {
        id: 'r3',
        from: { kind: 'port', id: portId },
        to: { kind: 'docker_container', id: containerId },
        type: 'published_by',
        confidence: 'likely',
        evidence: []
      }
    ]

    applyEntityHealth(entities, relationships, [])

    expect(entities[portId].status).toBe('failed')
    expect(entities[containerId].status).toBe('failed')

    const { health, componentStatus } = computeDeploymentHealth(deployment, entities, relationships)
    expect(componentStatus.backend).toBe('failed')
    expect(componentStatus.container).toBe('failed')
    expect(health).toBe('failed')
  })

  it('marks backend port failed for unknown-confidence proxy when listener is absent', () => {
    const domainId = domainEntityId('app.example.com')
    const siteId = nginxSiteEntityId('/etc/nginx/sites-enabled/app', 10)
    const portId = portEntityId('tcp', '127.0.0.1', 4000)

    const entities: Record<string, TopologyEntity> = {
      [domainId]: { id: domainId, kind: 'domain', label: 'app.example.com', status: 'healthy' },
      [siteId]: { id: siteId, kind: 'nginx_site', label: 'app.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':4000',
        status: 'unknown',
        sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 4000 }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'unknown',
        evidence: []
      }
    ]

    applyEntityHealth(entities, relationships, [])
    expect(entities[portId].status).toBe('failed')
  })

  it('syncs domain entity health from deployment health', () => {
    const domainId = domainEntityId('app.example.com')
    const siteId = nginxSiteEntityId('/etc/nginx/sites-enabled/app', 10)
    const portId = portEntityId('tcp', '127.0.0.1', 3000)

    const deployment: Deployment = {
      id: deploymentEntityId('app.example.com'),
      name: 'app.example.com',
      health: 'unknown',
      entityIds: [domainId, siteId, portId],
      entrypoints: [{ kind: 'domain', id: domainId }],
      stackSummary: '',
      componentStatus: {}
    }

    const entities: Record<string, TopologyEntity> = {
      [domainId]: { id: domainId, kind: 'domain', label: 'app.example.com', status: 'healthy' },
      [siteId]: { id: siteId, kind: 'nginx_site', label: 'app.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3000',
        status: 'failed',
        sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 3000 }
      }
    }

    const relationships: Relationship[] = [
      {
        id: 'r1',
        from: { kind: 'domain', id: domainId },
        to: { kind: 'nginx_site', id: siteId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'r2',
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      }
    ]

    enrichDeployments([deployment], entities, relationships)
    expect(entities[domainId].status).toBe('failed')
  })
})
