import { describe, expect, it } from 'vitest'
import type {
  Deployment,
  TopologyChange,
  TopologyEntity,
  TopologySnapshot
} from '@shared/topology'
import {
  groupChangesByDeployment,
  groupUnaffiliatedChanges,
  LAYER_ORDER,
  KIND_TO_LAYER
} from '@renderer/tools/deployments/changeGroups'

const observedAt = '2026-08-30T12:00:00.000Z'

function fixtureSnapshot(
  deployments: Deployment[],
  entities: Record<string, TopologyEntity> = {}
): TopologySnapshot {
  return {
    serverId: 'test-server',
    scannedAt: observedAt,
    scanDurationMs: 1000,
    entities,
    relationships: [],
    deployments,
    insights: [],
    warnings: []
  }
}

function fixtureDeployment(
  overrides: Partial<Deployment> & { id: string }
): Deployment {
  return {
    id: overrides.id,
    name: overrides.name ?? overrides.id,
    health: overrides.health ?? 'healthy',
    entityIds: overrides.entityIds ?? [],
    entrypoints: overrides.entrypoints ?? [],
    stackSummary: overrides.stackSummary ?? '',
    componentStatus: overrides.componentStatus ?? {},
    ...overrides
  }
}

function change(overrides: Partial<TopologyChange> & { entityId: string }): TopologyChange {
  return {
    kind: 'entity_modified',
    kindLabel: overrides.kindLabel,
    label: overrides.label,
    before: overrides.before,
    after: overrides.after,
    relationship: overrides.relationship,
    entityId: overrides.entityId,
    deploymentIds: overrides.deploymentIds ?? [],
    ...overrides
  }
}

describe('KIND_TO_LAYER', () => {
  it('maps expected entity kinds to component keys', () => {
    expect(KIND_TO_LAYER.ssl_certificate).toBe('ssl')
    expect(KIND_TO_LAYER.nginx_site).toBe('nginx')
    expect(KIND_TO_LAYER.port).toBe('backend')
    expect(KIND_TO_LAYER.process).toBe('backend')
    expect(KIND_TO_LAYER.systemd_unit).toBe('service')
    expect(KIND_TO_LAYER.docker_container).toBe('container')
    expect(KIND_TO_LAYER.docker_compose_service).toBe('container')
    expect(KIND_TO_LAYER.file_path).toBe('files')
  })
})

describe('LAYER_ORDER', () => {
  it('is ssl → nginx → backend → service → container → files', () => {
    expect(LAYER_ORDER).toEqual(['ssl', 'nginx', 'backend', 'service', 'container', 'files'])
  })
})

