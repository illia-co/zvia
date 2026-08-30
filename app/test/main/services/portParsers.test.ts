import { describe, expect, it } from 'vitest'
import {
  CGROUP_BLOCK_PREFIX,
  classifyExposure,
  dedupeListeners,
  parseCgroupBlocks,
  parseDockerPsIds,
  parseIptablesRules,
  parseLsofOutput,
  parseNftRules,
  parseSsOutput,
  parseUfwStatus,
  resolveContainerName,
  ruleCoversPort,
  ruleScopeIsUnknown,
  ufwVerdictForPort
} from '@main/services/portParsers'

const SS_OUTPUT = [
  'udp   UNCONN 0      0          127.0.0.53%lo:53        0.0.0.0:*    users:(("systemd-resolve",pid=612,fd=13))',
  'tcp   LISTEN 0      128              0.0.0.0:22        0.0.0.0:*    users:(("sshd",pid=800,fd=3))',
  'tcp   LISTEN 0      511                    *:80              *:*    users:(("nginx",pid=1200,fd=6),("nginx",pid=1199,fd=6))',
  'tcp   LISTEN 0      128                 [::]:22           [::]:*    users:(("sshd",pid=800,fd=4))',
  'tcp   LISTEN 0      4096         127.0.0.1:5432       0.0.0.0:*'
].join('\n')

const LSOF_OUTPUT = [
  'COMMAND     PID     USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
  'systemd-r   612 systemd-resolve   13u  IPv4  20123      0t0  UDP 127.0.0.53:53',
  'sshd        800     root    3u  IPv4  21456      0t0  TCP *:22 (LISTEN)',
  'nginx      1200 www-data    6u  IPv6  22987      0t0  TCP *:80 (LISTEN)',
  'curl       1400     root    5u  IPv4  23100      0t0  TCP 10.0.0.5:52000->93.184.216.34:80 (ESTABLISHED)'
].join('\n')

const UFW_VERBOSE = [
  'Status: active',
  'Logging: on (low)',
  'Default: deny (incoming), allow (outgoing), disabled (routed)',
  'New profiles: skip',
  '',
  'To                         Action      From',
  '--                         ------      ----',
  '22/tcp                     ALLOW IN    Anywhere'
].join('\n')

const UFW_NUMBERED = [
  'Status: active',
  '',
  '     To                         Action      From',
  '     --                         ------      ----',
  '[ 1] 22/tcp                     ALLOW IN    Anywhere',
  '[ 2] 80,443/tcp                 ALLOW IN    Anywhere',
  '[ 3] 6000:6007/tcp              DENY IN     Anywhere',
  '[ 4] OpenSSH                    ALLOW IN    Anywhere',
  '[ 5] 22/tcp (v6)                ALLOW IN    Anywhere (v6)'
].join('\n')

describe('parseSsOutput', () => {
  it('parses protocol, bind address, port and owning process', () => {
    const listeners = parseSsOutput(SS_OUTPUT)

    expect(listeners).toHaveLength(5)
    expect(listeners[0]).toEqual({
      protocol: 'udp',
      address: '127.0.0.53',
      port: 53,
      pid: 612,
      process: 'systemd-resolve'
    })
    expect(listeners[1]).toEqual({
      protocol: 'tcp',
      address: '0.0.0.0',
      port: 22,
      pid: 800,
      process: 'sshd'
    })
    expect(listeners[3]).toMatchObject({ address: '::', port: 22 })
  })

  it('keeps listeners whose process is hidden from an unprivileged user', () => {
    const listeners = parseSsOutput(SS_OUTPUT)
    expect(listeners[4]).toEqual({
      protocol: 'tcp',
      address: '127.0.0.1',
      port: 5432,
      pid: null,
      process: ''
    })
  })

  it('ignores the header emitted by the ss -tulpn fallback', () => {
    const withHeader = `Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port Process\n${SS_OUTPUT}`
    expect(parseSsOutput(withHeader)).toHaveLength(5)
  })
})

