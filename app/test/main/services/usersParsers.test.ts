import { describe, expect, it } from 'vitest'
import {
  buildDiscoveryCommand,
  buildUserSummaries,
  classifyUserKind,
  groupsForUser,
  parseAdminGroups,
  parseGroup,
  parseLastlog,
  parsePasswd,
  parsePasswdStatus,
  parseSshKeygenLine,
  parseSshSection,
  protectedUserReason,
  resolveAdminGroup,
  splitDiscoverySections
} from '@main/services/usersParsers'

const GETENT_PASSWD = [
  'root:x:0:0:root:/root:/bin/bash',
  'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
  'ubuntu:x:1000:1000:Ubuntu:/home/ubuntu:/bin/bash',
  'deploy:x:1001:1001:Deploy User:/home/deploy:/bin/bash',
  'nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin'
].join('\n')

const GETENT_GROUP = [
  'root:x:0:',
  'sudo:x:27:ubuntu',
  'deploy:x:1002:deploy',
  'docker:x:999:ubuntu,deploy'
].join('\n')

const LASTLOG = [
  'Username         Port     From             Latest',
  'root                                       **Never logged in**',
  'ubuntu           pts/0    203.0.113.5      Mon Aug 25 09:12:03 +0000 2026',
  'deploy                                       **Never logged in**'
].join('\n')

const PASSWD_STATUS = [
  'root L',
  'ubuntu P',
  'deploy NP',
  'daemon L'
].join('\n')

const ADMIN_GROUPS = ['sudo:x:27:ubuntu', 'docker:x:999:ubuntu,deploy'].join('\n')

const SSH_SECTION = [
  'KEYS:ubuntu:/home/ubuntu/.ssh/authorized_keys:2',
  'FPRAW:ubuntu:256 SHA256:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890 user@laptop (ED25519)',
  'FPRAW:ubuntu:3072 SHA256:ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKkJjIiHhGgFfEe user@desktop (RSA)',
  'KEYS:deploy:/home/deploy/.ssh/authorized_keys:0'
].join('\n')

const DISCOVERY_OUTPUT = [
  '---RELAY:PASSWD---',
  GETENT_PASSWD,
  '---RELAY:GROUP---',
  GETENT_GROUP,
  '---RELAY:WHOAMI---',
  'ubuntu',
  '---RELAY:UID_MIN---',
  'UID_MIN\t1000',
  '---RELAY:LASTLOG---',
  LASTLOG,
  '---RELAY:PASSWD_STATUS---',
  PASSWD_STATUS,
  '---RELAY:ADMIN_GROUPS---',
  ADMIN_GROUPS,
  '---RELAY:SSH---',
  SSH_SECTION
].join('\n')

describe('parsePasswd', () => {
  it('parses getent passwd lines', () => {
    const entries = parsePasswd(GETENT_PASSWD)
    expect(entries).toHaveLength(5)
    expect(entries[2]).toEqual({
      username: 'ubuntu',
      uid: 1000,
      gid: 1000,
      gecos: 'Ubuntu',
      home: '/home/ubuntu',
      shell: '/bin/bash'
    })
  })
})

describe('parseGroup', () => {
  it('parses getent group lines with members', () => {
    const groups = parseGroup(GETENT_GROUP)
    expect(groups.find((group) => group.name === 'sudo')).toEqual({
      name: 'sudo',
      gid: 27,
      members: ['ubuntu']
    })
  })
})

describe('parseLastlog', () => {
  it('parses lastlog table output', () => {
    const map = parseLastlog(LASTLOG)
    expect(map.get('ubuntu')).toBe('Mon Aug 25 09:12:03 +0000 2026')
    expect(map.get('deploy')).toBe('Never')
  })
})

describe('parsePasswdStatus', () => {
  it('maps passwd -Sa flags to account status', () => {
    const map = parsePasswdStatus(PASSWD_STATUS)
    expect(map.get('root')).toBe('locked')
    expect(map.get('ubuntu')).toBe('password')
    expect(map.get('deploy')).toBe('no-password')
  })
})

