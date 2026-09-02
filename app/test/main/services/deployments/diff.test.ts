import { describe, expect, it } from 'vitest'
import type { Deployment, TopologySnapshot } from '@shared/topology'
import {
  diffTopology,
  diffTopologyForDeployment,
  filterProcessChurn
} from '@main/services/deployments/diff'

function snapshot(overrides: Partial<TopologySnapshot> = {}): TopologySnapshot {
  return {
    serverId: 'srv',
    scannedAt: '2026-01-01T00:00:00.000Z',
    scanDurationMs: 10,
    entities: {},
    relationships: [],
    deployments: [],
    insights: [],
    warnings: [],
    ...overrides
  }
}

function entity(id: string, kind: string, label: string, status: string, sourceRef?: Record<string, unknown>) {
  return { id, kind, label, status, sourceRef }
}

function deployment(id: string, entityIds: string[]): Deployment {
  return {
    id,
    name: id.replace('deployment:', ''),
    health: 'healthy',
    entityIds,
    entrypoints: [],
    stackSummary: '',
    componentStatus: {}
  }
}

const portA = entity(
  'port:tcp:0.0.0.0:3000',
  'port',
  ':3000',
  'healthy',
  { port: 3000, protocol: 'tcp' }
)
const portB = entity(
  'port:tcp:0.0.0.0:8080',
  'port',
  ':8080',
  'healthy',
  { port: 8080, protocol: 'tcp' }
)
const containerA = entity(
  'container:abc',
  'docker_container',
  'web',
  'healthy',
  { state: 'running', composeProject: 'app' }
)

