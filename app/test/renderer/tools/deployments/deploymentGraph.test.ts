import { describe, expect, it } from 'vitest'
import type { Deployment, TopologySnapshot } from '@shared/topology'
import {
  domainEntityId,
  nginxSiteEntityId,
  portEntityId,
  processEntityId
} from '@shared/topology'
import {
  buildDeploymentGraph,
  formatComponentIssueMessage,
  formatDeploymentIssueSummary,
  getEntityRelationships,
  listDeploymentComponentIssues,
  listDeploymentComponents
} from '@renderer/tools/deployments/deploymentGraph'

const observedAt = '2026-08-30T12:00:00.000Z'
const configPath = '/etc/nginx/sites-enabled/myapp'

function fixtureSnapshot(): TopologySnapshot {
  const domainId = domainEntityId('myapp.com')
  const nginxId = nginxSiteEntityId(configPath, 5)
  const portId = portEntityId('tcp', '127.0.0.1', 3000)
  const processId = processEntityId(1842)

  return {
    serverId: 'test-server',
    scannedAt: observedAt,
    scanDurationMs: 1200,
    entities: {
      [domainId]: {
        id: domainId,
        kind: 'domain',
        label: 'myapp.com',
        status: 'healthy'
      },
      [nginxId]: {
        id: nginxId,
        kind: 'nginx_site',
        label: 'myapp.com',
        status: 'healthy'
      },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3000',
        status: 'healthy'
      },
      [processId]: {
        id: processId,
        kind: 'process',
        label: 'node (1842)',
        status: 'healthy'
      }
    },
    relationships: [
      {
        id: 'rel-serves',
        from: { kind: 'nginx_site', id: nginxId },
        to: { kind: 'domain', id: domainId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'rel-proxy',
        from: { kind: 'nginx_site', id: nginxId },
        to: { kind: 'port', id: portId },
        type: 'proxies_to',
        confidence: 'confirmed',
        label: 'proxy_pass',
        evidence: []
      },
      {
        id: 'rel-listen',
        from: { kind: 'port', id: portId },
        to: { kind: 'process', id: processId },
        type: 'listens_on',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'rel-member',
        from: { kind: 'process', id: processId },
        to: { kind: 'deployment', id: 'deployment:myapp.com' },
        type: 'member_of',
        confidence: 'confirmed',
        evidence: []
      }
    ],
    deployments: [],
    insights: [],
    warnings: []
  }
}

function fixtureDeployment(): Deployment {
  const domainId = domainEntityId('myapp.com')
  const nginxId = nginxSiteEntityId(configPath, 5)
  const portId = portEntityId('tcp', '127.0.0.1', 3000)
  const processId = processEntityId(1842)

  return {
    id: 'deployment:myapp.com',
    name: 'myapp.com',
    health: 'healthy',
    entityIds: [domainId, nginxId, portId, processId],
    entrypoints: [{ kind: 'domain', id: domainId }],
    stackSummary: 'Nginx → :3000 → Node',
    componentStatus: {}
  }
}