describe('parseLsofOutput', () => {
  it('parses listening sockets and skips established connections', () => {
    const listeners = parseLsofOutput(LSOF_OUTPUT)

    expect(listeners).toEqual([
      { protocol: 'udp', address: '127.0.0.53', port: 53, pid: 612, process: 'systemd-r' },
      { protocol: 'tcp', address: '*', port: 22, pid: 800, process: 'sshd' },
      { protocol: 'tcp', address: '*', port: 80, pid: 1200, process: 'nginx' }
    ])
  })
})

describe('classifyExposure', () => {
  it('classifies bind addresses without claiming public reachability', () => {
    expect(classifyExposure('0.0.0.0')).toBe('bound-all')
    expect(classifyExposure('::')).toBe('bound-all')
    expect(classifyExposure('*')).toBe('bound-all')
    expect(classifyExposure('127.0.0.1')).toBe('localhost')
    expect(classifyExposure('127.0.0.53%lo')).toBe('localhost')
    expect(classifyExposure('::1')).toBe('localhost')
    expect(classifyExposure('10.0.0.5')).toBe('bound-specific')
  })
})

describe('dedupeListeners', () => {
  it('collapses identical rows but keeps distinct bind addresses', () => {
    const listeners = dedupeListeners(parseSsOutput(SS_OUTPUT).concat(parseSsOutput(SS_OUTPUT)))
    expect(listeners).toHaveLength(5)
  })
})

describe('parseCgroupBlocks', () => {
  it('attributes PIDs to systemd units and Docker containers', () => {
    const stdout = [
      `${CGROUP_BLOCK_PREFIX}800---`,
      '0::/system.slice/ssh.service',
      `${CGROUP_BLOCK_PREFIX}1200---`,
      '12:pids:/system.slice/nginx.service',
      '1:name=systemd:/system.slice/nginx.service',
      '0::/system.slice/nginx.service',
      `${CGROUP_BLOCK_PREFIX}1500---`,
      '0::/system.slice/docker-3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a.scope',
      `${CGROUP_BLOCK_PREFIX}1600---`,
      '0::/docker/aabbccddeeff00112233445566778899aabbccddeeff001122334455667788',
      `${CGROUP_BLOCK_PREFIX}1700---`,
      '0::/user.slice/user-1000.slice/session-3.scope'
    ].join('\n')

    const attributions = parseCgroupBlocks(stdout)

    expect(attributions.get(800)).toEqual({ unit: 'ssh.service', containerId: null })
    expect(attributions.get(1200)).toEqual({ unit: 'nginx.service', containerId: null })
    expect(attributions.get(1500)).toEqual({
      unit: null,
      containerId: '3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a'
    })
    expect(attributions.get(1600)?.containerId).toBe(
      'aabbccddeeff00112233445566778899aabbccddeeff001122334455667788'
    )
    expect(attributions.get(1700)).toEqual({ unit: null, containerId: null })
  })

  it('records missing cgroup files as unattributed rather than failing', () => {
    const attributions = parseCgroupBlocks(`${CGROUP_BLOCK_PREFIX}999---\n`)
    expect(attributions.get(999)).toEqual({ unit: null, containerId: null })
  })
})

describe('resolveContainerName', () => {
  it('matches full cgroup IDs against short docker ps IDs', () => {
    const containers = parseDockerPsIds('3f2a1b9c8d7e  web\naabbccddeeff  db\n')
    expect(containers).toHaveLength(2)
    expect(
      resolveContainerName(
        '3f2a1b9c8d7e6f5a4b3c2d1e0f9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a',
        containers
      )
    ).toBe('web')
    expect(resolveContainerName('0000000000ff', containers)).toBeNull()
  })
})

