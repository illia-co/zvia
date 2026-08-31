import { describe, expect, it } from 'vitest'
import { TOPOLOGY_CACHE_TTL_MS } from '@renderer/tools/deployments/useDeployments'

describe('useDeployments', () => {
  it('re-exports shared topology cache TTL for poll alignment', () => {
    expect(TOPOLOGY_CACHE_TTL_MS).toBe(60_000)
  })
})
