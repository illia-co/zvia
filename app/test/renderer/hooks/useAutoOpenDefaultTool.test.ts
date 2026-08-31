import { beforeEach, describe, expect, it, vi } from 'vitest'

const openTool = vi.fn()
const getWorkspace = vi.fn(() => ({ root: null }))

vi.mock('@renderer/state/workspaceStore', () => ({
  useWorkspaceStore: {
    getState: () => ({ openTool, getWorkspace })
  }
}))

import { autoOpenDefaultToolIfNeeded } from '@renderer/hooks/useAutoOpenDefaultTool'

describe('autoOpenDefaultToolIfNeeded', () => {
  beforeEach(() => {
    openTool.mockClear()
    getWorkspace.mockClear()
    getWorkspace.mockReturnValue({ root: null })
  })

  it('opens Deployments when connected with an empty workspace', () => {
    autoOpenDefaultToolIfNeeded('production', 'connected')

    expect(openTool).toHaveBeenCalledWith('production', 'deployments')
  })

  it('does not open a tool when the workspace already has panels', () => {
    getWorkspace.mockReturnValue({ root: { type: 'panel', panelId: 'panel-1' } })

    autoOpenDefaultToolIfNeeded('production', 'connected')

    expect(openTool).not.toHaveBeenCalled()
  })

  it('does not open a tool while disconnected', () => {
    autoOpenDefaultToolIfNeeded('production', 'disconnected')

    expect(openTool).not.toHaveBeenCalled()
  })
})