describe('parseUfwStatus', () => {
  it('parses status, default incoming policy and numbered rules', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)

    expect(state.status).toBe('active')
    expect(state.defaultIncoming).toBe('deny')
    expect(state.rules).toHaveLength(5)
    expect(state.rules[0]).toMatchObject({
      id: '1',
      action: 'ALLOW IN',
      target: '22/tcp',
      from: 'Anywhere',
      protocol: 'tcp',
      ports: [{ start: 22, end: 22 }]
    })
    expect(state.rules[1].ports).toEqual([
      { start: 80, end: 80 },
      { start: 443, end: 443 }
    ])
    expect(state.rules[2].ports).toEqual([{ start: 6000, end: 6007 }])
  })

  it('leaves a profile rule unparsed when verbose output does not describe it', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)
    const openSsh = state.rules[3]
    expect(openSsh.target).toBe('OpenSSH')
    expect(openSsh.ports).toEqual([])
    expect(ruleScopeIsUnknown(openSsh)).toBe(true)
  })

  it('strips the (v6) annotation when parsing the port spec', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)
    expect(state.rules[4].ports).toEqual([{ start: 22, end: 22 }])
    expect(state.rules[4].protocol).toBe('tcp')
  })

  it('reports an inactive firewall', () => {
    const state = parseUfwStatus('Status: inactive', 'Status: inactive')
    expect(state.status).toBe('inactive')
    expect(state.rules).toEqual([])
  })

  it('reports unknown when the output could not be read', () => {
    const state = parseUfwStatus('', 'ERROR: You need to be root to run this script')
    expect(state.status).toBe('unknown')
    expect(state.defaultIncoming).toBe('unknown')
  })
})

describe('ruleCoversPort', () => {
  it('matches ranges and respects the protocol', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)
    expect(ruleCoversPort(state.rules[2], 6003, 'tcp')).toBe(true)
    expect(ruleCoversPort(state.rules[2], 6003, 'udp')).toBe(false)
    expect(ruleCoversPort(state.rules[2], 5999, 'tcp')).toBe(false)
  })
})

describe('ufwVerdictForPort', () => {
  it('derives verdicts from matching rules', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)
    expect(ufwVerdictForPort(state, 22, 'tcp')).toBe('allowed')
    expect(ufwVerdictForPort(state, 6001, 'tcp')).toBe('blocked')
  })

  it('falls back to the default incoming policy', () => {
    const state = parseUfwStatus(UFW_VERBOSE, UFW_NUMBERED)
    expect(ufwVerdictForPort(state, 9999, 'tcp')).toBe('blocked')
  })

  it('treats an inactive firewall as not filtering', () => {
    const state = parseUfwStatus('Status: inactive', 'Status: inactive')
    expect(ufwVerdictForPort(state, 22, 'tcp')).toBe('allowed')
  })

  it('returns unknown rather than guessing when the state is unreadable', () => {
    expect(
      ufwVerdictForPort({ status: 'unknown', defaultIncoming: 'unknown', rules: [] }, 22, 'tcp')
    ).toBe('unknown')
  })

  it('returns unknown when the default policy is unavailable and nothing matches', () => {
    const state = parseUfwStatus('Status: active', UFW_NUMBERED)
    expect(ufwVerdictForPort(state, 9999, 'tcp')).toBe('unknown')
  })

  it('ignores outbound rules', () => {
    const state = parseUfwStatus(
      'Status: active\nDefault: deny (incoming), allow (outgoing), disabled (routed)',
      'Status: active\n[ 1] 25/tcp                     ALLOW OUT   Anywhere'
    )
    expect(ufwVerdictForPort(state, 25, 'tcp')).toBe('blocked')
  })
})

describe('parseNftRules', () => {
  it('extracts destination ports and verdicts from a ruleset', () => {
    const stdout = [
      'table inet filter {',
      '  chain input {',
      '    type filter hook input priority 0; policy drop;',
      '    iif "lo" accept',
      '    tcp dport 22 accept',
      '    tcp dport { 80, 443 } accept',
      '    udp dport 60000-60010 drop',
      '  }',
      '}'
    ].join('\n')

    const rules = parseNftRules(stdout)

    expect(rules).toHaveLength(4)
    expect(rules[1]).toMatchObject({
      action: 'ACCEPT',
      protocol: 'tcp',
      ports: [{ start: 22, end: 22 }]
    })
    expect(rules[2].ports).toEqual([
      { start: 80, end: 80 },
      { start: 443, end: 443 }
    ])
    expect(rules[3]).toMatchObject({
      action: 'DROP',
      protocol: 'udp',
      ports: [{ start: 60000, end: 60010 }]
    })
    expect(rules.every((rule) => rule.id === '')).toBe(true)
  })
})

