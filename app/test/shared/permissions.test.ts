import { describe, expect, it } from 'vitest'
import {
  PERMISSION_CAPABILITIES,
  TERMINAL_ONLY_FLOWS,
  buildSudoersEntry,
  parseSudoListGrants,
  sudoersEntryMatches
} from '@shared/permissions'

describe('permission catalog integrity', () => {
  it('has unique capability ids', () => {
    const ids = PERMISSION_CAPABILITIES.map((capability) => capability.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has no unresolved placeholders except configRoot, units and action', () => {
    for (const capability of PERMISSION_CAPABILITIES) {
      for (const command of capability.commands) {
        const placeholders = command.match(/\{[^}]+\}/g) ?? []
        for (const placeholder of placeholders) {
          expect(['{configRoot}', '{units}', '{action}']).toContain(placeholder)
        }
      }
    }
  })

  it('only the services capability needs unit selection', () => {
    expect(PERMISSION_CAPABILITIES.filter((capability) => capability.needsUnits)).toHaveLength(1)
  })

  it('covers every capability with a category and operations', () => {
    for (const capability of PERMISSION_CAPABILITIES) {
      expect(['read-only', 'service-control', 'operational', 'root-equivalent']).toContain(
        capability.category
      )
      expect(capability.operations.length).toBeGreaterThan(0)
      for (const operation of capability.operations) {
        expect(operation).toMatch(/^[A-Za-z]+\.[a-zA-Z]+/)
      }
    }
  })

  it('keeps read-only capabilities to low danger', () => {
    for (const capability of PERMISSION_CAPABILITIES.filter((c) => c.category === 'read-only')) {
      expect(capability.danger).toBe('low')
    }
  })

  it('marks cron writes, packages, users and nginx writes as critical', () => {
    const critical = new Set(
      PERMISSION_CAPABILITIES.filter((c) => c.danger === 'critical').map((c) => c.id)
    )
    expect(critical).toEqual(
      new Set(['cron.write_root', 'packages.manage', 'users.manage', 'nginx.write_config'])
    )
  })

  it('uses an exact openssl invocation without broad wildcards', () => {
    const inspect = PERMISSION_CAPABILITIES.find((c) => c.id === 'ssl.inspect_keys')!
    expect(inspect.commands).toHaveLength(1)
    expect(inspect.commands[0]).toContain('-noout -subject -issuer -dates -serial')
    expect(inspect.commands[0]).not.toMatch(/x509 \*$/)
  })

  it('whitelists systemctl actions for unit control', () => {
    const control = PERMISSION_CAPABILITIES.find((c) => c.id === 'services.control_unit')!
    expect(control.commands).toEqual(['/usr/bin/systemctl {action} {units}'])
    expect(control.commands[0]).not.toContain('* {units}')
  })

  it('terminal-only flows are not capabilities', () => {
    const ids = new Set(PERMISSION_CAPABILITIES.map((capability) => capability.id))
    for (const flow of TERMINAL_ONLY_FLOWS) {
      expect(ids.has(flow.id)).toBe(false)
    }
  })
})

describe('buildSudoersEntry', () => {
  it('builds a scoped line for enabled capabilities', () => {
    const entry = buildSudoersEntry('admin', new Set(['nginx.read_config', 'nginx.reload']), {})
    expect(entry).toBe(
      'admin ALL=(root) NOPASSWD: /usr/sbin/nginx -T, /usr/bin/systemctl reload nginx, /usr/sbin/nginx -s reload'
    )
  })

  it('interpolates configRoot and units', () => {
    const entry = buildSudoersEntry(
      'admin',
      new Set(['nginx.write_config', 'services.control_unit']),
      { configRoot: '/etc/nginx', units: ['nginx.service'] }
    )
    expect(entry).toContain('/bin/cp -- /tmp/zvia-nginx-* /etc/nginx/*')
    expect(entry).toContain('/usr/bin/systemctl start nginx.service')
  })

  it('skips unit lines when no units are chosen', () => {
    const entry = buildSudoersEntry('admin', new Set(['services.control_unit']), { units: [] })
    expect(entry).toBe('admin ALL=(root) NOPASSWD: ')
  })

  it('expands whitelisted actions per unit', () => {
    const entry = buildSudoersEntry('admin', new Set(['services.control_unit']), {
      units: ['nginx.service']
    })
    expect(entry).toContain('/usr/bin/systemctl reload nginx.service')
    expect(entry).toContain('/usr/bin/systemctl enable nginx.service')
    expect(entry).not.toContain('{action}')
    expect(entry).not.toContain('* nginx.service')
  })
})

describe('sudoersEntryMatches', () => {
  it('matches wildcards', () => {
    expect(sudoersEntryMatches('/usr/bin/openssl x509 -noout -in a', '/usr/bin/openssl x509 *')).toBe(
      true
    )
    expect(sudoersEntryMatches('/usr/bin/openssl req -new', '/usr/bin/openssl x509 *')).toBe(false)
  })

  it('matches exactly without wildcards', () => {
    expect(sudoersEntryMatches('/usr/sbin/nginx -T', '/usr/sbin/nginx -T')).toBe(true)
    expect(sudoersEntryMatches('/usr/sbin/nginx -t', '/usr/sbin/nginx -T')).toBe(false)
  })
})

describe('parseSudoListGrants', () => {
  it('parses backslash-wrapped sudo -l output', () => {
    // ponytail: sudo wraps the one-line policy — grants past the wrap point must survive
    const output = `Matching Defaults entries for illia-co on ubuntu:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\\:/usr/local/bin

User illia-co may run the following commands on ubuntu:
    (root) NOPASSWD: /usr/sbin/nginx -T, /usr/sbin/nginx -t, \\
        /usr/bin/systemctl reload nginx, /usr/bin/certbot certificates`
    expect(parseSudoListGrants(output)).toEqual([
      '/usr/sbin/nginx -T',
      '/usr/sbin/nginx -t',
      '/usr/bin/systemctl reload nginx',
      '/usr/bin/certbot certificates'
    ])
  })

  it('joins plain-wrapped continuation lines', () => {
    const output = `User illia-co may run the following commands on ubuntu:
    (root) NOPASSWD: /usr/sbin/nginx -T, /usr/sbin/nginx -t,
        /usr/bin/systemctl reload nginx`
    expect(parseSudoListGrants(output)).toEqual([
      '/usr/sbin/nginx -T',
      '/usr/sbin/nginx -t',
      '/usr/bin/systemctl reload nginx'
    ])
  })

  it('skips password-gated entries', () => {
    const output = `User illia-co may run the following commands on ubuntu:
    (root) /usr/bin/apt update
    (root) NOPASSWD: /usr/sbin/nginx -T`
    expect(parseSudoListGrants(output)).toEqual(['/usr/sbin/nginx -T'])
  })
})
