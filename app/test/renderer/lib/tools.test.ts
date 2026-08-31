import { describe, expect, it } from 'vitest'
import { DEFAULT_TOOL, KEYBOARD_ZERO_TOOL, TOOLS } from '@renderer/lib/tools'

describe('tools registry', () => {
  it('lists Deployments first in the Applications section', () => {
    expect(TOOLS[0]).toMatchObject({
      id: 'deployments',
      section: 'Applications'
    })
    expect(TOOLS[1]?.id).toBe('overview')
  })

  it('uses Deployments as the default connected-server tool', () => {
    expect(DEFAULT_TOOL).toBe('deployments')
  })

  it('keeps Docker on the zero keyboard shortcut', () => {
    expect(KEYBOARD_ZERO_TOOL).toBe('docker')
    expect(TOOLS.findIndex((tool) => tool.id === KEYBOARD_ZERO_TOOL)).toBe(9)
  })
})