describe('parseIptablesRules', () => {
  it('parses appended rules from iptables -S', () => {
    const stdout = [
      '-P INPUT ACCEPT',
      '-N DOCKER',
      '-A INPUT -p tcp -m tcp --dport 22 -j ACCEPT',
      '-A INPUT -p tcp -m multiport --dports 80,443 -j ACCEPT',
      '-A INPUT -p udp -m udp --dport 5000:5010 -j DROP'
    ].join('\n')

    const rules = parseIptablesRules(stdout)

    expect(rules).toHaveLength(3)
    expect(rules[0]).toMatchObject({
      action: 'ACCEPT',
      protocol: 'tcp',
      ports: [{ start: 22, end: 22 }]
    })
    expect(rules[1].ports).toEqual([
      { start: 80, end: 80 },
      { start: 443, end: 443 }
    ])
    expect(rules[2].ports).toEqual([{ start: 5000, end: 5010 }])
  })
})

/**
 * Verbatim `sudo -n ss -tulpnH` from Ubuntu 24.04.4 LTS (iproute2 6.1, cgroup v2).
 * Column alignment, the `%eth0` scope suffix and the trailing padding are all
 * exactly as the real command emits them.
 */
const REAL_SS_TULPNH = [
  'udp UNCONN 0      0      192.168.139.90%eth0:68 0.0.0.0:* users:(("systemd-network",pid=181,fd=18))',
  'tcp LISTEN 0      4096               0.0.0.0:22 0.0.0.0:* users:(("systemd",pid=1,fd=52))          ',
  'tcp LISTEN 0      4096                  [::]:22    [::]:* users:(("systemd",pid=1,fd=58))          '
].join('\n')

/** Verbatim `ss -tulpn` from the same host, including its glued-together header. */
const REAL_SS_TULPN_WITH_HEADER = [
  'Netid State  Recv-Q Send-Q       Local Address:Port Peer Address:PortProcess                                   ',
  'udp   UNCONN 0      0      192.168.139.90%eth0:68        0.0.0.0:*    users:(("systemd-network",pid=181,fd=18))',
  'tcp   LISTEN 0      4096               0.0.0.0:22        0.0.0.0:*    users:(("systemd",pid=1,fd=52))          ',
  'tcp   LISTEN 0      4096                  [::]:22           [::]:*    users:(("systemd",pid=1,fd=58))          '
].join('\n')

describe('parseSsOutput against real Ubuntu 24.04 output', () => {
  it('parses ss -tulpnH including the interface scope suffix', () => {
    const listeners = parseSsOutput(REAL_SS_TULPNH)

    expect(listeners).toEqual([
      {
        protocol: 'udp',
        address: '192.168.139.90',
        port: 68,
        pid: 181,
        process: 'systemd-network'
      },
      { protocol: 'tcp', address: '0.0.0.0', port: 22, pid: 1, process: 'systemd' },
      { protocol: 'tcp', address: '::', port: 22, pid: 1, process: 'systemd' }
    ])
    expect(listeners.map((listener) => classifyExposure(listener.address))).toEqual([
      'bound-specific',
      'bound-all',
      'bound-all'
    ])
  })

  it('skips the header emitted by the ss -tulpn fallback', () => {
    expect(parseSsOutput(REAL_SS_TULPN_WITH_HEADER)).toEqual(parseSsOutput(REAL_SS_TULPNH))
  })
})