describe('buildDeploymentGraph', () => {
  it('creates one node per deployment entity', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const graph = buildDeploymentGraph(deployment, snapshot)

    expect(graph.nodes).toHaveLength(4)
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(deployment.entityIds.sort())
  })

  it('excludes member_of edges', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const graph = buildDeploymentGraph(deployment, snapshot)

    expect(graph.edges).toHaveLength(3)
    expect(graph.edges.some((edge) => edge.id === 'rel-member')).toBe(false)
  })

  it('flags entrypoint nodes', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const graph = buildDeploymentGraph(deployment, snapshot)

    const domainNode = graph.nodes.find((node) => node.id === domainEntityId('myapp.com'))
    const portNode = graph.nodes.find(
      (node) => node.id === portEntityId('tcp', '127.0.0.1', 3000)
    )

    expect(domainNode?.data.isEntrypoint).toBe(true)
    expect(portNode?.data.isEntrypoint).toBe(false)
  })

  it('maps relationships into edge data', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const graph = buildDeploymentGraph(deployment, snapshot)

    const proxyEdge = graph.edges.find((edge) => edge.id === 'rel-proxy')
    expect(proxyEdge?.label).toBe('proxy_pass')
    expect(proxyEdge?.data?.relationship.type).toBe('proxies_to')
    expect(graph.relationshipById.get('rel-proxy')?.type).toBe('proxies_to')
  })

  it('renders fewer nodes than the full snapshot when scoped to one deployment', () => {
    const shopDomain = domainEntityId('shop.zvia-test.local')
    const apiDomain = domainEntityId('api.zvia-test.local')
    const shopSite = nginxSiteEntityId('/etc/nginx/sites-enabled/shop', 10)
    const apiSite = nginxSiteEntityId('/etc/nginx/sites-enabled/api', 20)
    const sharedPort = portEntityId('tcp', '127.0.0.1', 3000)

    const snapshot: TopologySnapshot = {
      serverId: 'test-server',
      scannedAt: observedAt,
      scanDurationMs: 1200,
      entities: {
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
        [sharedPort]: {
          id: sharedPort,
          kind: 'port',
          label: ':3000',
          status: 'healthy'
        }
      },
      relationships: [
        {
          id: 'rel-shop-serves',
          from: { kind: 'domain', id: shopDomain },
          to: { kind: 'nginx_site', id: shopSite },
          type: 'serves',
          confidence: 'confirmed',
          evidence: []
        },
        {
          id: 'rel-api-serves',
          from: { kind: 'domain', id: apiDomain },
          to: { kind: 'nginx_site', id: apiSite },
          type: 'serves',
          confidence: 'confirmed',
          evidence: []
        },
        {
          id: 'rel-shop-proxy',
          from: { kind: 'nginx_site', id: shopSite },
          to: { kind: 'port', id: sharedPort },
          type: 'proxies_to',
          confidence: 'confirmed',
          evidence: []
        },
        {
          id: 'rel-api-proxy',
          from: { kind: 'nginx_site', id: apiSite },
          to: { kind: 'port', id: sharedPort },
          type: 'proxies_to',
          confidence: 'confirmed',
          evidence: []
        }
      ],
      deployments: [],
      insights: [],
      warnings: []
    }

    const shopDeployment: Deployment = {
      id: 'deployment:shop.zvia-test.local',
      name: 'shop.zvia-test.local',
      health: 'healthy',
      entityIds: [shopDomain, shopSite, sharedPort],
      entrypoints: [{ kind: 'domain', id: shopDomain }],
      stackSummary: '',
      componentStatus: {}
    }

    const graph = buildDeploymentGraph(shopDeployment, snapshot)

    expect(Object.keys(snapshot.entities)).toHaveLength(5)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.nodes.map((node) => node.id).sort()).toEqual(shopDeployment.entityIds.sort())
    expect(graph.nodes.some((node) => node.id === apiDomain)).toBe(false)
    expect(graph.nodes.some((node) => node.id === apiSite)).toBe(false)
  })
})

describe('getEntityRelationships', () => {
  it('returns incoming and outgoing relationships scoped to deployment', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const portId = portEntityId('tcp', '127.0.0.1', 3000)
    const scope = new Set(deployment.entityIds)

    const portRelationships = getEntityRelationships(portId, snapshot, scope)
    const directions = portRelationships.map((entry) => entry.direction).sort()

    expect(directions).toEqual(['incoming', 'outgoing'])
    expect(portRelationships.some((entry) => entry.relationship.id === 'rel-proxy')).toBe(true)
    expect(portRelationships.some((entry) => entry.relationship.id === 'rel-listen')).toBe(true)
  })

  it('excludes member_of relationships', () => {
    const deployment = fixtureDeployment()
    const snapshot = fixtureSnapshot()
    const processId = processEntityId(1842)
    const scope = new Set(deployment.entityIds)

    const relationships = getEntityRelationships(processId, snapshot, scope)

    expect(relationships.some((entry) => entry.relationship.type === 'member_of')).toBe(false)
  })
})

describe('deployment list helpers', () => {
  it('lists present components in stable order', () => {
    const components = listDeploymentComponents({
      ssl: 'healthy',
      nginx: 'healthy',
      backend: 'degraded',
      container: 'failed'
    })

    expect(components.map((component) => component.label)).toEqual([
      'SSL',
      'Nginx',
      'Backend',
      'Container'
    ])
  })

  it('filters degraded and failed components as issues', () => {
    const issues = listDeploymentComponentIssues({
      ssl: 'healthy',
      nginx: 'healthy',
      backend: 'degraded',
      service: 'failed'
    })

    expect(issues.map((issue) => `${issue.label}:${issue.status}`)).toEqual([
      'Backend:degraded',
      'Service:failed'
    ])
  })

  it('formats issue messages for status display', () => {
    const issues = listDeploymentComponentIssues({
      backend: 'degraded',
      service: 'failed'
    })

    expect(formatComponentIssueMessage(issues[0]!)).toBe('Backend degraded')
    expect(formatComponentIssueMessage(issues[1]!)).toBe('Service failed')
    expect(formatDeploymentIssueSummary(issues)).toBe('Backend degraded · Service failed')
  })
})