describe('parseAdminGroups', () => {
  it('collects admin group membership', () => {
    const map = parseAdminGroups(ADMIN_GROUPS)
    expect([...map.get('sudo')!]).toEqual(['ubuntu'])
  })
})

describe('parseSshKeygenLine', () => {
  it('extracts type and fingerprint', () => {
    expect(
      parseSshKeygenLine('256 SHA256:AbCdEfGh user@host (ED25519)')
    ).toEqual({
      type: 'ED25519',
      fingerprint: 'SHA256:AbCdEfGh'
    })
  })
})

describe('parseSshSection', () => {
  it('builds ssh access per user', () => {
    const map = parseSshSection(SSH_SECTION)
    expect(map.get('ubuntu')).toEqual({
      authorizedKeysPath: '/home/ubuntu/.ssh/authorized_keys',
      keyCount: 2,
      fingerprints: [
        { type: 'ED25519', fingerprint: 'SHA256:AbCdEfGhIjKlMnOpQrStUvWxYz1234567890' },
        { type: 'RSA', fingerprint: 'SHA256:ZzYyXxWwVvUuTtSsRrQqPpOoNnMmLlKkJjIiHhGgFfEe' }
      ]
    })
    expect(map.get('deploy')?.keyCount).toBe(0)
  })
})

describe('splitDiscoverySections', () => {
  it('splits batched discovery output', () => {
    const sections = splitDiscoverySections(DISCOVERY_OUTPUT)
    expect(sections.connectedUsername).toBe('ubuntu')
    expect(sections.uidMin).toBe(1000)
    expect(sections.passwd).toHaveLength(5)
    expect(sections.sshAccess.get('ubuntu')?.keyCount).toBe(2)
  })
})

describe('buildUserSummaries', () => {
  it('classifies human and system users with protection', () => {
    const sections = splitDiscoverySections(DISCOVERY_OUTPUT)
    const users = buildUserSummaries(sections)
    const ubuntu = users.find((user) => user.username === 'ubuntu')
    const daemon = users.find((user) => user.username === 'daemon')
    const root = users.find((user) => user.username === 'root')

    expect(ubuntu?.kind).toBe('human')
    expect(ubuntu?.isAdmin).toBe(true)
    expect(ubuntu?.protected).toBe(true)
    expect(ubuntu?.protectedReason).toBe('currently connected SSH user')

    expect(daemon?.kind).toBe('system')
    expect(daemon?.protected).toBe(true)

    expect(root?.protectedReason).toBe('root account')
  })
})

describe('classifyUserKind', () => {
  it('treats nologin shells as system users', () => {
    expect(classifyUserKind(1000, '/usr/sbin/nologin', 1000)).toBe('system')
    expect(classifyUserKind(1000, '/bin/bash', 1000)).toBe('human')
    expect(classifyUserKind(999, '/bin/bash', 1000)).toBe('system')
  })
})

describe('protectedUserReason', () => {
  it('marks essential accounts as protected', () => {
    expect(protectedUserReason('sshd', 100, 1000, 'ubuntu')).toBe('system account')
    expect(protectedUserReason('systemd-network', 1001, 1000, 'ubuntu')).toBe(
      'essential system account'
    )
  })
})

describe('resolveAdminGroup', () => {
  it('prefers sudo on Debian-like systems', () => {
    const members = parseAdminGroups(ADMIN_GROUPS)
    expect(
      resolveAdminGroup({ id: 'ubuntu', idLike: ['debian'], prettyName: 'Ubuntu', versionId: '24.04' }, members)
    ).toBe('sudo')
  })
})

describe('groupsForUser', () => {
  it('returns group names for a user', () => {
    const groups = parseGroup(GETENT_GROUP)
    expect(groupsForUser('ubuntu', groups)).toEqual(['sudo', 'docker'])
  })
})

describe('buildDiscoveryCommand', () => {
  it('includes all relay markers', () => {
    const command = buildDiscoveryCommand()
    expect(command).toContain('---RELAY:PASSWD---')
    expect(command).toContain('getent passwd')
    expect(command).toContain('---RELAY:SSH---')
    expect(command).toContain('ssh-keygen -lf')
  })
})