describe('parseCgroupBlocks against real cgroup v2 output', () => {
  it('attributes unified-hierarchy service cgroups and ignores init.scope', () => {
    const stdout = [
      `${CGROUP_BLOCK_PREFIX}1---`,
      '0::/init.scope',
      `${CGROUP_BLOCK_PREFIX}181---`,
      '0::/system.slice/systemd-networkd.service',
      `${CGROUP_BLOCK_PREFIX}221---`,
      '0::/system.slice/cron.service',
      ''
    ].join('\n')

    const attributions = parseCgroupBlocks(stdout)

    expect(attributions.get(1)).toEqual({ unit: null, containerId: null })
    expect(attributions.get(181)).toEqual({
      unit: 'systemd-networkd.service',
      containerId: null
    })
    expect(attributions.get(221)).toEqual({ unit: 'cron.service', containerId: null })
  })

  it('attributes a cgroup v2 docker scope to its container id', () => {
    const containerId = 'a'.repeat(64)
    const stdout = [
      `${CGROUP_BLOCK_PREFIX}900---`,
      `0::/system.slice/docker-${containerId}.scope`
    ].join('\n')

    expect(parseCgroupBlocks(stdout).get(900)).toEqual({ unit: null, containerId })
  })
})

/**
 * Verbatim `sudo ufw status verbose` from ufw 0.36.2-6 on Ubuntu 24.04.4 LTS,
 * including the column padding, the single space before ALLOW on the long
 * `Nginx Full (v6)` row and the trailing `# comment` suffix.
 */
const REAL_UFW_VERBOSE = [
  'Status: active',
  'Logging: on (low)',
  'Default: deny (incoming), allow (outgoing), deny (routed)',
  'New profiles: skip',
  '',
  'To                         Action      From',
  '--                         ------      ----',
  '22/tcp                     ALLOW IN    Anywhere                  ',
  '8080/tcp                   ALLOW IN    Anywhere                  ',
  '80,443/tcp (Nginx Full)    ALLOW IN    Anywhere                  ',
  '5353/udp                   ALLOW IN    Anywhere                  ',
  '9000/tcp                   DENY IN     10.0.0.0/8                ',
  '6000:6010/tcp              ALLOW IN    Anywhere                  ',
  '2222/tcp                   LIMIT IN    Anywhere                  ',
  '9999/tcp                   REJECT IN   Anywhere                  ',
  '7000/tcp                   ALLOW IN    Anywhere                   # zvia test comment',
  '3000                       ALLOW IN    Anywhere                  ',
  '80/tcp (Nginx HTTP)        ALLOW IN    10.0.0.0/8                ',
  '4000/tcp on eth0           ALLOW IN    Anywhere                  ',
  '192.168.139.90 5000/tcp    ALLOW IN    Anywhere                  ',
  '22/tcp (OpenSSH)           ALLOW IN    Anywhere                  ',
  '22/tcp (v6)                ALLOW IN    Anywhere (v6)             ',
  '8080/tcp (v6)              ALLOW IN    Anywhere (v6)             ',
  '80,443/tcp (Nginx Full (v6)) ALLOW IN    Anywhere (v6)             ',
  '5353/udp (v6)              ALLOW IN    Anywhere (v6)             ',
  '6000:6010/tcp (v6)         ALLOW IN    Anywhere (v6)             ',
  '2222/tcp (v6)              LIMIT IN    Anywhere (v6)             ',
  '9999/tcp (v6)              REJECT IN   Anywhere (v6)             ',
  '7000/tcp (v6)              ALLOW IN    Anywhere (v6)              # zvia test comment',
  '3000 (v6)                  ALLOW IN    Anywhere (v6)             ',
  '4000/tcp (v6) on eth0      ALLOW IN    Anywhere (v6)             ',
  '22/tcp (OpenSSH (v6))      ALLOW IN    Anywhere (v6)             '
].join('\n')

