import { describe, expect, it } from 'vitest'
import {
  FIREWALL_NO_BACKEND_REASON,
  describeFirewallEditability,
  type FirewallState
} from './ports'

function state(overrides: Partial<FirewallState>): FirewallState {
  return {
    backend: 'ufw',
    status: 'active',
    defaultIncoming: 'deny',
    editable: true,
    rules: [],
    ...overrides
  }
}

describe('describeFirewallEditability', () => {
  it('reports no reason when rules can be written', () => {
    expect(describeFirewallEditability(state({}))).toEqual({ editable: true, reason: null })
  })

  it('explains an absent firewall backend', () => {
    // The gap the user hit: an OrbStack VM with no ufw, nft or iptables used to
    // hide every firewall control without saying anything at all.
    const result = describeFirewallEditability(
      state({
        backend: 'none',
        status: 'inactive',
        defaultIncoming: 'unknown',
        editable: false,
        unavailableReason: FIREWALL_NO_BACKEND_REASON
      })
    )

    expect(result.editable).toBe(false)
    expect(result.reason).toBe(FIREWALL_NO_BACKEND_REASON)
  })

  it('still explains an absent backend when the service omitted a reason', () => {
    const result = describeFirewallEditability(
      state({ backend: 'none', editable: false, status: 'inactive' })
    )

    expect(result.reason).toBe(FIREWALL_NO_BACKEND_REASON)
  })

  it('prefers the service-supplied reason for readable backends', () => {
    const result = describeFirewallEditability(
      state({
        backend: 'ufw',
        status: 'unknown',
        editable: false,
        unavailableReason: 'Reading the ufw ruleset requires root or passwordless sudo.'
      })
    )

    expect(result.reason).toBe('Reading the ufw ruleset requires root or passwordless sudo.')
  })

  it('names the backend when it is readable but not writable', () => {
    for (const backend of ['nftables', 'iptables'] as const) {
      const result = describeFirewallEditability(state({ backend, editable: false }))
      expect(result.editable).toBe(false)
      expect(result.reason).toContain(backend)
    }
  })
})
