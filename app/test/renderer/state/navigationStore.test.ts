import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@renderer/state/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => ({ openTool: vi.fn() })
  }
}))

import { useNavigationStore } from '@renderer/state/navigationStore'

describe('navigationStore', () => {
  beforeEach(() => {
    useNavigationStore.setState({ pendingIntents: {} })
  })

  it('stores and consumes a one-shot intent', () => {
    const serverId = 'production'

    useNavigationStore.getState().openWithIntent(serverId, {
      tool: 'nginx',
      configPath: '/etc/nginx/sites-enabled/app'
    })

    expect(useNavigationStore.getState().pendingIntents[serverId]).toEqual({
      tool: 'nginx',
      configPath: '/etc/nginx/sites-enabled/app'
    })

    const taken = useNavigationStore.getState().takeIntent(serverId, 'nginx')
    expect(taken).toEqual({
      tool: 'nginx',
      configPath: '/etc/nginx/sites-enabled/app'
    })
    expect(useNavigationStore.getState().pendingIntents[serverId]).toBeUndefined()

    expect(useNavigationStore.getState().takeIntent(serverId, 'nginx')).toBeNull()
  })

  it('stores deployments intent with entity deep-link fields', () => {
    const serverId = 'production'

    useNavigationStore.getState().openWithIntent(serverId, {
      tool: 'deployments',
      deploymentId: 'deployment:api.example.com',
      entityId: 'port:tcp:127.0.0.1:3001'
    })

    expect(useNavigationStore.getState().pendingIntents[serverId]).toEqual({
      tool: 'deployments',
      deploymentId: 'deployment:api.example.com',
      entityId: 'port:tcp:127.0.0.1:3001'
    })
  })

  it('returns null when consuming intent for the wrong tool', () => {
    const serverId = 'production'

    useNavigationStore.getState().openWithIntent(serverId, {
      tool: 'nginx',
      configPath: '/etc/nginx/nginx.conf'
    })

    expect(useNavigationStore.getState().takeIntent(serverId, 'ports')).toBeNull()
    expect(useNavigationStore.getState().pendingIntents[serverId]).toEqual({
      tool: 'nginx',
      configPath: '/etc/nginx/nginx.conf'
    })
  })
})