/** Verbatim `sudo ufw status numbered` for the same ruleset. */
const REAL_UFW_NUMBERED = [
  'Status: active',
  '',
  '     To                         Action      From',
  '     --                         ------      ----',
  '[ 1] 22/tcp                     ALLOW IN    Anywhere                  ',
  '[ 2] 8080/tcp                   ALLOW IN    Anywhere                  ',
  '[ 3] Nginx Full                 ALLOW IN    Anywhere                  ',
  '[ 4] 5353/udp                   ALLOW IN    Anywhere                  ',
  '[ 5] 9000/tcp                   DENY IN     10.0.0.0/8                ',
  '[ 6] 6000:6010/tcp              ALLOW IN    Anywhere                  ',
  '[ 7] 2222/tcp                   LIMIT IN    Anywhere                  ',
  '[ 8] 9999/tcp                   REJECT IN   Anywhere                  ',
  '[ 9] 7000/tcp                   ALLOW IN    Anywhere                   # zvia test comment',
  '[10] 3000                       ALLOW IN    Anywhere                  ',
  '[11] Nginx HTTP                 ALLOW IN    10.0.0.0/8                ',
  '[12] 4000/tcp on eth0           ALLOW IN    Anywhere                  ',
  '[13] 192.168.139.90 5000/tcp    ALLOW IN    Anywhere                  ',
  '[14] OpenSSH                    ALLOW IN    Anywhere                  ',
  '[15] 22/tcp (v6)                ALLOW IN    Anywhere (v6)             ',
  '[16] 8080/tcp (v6)              ALLOW IN    Anywhere (v6)             ',
  '[17] Nginx Full (v6)            ALLOW IN    Anywhere (v6)             ',
  '[18] 5353/udp (v6)              ALLOW IN    Anywhere (v6)             ',
  '[19] 6000:6010/tcp (v6)         ALLOW IN    Anywhere (v6)             ',
  '[20] 2222/tcp (v6)              LIMIT IN    Anywhere (v6)             ',
  '[21] 9999/tcp (v6)              REJECT IN   Anywhere (v6)             ',
  '[22] 7000/tcp (v6)              ALLOW IN    Anywhere (v6)              # zvia test comment',
  '[23] 3000 (v6)                  ALLOW IN    Anywhere (v6)             ',
  '[24] 4000/tcp (v6) on eth0      ALLOW IN    Anywhere (v6)             ',
  '[25] OpenSSH (v6)               ALLOW IN    Anywhere (v6)             '
].join('\n')

/** Verbatim output of both commands before `ufw enable` was ever run. */
const REAL_UFW_INACTIVE = 'Status: inactive'