describe('groupChangesByDeployment', () => {
  it('groups changes by deploymentId and maps to layers in LAYER_ORDER', () => {
    const dep1 = fixtureDeployment({ id: 'dep-1', health: 'healthy', entityIds: ['e1', 'e2'] })
    const snapshot = fixtureSnapshot([dep1])

    const changes: TopologyChange[] = [
      change({
        entityId: 'e1',
        kindLabel: 'ssl_certificate',
        deploymentIds: ['dep-1'],
        before: { status: 'healthy' },
        after: { status: 'healthy' }
      }),
      change({
        entityId: 'e2',
        kindLabel: 'nginx_site',
        deploymentIds: ['dep-1'],
        before: { status: 'healthy' },
        after: { status: 'healthy' }
      })
    ]

    const groups = groupChangesByDeployment(changes, snapshot)
    expect(groups).toHaveLength(1)
    expect(groups[0].deployment.id).toBe('dep-1')
    expect(groups[0].changeCount).toBe(2)

    // Layers must appear in LAYER_ORDER
    expect(groups[0].layers.map((l) => l.key)).toEqual(['ssl', 'nginx'])
  })

  it('orders deployments by severity: failed first, degraded second, healthy last', () => {
    const depHealthy = fixtureDeployment({ id: 'dep-h', health: 'healthy' })
    const depFailed = fixtureDeployment({ id: 'dep-f', health: 'failed' })
    const depDegraded = fixtureDeployment({ id: 'dep-d', health: 'degraded' })
    const snapshot = fixtureSnapshot([depHealthy, depFailed, depDegraded])

    const changes: TopologyChange[] = [
      change({ entityId: 'e1', kindLabel: 'port', deploymentIds: ['dep-h'] }),
      change({ entityId: 'e2', kindLabel: 'port', deploymentIds: ['dep-f'] }),
      change({ entityId: 'e3', kindLabel: 'port', deploymentIds: ['dep-d'] })
    ]

    const groups = groupChangesByDeployment(changes, snapshot)
    expect(groups.map((g) => g.deployment.id)).toEqual(['dep-f', 'dep-d', 'dep-h'])
  })

  it('sorts by change count within the same severity tier', () => {
    const depA = fixtureDeployment({ id: 'dep-a', health: 'healthy' })
    const depB = fixtureDeployment({ id: 'dep-b', health: 'healthy' })
    const snapshot = fixtureSnapshot([depA, depB])

    const changes: TopologyChange[] = [
      change({ entityId: 'e1', kindLabel: 'port', deploymentIds: ['dep-a'] }),
      change({ entityId: 'e2', kindLabel: 'nginx_site', deploymentIds: ['dep-b'] }),
      change({ entityId: 'e3', kindLabel: 'ssl_certificate', deploymentIds: ['dep-b'] })
    ]

    const groups = groupChangesByDeployment(changes, snapshot)
    // dep-b has 2 changes, dep-a has 1 → dep-b first
    expect(groups.map((g) => g.deployment.id)).toEqual(['dep-b', 'dep-a'])
  })

  it('skips deployments with zero changes', () => {
    const depA = fixtureDeployment({ id: 'dep-a' })
    const depB = fixtureDeployment({ id: 'dep-b' })
    const snapshot = fixtureSnapshot([depA, depB])

    const changes: TopologyChange[] = [
      change({ entityId: 'e1', kindLabel: 'port', deploymentIds: ['dep-a'] })
    ]

    const groups = groupChangesByDeployment(changes, snapshot)
    expect(groups).toHaveLength(1)
    expect(groups[0].deployment.id).toBe('dep-a')
  })

  it('maps domain-kind changes to the backend layer', () => {
    const dep = fixtureDeployment({ id: 'dep-1' })
    const snapshot = fixtureSnapshot([dep])

    const changes: TopologyChange[] = [
      change({
        entityId: 'dom-1',
        kindLabel: 'domain',
        deploymentIds: ['dep-1']
      })
    ]

    const groups = groupChangesByDeployment(changes, snapshot)
    expect(groups[0].layers).toHaveLength(1)
    expect(groups[0].layers[0].key).toBe('backend')
  })

  it('returns empty when no changes match any deployment', () => {
    const dep = fixtureDeployment({ id: 'dep-1' })
    const snapshot = fixtureSnapshot([dep])

    expect(groupChangesByDeployment([], snapshot)).toEqual([])
  })
})

describe('groupUnaffiliatedChanges', () => {
  it('returns changes with no deploymentIds', () => {
    const snapshot = fixtureSnapshot([fixtureDeployment({ id: 'dep-1' })])
    const changes: TopologyChange[] = [
      change({ entityId: 'standalone-port', deploymentIds: [] })
    ]
    expect(groupUnaffiliatedChanges(changes, snapshot)).toHaveLength(1)
  })

  it('returns changes referencing non-existent deployments', () => {
    const snapshot = fixtureSnapshot([fixtureDeployment({ id: 'dep-1' })])
    const changes: TopologyChange[] = [
      change({ entityId: 'e1', deploymentIds: ['nonexistent'] })
    ]
    expect(groupUnaffiliatedChanges(changes, snapshot)).toHaveLength(1)
  })

  it('excludes changes referencing existing deployments', () => {
    const dep = fixtureDeployment({ id: 'dep-1' })
    const snapshot = fixtureSnapshot([dep])
    const changes: TopologyChange[] = [
      change({ entityId: 'e1', deploymentIds: ['dep-1'] })
    ]
    expect(groupUnaffiliatedChanges(changes, snapshot)).toHaveLength(0)
  })
})