describe('diffTopology', () => {
  it('reports added entities', () => {
    const before = snapshot()
    const after = snapshot({ entities: { [portA.id]: portA } })
    const changes = diffTopology(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      kind: 'entity_added',
      entityId: portA.id,
      kindLabel: 'port',
      label: ':3000'
    })
  })

  it('reports removed entities', () => {
    const before = snapshot({ entities: { [portA.id]: portA } })
    const after = snapshot()
    const changes = diffTopology(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      kind: 'entity_removed',
      entityId: portA.id,
      kindLabel: 'port'
    })
  })

  it('reports status transition on a modified entity', () => {
    const before = snapshot({ entities: { [portA.id]: portA } })
    const changed = snapshot({
      entities: { [portA.id]: { ...portA, status: 'failed' } }
    })
    const changes = diffTopology(before, changed)
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      kind: 'entity_modified',
      entityId: portA.id,
      before: { status: 'healthy' },
      after: { status: 'failed' }
    })
  })

  it('reports sourceRef change as modified', () => {
    const before = snapshot({ entities: { [containerA.id]: containerA } })
    const changed = snapshot({
      entities: {
        [containerA.id]: { ...containerA, sourceRef: { state: 'running', composeProject: 'other' } }
      }
    })
    const changes = diffTopology(before, changed)
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe('entity_modified')
  })

  it('does not report unchanged entities', () => {
    const before = snapshot({ entities: { [portA.id]: portA, [portB.id]: portB } })
    const after = snapshot({ entities: { [portA.id]: portA, [portB.id]: portB } })
    expect(diffTopology(before, after)).toHaveLength(0)
  })

  it('anchors added/modified entities to containing deployments', () => {
    const before = snapshot({ entities: { [portA.id]: portA } })
    const changed = snapshot({
      entities: { [portA.id]: { ...portA, status: 'failed' } },
      deployments: [
        {
          id: 'deployment:example.com',
          name: 'example.com',
          health: 'failed',
          entityIds: [portA.id],
          entrypoints: [],
          stackSummary: '',
          componentStatus: {}
        }
      ]
    })
    const changes = diffTopology(before, changed)
    expect(changes[0].deploymentIds).toEqual(['deployment:example.com'])
  })

  it('reports added and removed relationships', () => {
    const rel = {
      id: 'rel:1',
      from: { kind: 'port', id: portA.id },
      to: { kind: 'docker_container', id: containerA.id },
      type: 'published_by',
      confidence: 'confirmed',
      evidence: []
    } as const
    const before = snapshot({ entities: { [portA.id]: portA }, relationships: [] })
    const after = snapshot({
      entities: { [portA.id]: portA, [containerA.id]: containerA },
      relationships: [rel]
    })
    const added = diffTopology(before, after)
    expect(added.some((change) => change.kind === 'relationship_added')).toBe(true)

    const removed = diffTopology(after, before)
    expect(removed.some((change) => change.kind === 'relationship_removed')).toBe(true)
  })

  it('returns an empty list for equal snapshots with relationships', () => {
    const rel = {
      id: 'rel:1',
      from: { kind: 'port', id: portA.id },
      to: { kind: 'docker_container', id: containerA.id },
      type: 'published_by',
      confidence: 'confirmed',
      evidence: []
    } as const
    const both = snapshot({
      entities: { [portA.id]: portA, [containerA.id]: containerA },
      relationships: [rel]
    })
    expect(diffTopology(both, both)).toHaveLength(0)
  })

  it('attributes removed entities to the owning deployment', () => {
    const before = snapshot({
      entities: { [portA.id]: portA },
      deployments: [deployment('deployment:a.example', [portA.id])]
    })
    const after = snapshot({
      entities: {},
      deployments: [deployment('deployment:a.example', [])]
    })
    const changes = diffTopology(before, after)
    expect(changes).toHaveLength(1)
    expect(changes[0].kind).toBe('entity_removed')
    expect(changes[0].deploymentIds).toEqual(['deployment:a.example'])
  })

  it('scopes a diff to a single deployment and never leaks another deployment', () => {
    const deploymentA = deployment('deployment:a.example', [portA.id])
    const deploymentB = deployment('deployment:b.example', [portB.id])
    const before = snapshot({ entities: {}, deployments: [deploymentA, deploymentB] })
    const after = snapshot({
      entities: {
        [portA.id]: { ...portA, status: 'failed' },
        [portB.id]: { ...portB, status: 'failed' }
      },
      deployments: [deploymentA, deploymentB]
    })

    const all = diffTopology(before, after)
    expect(all).toHaveLength(2)

    const forA = diffTopologyForDeployment(before, after, 'deployment:a.example')
    expect(forA).toHaveLength(1)
    expect(forA[0].entityId).toBe(portA.id)
    expect(forA.every((change) => change.entityId !== portB.id)).toBe(true)

    const forB = diffTopologyForDeployment(before, after, 'deployment:b.example')
    expect(forB).toHaveLength(1)
    expect(forB[0].entityId).toBe(portB.id)
    expect(forB.every((change) => change.entityId !== portA.id)).toBe(true)
  })

  it('filters pure process PID churn', () => {
    const beforeProcess = entity('process:100', 'process', 'nginx (100)', 'healthy', {
      pid: 100,
      comm: 'nginx'
    })
    const afterProcess = entity('process:101', 'process', 'nginx (101)', 'healthy', {
      pid: 101,
      comm: 'nginx'
    })
    const before = snapshot({ entities: { [beforeProcess.id]: beforeProcess }, deployments: [] })
    const after = snapshot({ entities: { [afterProcess.id]: afterProcess }, deployments: [] })

    const changes = diffTopology(before, after)
    expect(changes).toHaveLength(2)

    expect(filterProcessChurn(changes)).toHaveLength(0)
  })

  it('keeps a genuine process removal with no replacement', () => {
    const removed = entity('process:100', 'process', 'nginx (100)', 'healthy', {
      pid: 100,
      comm: 'nginx'
    })
    const before = snapshot({ entities: { [removed.id]: removed }, deployments: [] })
    const after = snapshot({ entities: {}, deployments: [] })

    const changes = diffTopology(before, after)
    expect(filterProcessChurn(changes)).toHaveLength(1)
    expect(filterProcessChurn(changes)[0].kind).toBe('entity_removed')
  })

  it('keeps non-process changes untouched during churn filtering', () => {
    const removed = entity('process:100', 'process', 'node (100)', 'healthy', {
      pid: 100,
      comm: 'node'
    })
    const added = entity('process:101', 'process', 'node (101)', 'healthy', {
      pid: 101,
      comm: 'node'
    })
    const before = snapshot({ entities: { [removed.id]: removed, [portA.id]: portA }, deployments: [] })
    const after = snapshot({
      entities: {
        [added.id]: added,
        [portA.id]: { ...portA, status: 'failed' }
      },
      deployments: []
    })

    const changes = diffTopology(before, after)
    const filtered = filterProcessChurn(changes)
    expect(filtered).toHaveLength(1)
    expect(filtered[0].entityId).toBe(portA.id)
  })
})