describe('parseUfwStatus against real ufw 0.36.2 output', () => {
  const state = parseUfwStatus(REAL_UFW_VERBOSE, REAL_UFW_NUMBERED)
  const byId = (id: string) => state.rules.find((rule) => rule.id === id)

  it('reads the status and default incoming policy', () => {
    expect(state.status).toBe('active')
    expect(state.defaultIncoming).toBe('deny')
  })

  it('keeps ufw rule numbers as the delete key, including the v6 duplicates', () => {
    expect(state.rules).toHaveLength(25)
    expect(state.rules.map((rule) => rule.id)).toEqual(
      Array.from({ length: 25 }, (_, index) => String(index + 1))
    )
  })

  it('parses plain, multi-port, range, protocol-less and udp targets', () => {
    expect(byId('1')).toMatchObject({ protocol: 'tcp', ports: [{ start: 22, end: 22 }] })
    expect(byId('4')).toMatchObject({ protocol: 'udp', ports: [{ start: 5353, end: 5353 }] })
    expect(byId('6')?.ports).toEqual([{ start: 6000, end: 6010 }])
    // `ufw allow 3000` has no protocol suffix and covers both tcp and udp.
    expect(byId('10')).toMatchObject({ protocol: null, ports: [{ start: 3000, end: 3000 }] })
    expect(ruleCoversPort(byId('10')!, 3000, 'tcp')).toBe(true)
    expect(ruleCoversPort(byId('10')!, 3000, 'udp')).toBe(true)
  })

  it('recovers application profile ports from the verbose output', () => {
    // `ufw status numbered` prints only "Nginx Full", so without the verbose
    // cross-reference an nginx-opened port was reported as blocked.
    expect(byId('3')).toMatchObject({
      target: 'Nginx Full',
      protocol: 'tcp',
      ports: [
        { start: 80, end: 80 },
        { start: 443, end: 443 }
      ]
    })
    expect(byId('11')).toMatchObject({
      target: 'Nginx HTTP',
      protocol: 'tcp',
      ports: [{ start: 80, end: 80 }]
    })
    expect(ruleScopeIsUnknown(byId('3')!)).toBe(false)
  })

  it('matches the v6 copy of a profile rule to the same ports', () => {
    expect(byId('17')).toMatchObject({
      target: 'Nginx Full (v6)',
      ports: [
        { start: 80, end: 80 },
        { start: 443, end: 443 }
      ]
    })
  })

  it('parses interface-scoped targets, where the port comes before the interface', () => {
    expect(byId('12')).toMatchObject({
      target: '4000/tcp on eth0',
      protocol: 'tcp',
      ports: [{ start: 4000, end: 4000 }]
    })
    expect(byId('24')).toMatchObject({
      target: '4000/tcp (v6) on eth0',
      protocol: 'tcp',
      ports: [{ start: 4000, end: 4000 }]
    })
  })

  it('parses destination-scoped targets, where the port comes last', () => {
    expect(byId('13')).toMatchObject({
      target: '192.168.139.90 5000/tcp',
      protocol: 'tcp',
      ports: [{ start: 5000, end: 5000 }]
    })
  })

  it('does not mistake a trailing rule comment for a column', () => {
    expect(byId('9')).toMatchObject({
      target: '7000/tcp',
      action: 'ALLOW IN',
      from: 'Anywhere',
      ports: [{ start: 7000, end: 7000 }]
    })
    expect(byId('9')?.raw).toContain('# zvia test comment')
  })

  it('records the source address of a scoped deny rule', () => {
    expect(byId('5')).toMatchObject({
      action: 'DENY IN',
      from: '10.0.0.0/8',
      ports: [{ start: 9000, end: 9000 }]
    })
  })

  it('reports the inactive firewall captured before ufw was enabled', () => {
    const inactive = parseUfwStatus(REAL_UFW_INACTIVE, REAL_UFW_INACTIVE)
    expect(inactive.status).toBe('inactive')
    expect(inactive.defaultIncoming).toBe('unknown')
    expect(inactive.rules).toEqual([])
  })
})

describe('ufwVerdictForPort against real ufw 0.36.2 output', () => {
  const state = parseUfwStatus(REAL_UFW_VERBOSE, REAL_UFW_NUMBERED)

  it('reports ports opened only by an application profile as allowed', () => {
    // Verified on the host: nginx answered HTTP 200 on port 80 with this ruleset.
    expect(ufwVerdictForPort(state, 80, 'tcp')).toBe('allowed')
    expect(ufwVerdictForPort(state, 443, 'tcp')).toBe('allowed')
  })

  it('treats LIMIT as allowed, because it only rate-limits', () => {
    expect(ufwVerdictForPort(state, 2222, 'tcp')).toBe('allowed')
  })

  it('reports interface-scoped and destination-scoped ports as allowed', () => {
    expect(ufwVerdictForPort(state, 4000, 'tcp')).toBe('allowed')
    expect(ufwVerdictForPort(state, 5000, 'tcp')).toBe('allowed')
  })

  it('reports REJECT rules and the default policy as blocked', () => {
    expect(ufwVerdictForPort(state, 9999, 'tcp')).toBe('blocked')
    expect(ufwVerdictForPort(state, 12345, 'tcp')).toBe('blocked')
  })
})

