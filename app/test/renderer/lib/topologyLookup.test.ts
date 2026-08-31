import { describe, expect, it } from 'vitest'
import type { TopologySnapshot } from '@shared/topology'
import { containerEntityId, domainEntityId, portEntityId } from '@shared/topology'
import {
  findDeploymentByContainer,
  findDeploymentByDomain,
  findDeploymentByPort
} from '@renderer/lib/topologyLookup'

function snapshotFixture(): TopologySnapshot {
  const domainId = domainEntityId('api.example.com')
  const portId = portEntityId('tcp', '127.0.0.1', 3001)
  const containerId = containerEntityId('abc123')

  return {
    serverId: 'production',
    scannedAt: '2026-08-30T12:00:00.000Z',
    scanDurationMs: 100,
    entities: {
      [domainId]: { id: domainId, kind: 'domain', label: 'api.example.com', status: 'healthy' },
      [portId]: {
        id: portId,
        kind: 'port',
        label: ':3001',
        status: 'healthy',
        sourceRef: { port: 3001 }
      },
      [containerId]: {
        id: containerId,
        kind: 'docker_container',
        label: 'api',
        status: 'healthy'
      }
    },
    relationships: [],
    deployments: [
      {
        id: 'deployment:api.example.com',
        name: 'api.example.com',
        health: 'healthy',
        entityIds: [domainId, portId, containerId],
        entrypoints: [{ kind: 'domain', id: domainId }],
        stackSummary: '',
        componentStatus: {}
      }
    ],
    insights: [],
    warnings: []
  }
}

describe('topologyLookup', () => {
  it('finds deployment by port, container, and domain', () => {
    const snapshot = snapshotFixture()
    const portId = portEntityId('tcp', '127.0.0.1', 3001)

    expect(findDeploymentByPort(snapshot, 3001)).toEqual({
      deploymentId: 'deployment:api.example.com',
      entityId: portId
    })
    expect(findDeploymentByContainer(snapshot, 'abc123')).toEqual({
      deploymentId: 'deployment:api.example.com',
      entityId: containerEntityId('abc123')
    })
    expect(findDeploymentByDomain(snapshot, 'api.example.com')).toEqual({
      deploymentId: 'deployment:api.example.com',
      entityId: domainEntityId('api.example.com')
    })
  })
})
