import { describe, expect, it } from 'vitest'
import { PORT_RANGE_ERROR, parseFirewallPortForm } from '@renderer/tools/ports/firewallForm'

const SSH_PORT = 22

describe('parseFirewallPortForm', () => {
  it('accepts an arbitrary port that is not listening', () => {
    expect(parseFirewallPortForm({ port: '8080', protocol: 'tcp', action: 'allow' }, SSH_PORT)).toEqual(
      { ok: true, port: 8080, protocol: 'tcp', action: 'allow' }
    )
  })

  it('tolerates surrounding whitespace', () => {
    const result = parseFirewallPortForm({ port: ' 443 ', protocol: 'tcp', action: 'deny' }, SSH_PORT)
    expect(result).toEqual({ ok: true, port: 443, protocol: 'tcp', action: 'deny' })
  })

  it('rejects empty, non-numeric and out-of-range input', () => {
    for (const port of ['', '   ', 'ssh', '80a', '0', '65536', '123456', '-1', '8.0']) {
      expect(parseFirewallPortForm({ port, protocol: 'tcp', action: 'allow' }, SSH_PORT)).toEqual({
        ok: false,
        error: PORT_RANGE_ERROR
      })
    }
  })

  it('refuses the SSH port over tcp so the session cannot be locked out', () => {
    const result = parseFirewallPortForm({ port: '22', protocol: 'tcp', action: 'deny' }, SSH_PORT)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('SSH port')
  })

  it('refuses the SSH port even for an allow rule', () => {
    expect(parseFirewallPortForm({ port: '2222', protocol: 'tcp', action: 'allow' }, 2222).ok).toBe(
      false
    )
  })

  it('permits the SSH port number over udp, which SSH does not use', () => {
    expect(parseFirewallPortForm({ port: '22', protocol: 'udp', action: 'deny' }, SSH_PORT)).toEqual({
      ok: true,
      port: 22,
      protocol: 'udp',
      action: 'deny'
    })
  })
})