describe('SSH lockout guard against real ufw 0.36.2 output', () => {
  const state = parseUfwStatus(REAL_UFW_VERBOSE, REAL_UFW_NUMBERED)
  const byId = (id: string) => state.rules.find((rule) => rule.id === id)

  /** Mirrors the checks PortService.deleteRule applies before deleting a rule. */
  const deleteWouldBeRefused = (id: string, sshPort: number): boolean => {
    const rule = byId(id)
    if (!rule) return true
    return ruleScopeIsUnknown(rule) || ruleCoversPort(rule, sshPort, 'tcp')
  }

  it('refuses to delete either the v4 or the v6 rule for the live SSH port', () => {
    expect(deleteWouldBeRefused('1', 22)).toBe(true)
    expect(deleteWouldBeRefused('15', 22)).toBe(true)
  })

  it('refuses to delete an application profile rule that resolves to the SSH port', () => {
    // Recovering profile ports must not open a hole in the guard: the OpenSSH
    // profile is 22/tcp, so it stays undeletable now that its scope is known.
    expect(byId('14')?.ports).toEqual([{ start: 22, end: 22 }])
    expect(deleteWouldBeRefused('14', 22)).toBe(true)
    expect(deleteWouldBeRefused('25', 22)).toBe(true)
  })

  it('still allows deleting rules that do not touch the SSH port', () => {
    expect(deleteWouldBeRefused('2', 22)).toBe(false)
    expect(deleteWouldBeRefused('3', 22)).toBe(false)
  })

  it('protects a non-default SSH port covered by a range rule', () => {
    expect(deleteWouldBeRefused('6', 6005)).toBe(true)
  })
})

describe('read-only backends against the real ruleset ufw generated', () => {
  it('parses the ufw-generated iptables rules for port 22 and the Nginx Full profile', () => {
    // Verbatim lines from `sudo iptables -S` on the same host, including the
    // percent-encoded profile comment ufw attaches to multiport rules.
    const stdout = [
      '-P INPUT DROP',
      '-N ufw-user-input',
      '-A ufw-before-input -p udp -m udp --sport 67 --dport 68 -j ACCEPT',
      '-A ufw-after-input -p tcp -m tcp --dport 139 -j ufw-skip-to-policy-input',
      '-A ufw-user-input -p tcp -m tcp --dport 22 -j ACCEPT',
      '-A ufw-user-input -p tcp -m multiport --dports 80,443 -m comment --comment "\\\'dapp_Nginx%20Full\\\'" -j ACCEPT'
    ].join('\n')

    const rules = parseIptablesRules(stdout)

    expect(rules).toHaveLength(4)
    // --sport must not be mistaken for the destination port.
    expect(rules[0]).toMatchObject({ protocol: 'udp', ports: [{ start: 68, end: 68 }] })
    expect(rules[2]).toMatchObject({
      action: 'ACCEPT',
      protocol: 'tcp',
      ports: [{ start: 22, end: 22 }]
    })
    expect(rules[3]).toMatchObject({
      action: 'ACCEPT',
      protocol: 'tcp',
      ports: [
        { start: 80, end: 80 },
        { start: 443, end: 443 }
      ]
    })
  })

  it('parses the ufw-generated nftables ruleset, including counters and sets', () => {
    // Verbatim lines from `sudo nft list ruleset` on the same host. Real ufw
    // rules carry `counter packets N bytes N` between the match and the verdict.
    const stdout = [
      'table ip filter {',
      '\tchain ufw-user-input {',
      '\t\tiifname "lo" counter packets 0 bytes 0 accept',
      '\t\tct state invalid counter packets 0 bytes 0 drop',
      '\t\ttcp dport 22 counter packets 0 bytes 0 accept',
      '\t\tip protocol tcp tcp dport { 80, 443 }  counter packets 0 bytes 0 accept',
      '\t\tip daddr 224.0.0.251 udp dport 5353 counter packets 0 bytes 0 accept',
      '\t}',
      '}'
    ].join('\n')

    const rules = parseNftRules(stdout)

    expect(rules).toHaveLength(5)
    expect(rules[0]).toMatchObject({ action: 'ACCEPT', ports: [] })
    expect(rules[2]).toMatchObject({
      action: 'ACCEPT',
      protocol: 'tcp',
      ports: [{ start: 22, end: 22 }]
    })
    expect(rules[3].ports).toEqual([
      { start: 80, end: 80 },
      { start: 443, end: 443 }
    ])
    expect(rules[4]).toMatchObject({ protocol: 'udp', ports: [{ start: 5353, end: 5353 }] })
  })
})
