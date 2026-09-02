import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Deployment, TopologySnapshot } from '@shared/topology'
import { topologyHistoryStore } from '@main/store/topologyHistory'
import { TopologyHistoryService } from '@main/services/deployments/TopologyHistoryService'

const mockUserData = { path: join(tmpdir(), 'zvia-history-placeholder') }

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserData.path)
  }
}))

function snapshot(scannedAt: string, overrides: Partial<TopologySnapshot> = {}): TopologySnapshot {
  return {
    serverId: 'srv',
    scannedAt,
    scanDurationMs: 10,
    entities: {
      'port:tcp:0.0.0.0:3000': {
        id: 'port:tcp:0.0.0.0:3000',
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    },
    relationships: [],
    deployments: [],
    insights: [],
    warnings: [],
    ...overrides
  }
}

function deployment(id: string, name: string, entityIds: string[], health: Deployment['health'] = 'healthy'): Deployment {
  return { id, name, health, entityIds, entrypoints: [], stackSummary: '', componentStatus: {} }
}

describe('TopologyHistoryService', () => {
  beforeEach(async () => {
    topologyHistoryStore.reset()
    mockUserData.path = await mkdtemp(join(tmpdir(), 'zvia-history-'))
  })

  it('records snapshots and lists them newest-first', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-a'
    await service.record(serverId, snapshot('2026-01-01T00:00:00.000Z'))
    await service.record(serverId, snapshot('2026-01-02T00:00:00.000Z'))

    const list = await service.list(serverId)
    expect(list.map((entry) => entry.id)).toEqual([
      '2026-01-02T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z'
    ])
    expect(list.every((entry) => Object.keys(entry.deploymentTags).length === 0)).toBe(true)
  })

  it('tags a snapshot and reports it in the list', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-b'
    await service.record(serverId, snapshot('2026-01-01T00:00:00.000Z'))
    await service.record(serverId, snapshot('2026-01-02T00:00:00.000Z'))
    await service.addDeploymentTag(serverId, '2026-01-01T00:00:00.000Z', 'dep-1', 'stable')

    const list = await service.list(serverId)
    const entry = list.find((e) => e.id === '2026-01-01T00:00:00.000Z')
    expect(entry?.deploymentTags['dep-1']).toContain('stable')
  })

  it('rejects "latest" as a tag name', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-b-reject'
    await service.record(serverId, snapshot('2026-01-01T00:00:00.000Z'))
    await expect(
      service.addDeploymentTag(serverId, '2026-01-01T00:00:00.000Z', 'dep-1', 'latest')
    ).rejects.toThrow('"latest" is a reserved tag name')
  })

  it('removes a tag from a snapshot', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-b-remove'
    await service.record(serverId, snapshot('2026-01-01T00:00:00.000Z'))
    await service.addDeploymentTag(serverId, '2026-01-01T00:00:00.000Z', 'dep-1', 'stable')
    await service.removeDeploymentTag(serverId, '2026-01-01T00:00:00.000Z', 'dep-1', 'stable')

    const list = await service.list(serverId)
    const entry = list.find((e) => e.id === '2026-01-01T00:00:00.000Z')
    expect(entry?.deploymentTags['dep-1']).toEqual([])
  })

  it('diffs current against the latest snapshot', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-c'
    const baseline = snapshot('2026-01-01T00:00:00.000Z')
    await service.record(serverId, baseline)

    const current = snapshot('2026-01-03T00:00:00.000Z', {
      entities: {
        'port:tcp:0.0.0.0:3000': {
          id: 'port:tcp:0.0.0.0:3000',
          kind: 'port',
          label: ':3000',
          status: 'failed',
          sourceRef: { port: 3000 }
        }
      }
    })

    const result = await service.diff(serverId, current)
    expect(result.baselineId).toBe('2026-01-01T00:00:00.000Z')
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toMatchObject({
      kind: 'entity_modified',
      before: { status: 'healthy' },
      after: { status: 'failed' }
    })
  })

  it('returns empty when no history exists', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-d-empty'
    const result = await service.diff(serverId, snapshot('2026-01-04T00:00:00.000Z'))
    expect(result.baselineId).toBeNull()
    expect(result.changes).toHaveLength(0)
  })

  it('diffs two stored snapshots', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-d-diff'
    await service.record(serverId, snapshot('2026-01-01T00:00:00.000Z'))
    await service.record(
      serverId,
      snapshot('2026-01-02T00:00:00.000Z', {
        entities: {
          'port:tcp:0.0.0.0:3000': {
            id: 'port:tcp:0.0.0.0:3000',
            kind: 'port',
            label: ':3000',
            status: 'failed',
            sourceRef: { port: 3000 }
          }
        }
      })
    )

    const result = await service.snapshotDiff(
      serverId,
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z'
    )
    expect(result.changes).toHaveLength(1)
    expect(result.fromId).toBe('2026-01-01T00:00:00.000Z')
    expect(result.toId).toBe('2026-01-02T00:00:00.000Z')
  })

  it('scopes snapshotDiff to a single deployment', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-scoped'
    const portA = 'port:tcp:0.0.0.0:3000'
    const portB = 'port:tcp:0.0.0.0:8080'

    await service.record(
      serverId,
      snapshot('2026-04-01T00:00:00.000Z', {
        entities: {
          [portA]: { id: portA, kind: 'port', label: ':3000', status: 'healthy', sourceRef: { port: 3000 } },
          [portB]: { id: portB, kind: 'port', label: ':8080', status: 'healthy', sourceRef: { port: 8080 } }
        },
        deployments: [
          {
            id: 'deployment:a.example',
            name: 'a.example',
            health: 'healthy',
            entityIds: [portA],
            entrypoints: [],
            stackSummary: '',
            componentStatus: {}
          },
          {
            id: 'deployment:b.example',
            name: 'b.example',
            health: 'healthy',
            entityIds: [portB],
            entrypoints: [],
            stackSummary: '',
            componentStatus: {}
          }
        ]
      })
    )
    await service.record(
      serverId,
      snapshot('2026-04-02T00:00:00.000Z', {
        entities: {
          [portA]: { id: portA, kind: 'port', label: ':3000', status: 'failed', sourceRef: { port: 3000 } },
          [portB]: { id: portB, kind: 'port', label: ':8080', status: 'failed', sourceRef: { port: 8080 } }
        },
        deployments: [
          {
            id: 'deployment:a.example',
            name: 'a.example',
            health: 'failed',
            entityIds: [portA],
            entrypoints: [],
            stackSummary: '',
            componentStatus: {}
          },
          {
            id: 'deployment:b.example',
            name: 'b.example',
            health: 'failed',
            entityIds: [portB],
            entrypoints: [],
            stackSummary: '',
            componentStatus: {}
          }
        ]
      })
    )

    const diffA = await service.snapshotDiff(
      serverId,
      '2026-04-01T00:00:00.000Z',
      '2026-04-02T00:00:00.000Z',
      'deployment:a.example'
    )
    expect(diffA.changes).toHaveLength(1)
    expect(diffA.changes[0].entityId).toBe(portA)

    const diffB = await service.snapshotDiff(
      serverId,
      '2026-04-01T00:00:00.000Z',
      '2026-04-02T00:00:00.000Z',
      'deployment:b.example'
    )
    expect(diffB.changes).toHaveLength(1)
    expect(diffB.changes[0].entityId).toBe(portB)
  })

  it('tags the current state and scopes deployment history', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-tag-current'
    const portA = 'port:tcp:0.0.0.0:3000'
    const portB = 'port:tcp:0.0.0.0:8080'
    const deploymentA = deployment('deployment:a.example', 'a.example', [portA])
    const deploymentB = deployment('deployment:b.example', 'b.example', [portB])

    await service.record(
      serverId,
      snapshot('2026-05-01T00:00:00.000Z', {
        entities: {
          [portA]: { id: portA, kind: 'port', label: ':3000', status: 'healthy' },
          [portB]: { id: portB, kind: 'port', label: ':8080', status: 'healthy' }
        },
        deployments: [deploymentA, deploymentB]
      })
    )

    const current = snapshot('2026-05-02T00:00:00.000Z', {
      entities: {
        [portA]: { id: portA, kind: 'port', label: ':3000', status: 'failed' },
        [portB]: { id: portB, kind: 'port', label: ':8080', status: 'healthy' }
      },
      deployments: [
        deployment('deployment:a.example', 'a.example', [portA], 'failed'),
        deploymentB
      ]
    })

    await service.tagCurrent(serverId, current, 'deployment:a.example', 'pre-deploy')

    const historyA = await service.deploymentHistory(serverId, 'deployment:a.example')
    expect(historyA).toHaveLength(1)
    expect(historyA[0]).toMatchObject({ changeCount: 1, tags: ['pre-deploy'] })

    const historyB = await service.deploymentHistory(serverId, 'deployment:b.example')
    expect(historyB).toHaveLength(0)
  })

  it('isolates history per server and purges on removeServer', async () => {
    const service = new TopologyHistoryService()
    await service.record('srv-e', snapshot('2026-01-01T00:00:00.000Z'))
    expect(await service.list('srv-f')).toHaveLength(0)

    await service.removeServer('srv-e')
    expect(await service.list('srv-e')).toHaveLength(0)
  })

  it('caps untagged snapshots to a bounded rolling window', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-g'
    for (let index = 1; index <= 15; index += 1) {
      const day = String(index).padStart(2, '0')
      await service.record(serverId, snapshot(`2026-02-${day}T00:00:00.000Z`))
    }
    const list = await service.list(serverId)
    expect(list.length).toBeLessThanOrEqual(11)
    expect(list[0].id).toBe('2026-02-15T00:00:00.000Z')
  })

  it('never evicts tagged snapshots from the cap', async () => {
    const service = new TopologyHistoryService()
    const serverId = 'srv-g-tagged'
    for (let index = 1; index <= 10; index += 1) {
      const day = String(index).padStart(2, '0')
      await service.record(serverId, snapshot(`2026-03-${day}T00:00:00.000Z`))
    }
    await service.addDeploymentTag(serverId, '2026-03-01T00:00:00.000Z', 'dep-1', 'important')
    for (let index = 11; index <= 15; index += 1) {
      const day = String(index).padStart(2, '0')
      await service.record(serverId, snapshot(`2026-03-${day}T00:00:00.000Z`))
    }

    const list = await service.list(serverId)
    const tagged = list.find((e) => e.id === '2026-03-01T00:00:00.000Z')
    expect(tagged).toBeDefined()
    expect(tagged?.deploymentTags['dep-1']).toContain('important')
    expect(list.length).toBeLessThanOrEqual(11)
  })
})
