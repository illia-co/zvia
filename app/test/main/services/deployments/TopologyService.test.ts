import { describe, expect, it, vi } from 'vitest'
import type { TopologyCollectionResult } from '@main/services/deployments/collector'
import { TopologyService } from '@main/services/deployments/TopologyService'
import { TOPOLOGY_CACHE_TTL_MS } from '@shared/topology'

function fixtureCollection(): TopologyCollectionResult {
  return {
    serverBlocks: [],
    certificates: [],
    listeners: [],
    units: [],
    containers: [],
    processes: new Map(),
    nginxRunning: true,
    nginxTopology: { serverBlocks: [], upstreams: [] },
    warnings: []
  }
}

const noopRecordHistory = async () => {}

describe('TopologyService', () => {
  it('reuses cached snapshot within TTL on getSnapshot', async () => {
    const collector = {
      collect: vi.fn(async () => fixtureCollection())
    }
    const service = new TopologyService(collector, noopRecordHistory)
    const serverId = 'test-server'

    await service.getSnapshot(serverId)
    await service.getSnapshot(serverId)

    expect(collector.collect).toHaveBeenCalledTimes(1)
  })

  it('invalidates cache so the next getSnapshot rescans', async () => {
    const collector = {
      collect: vi.fn(async () => fixtureCollection())
    }
    const service = new TopologyService(collector, noopRecordHistory)
    const serverId = 'test-server'

    await service.getSnapshot(serverId)
    service.invalidate(serverId)
    await service.getSnapshot(serverId)

    expect(collector.collect).toHaveBeenCalledTimes(2)
  })

  it('exports cache TTL aligned with shared constant', () => {
    expect(TOPOLOGY_CACHE_TTL_MS).toBe(60_000)
  })
})
