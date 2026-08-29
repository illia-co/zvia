import type { LinuxOsInfo } from './linuxOs'
import type {
  AccountStatus,
  SshKeyFingerprint,
  UserGroup,
  UserKind,
  UserSshAccess,
  UserSummary
} from '@shared/users'
import { parseUidMin } from './linuxOs'

export const SECTION_PASSWD = '---RELAY:PASSWD---'
export const SECTION_GROUP = '---RELAY:GROUP---'
export const SECTION_WHOAMI = '---RELAY:WHOAMI---'
export const SECTION_UID_MIN = '---RELAY:UID_MIN---'
export const SECTION_LASTLOG = '---RELAY:LASTLOG---'
export const SECTION_PASSWD_STATUS = '---RELAY:PASSWD_STATUS---'
export const SECTION_ADMIN_GROUPS = '---RELAY:ADMIN_GROUPS---'
export const SECTION_SSH = '---RELAY:SSH---'

const NOLOGIN_SHELLS = new Set([
  '/usr/sbin/nologin',
  '/bin/false',
  '/sbin/nologin',
  '/bin/sync',
  '/usr/bin/false'
])

const ESSENTIAL_SYSTEM_USERS = new Set([
  'root',
  'daemon',
  'bin',
  'sys',
  'sshd',
  'www-data',
  'nobody',
  'sync',
  'mail',
  'uucp'
])

export interface PasswdEntry {
  username: string
  uid: number
  gid: number
  gecos: string
  home: string
  shell: string
}

export interface DiscoverySections {
  passwd: PasswdEntry[]
  groups: UserGroup[]
  connectedUsername: string
  uidMin: number
  lastLogin: Map<string, string>
  accountStatus: Map<string, AccountStatus>
  adminGroupMembers: Map<string, Set<string>>
  sshAccess: Map<string, UserSshAccess>
}

export function buildDiscoveryCommand(): string {
  return [
    `echo '${SECTION_PASSWD}'`,
    'getent passwd 2>/dev/null',
    `echo '${SECTION_GROUP}'`,
    'getent group 2>/dev/null',
    `echo '${SECTION_WHOAMI}'`,
    'id -un 2>/dev/null',
    `echo '${SECTION_UID_MIN}'`,
    "grep -E '^UID_MIN' /etc/login.defs 2>/dev/null || true",
    `echo '${SECTION_LASTLOG}'`,
    '(command -v lastlog >/dev/null 2>&1 && lastlog 2>/dev/null) || (last -F -w 2>/dev/null | tail -n +2) || true',
    `echo '${SECTION_PASSWD_STATUS}'`,
    'passwd -Sa 2>/dev/null || true',
    `echo '${SECTION_ADMIN_GROUPS}'`,
    'for g in sudo admin wheel; do getent group "$g" 2>/dev/null || true; done',
    `echo '${SECTION_SSH}'`,
    [
      'UID_MIN=$(grep -E \'^UID_MIN\' /etc/login.defs 2>/dev/null | awk \'{print $2}\')',
      'UID_MIN=${UID_MIN:-1000}',
      'while IFS=: read -r user _ uid _ _ home shell; do',
      '  [ -n "$uid" ] || continue',
      '  [ "$uid" -ge "$UID_MIN" ] 2>/dev/null || continue',
      '  case "$shell" in */nologin|/bin/false|/sbin/nologin|/usr/bin/false) continue ;; esac',
      '  [ -n "$home" ] && [ "$home" != "/" ] || continue',
      '  keys="$home/.ssh/authorized_keys"',
      '  if [ -r "$keys" ]; then',
      '    count=$(grep -cve \'^\\s*$\' -e \'^\\s*#\' "$keys" 2>/dev/null || echo 0)',
      '    echo "KEYS:$user:$keys:$count"',
      '    ssh-keygen -lf "$keys" 2>/dev/null | while read -r line; do',
      '      [ -n "$line" ] && echo "FPRAW:$user:$line"',
      '    done',
      '  else',
      '    echo "KEYS:$user:$keys:0"',
      '  fi',
      'done < <(getent passwd 2>/dev/null)'
    ].join('\n')
  ].join('\n')
}

export function parsePasswd(content: string): PasswdEntry[] {
  const entries: PasswdEntry[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(':')
    if (parts.length < 7) continue
    const uid = Number.parseInt(parts[2], 10)
    const gid = Number.parseInt(parts[3], 10)
    if (!Number.isFinite(uid) || !Number.isFinite(gid)) continue
    entries.push({
      username: parts[0],
      uid,
      gid,
      gecos: parts[4],
      home: parts[5],
      shell: parts[6]
    })
  }
  return entries
}

export function parseGroup(content: string): UserGroup[] {
  const groups: UserGroup[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(':')
    if (parts.length < 4) continue
    const gid = Number.parseInt(parts[2], 10)
    if (!Number.isFinite(gid)) continue
    const members = parts[3]
      ? parts[3]
          .split(',')
          .map((member) => member.trim())
          .filter(Boolean)
      : []
    groups.push({ name: parts[0], gid, members })
  }
  return groups
}

export function parseLastlog(content: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = content.split('\n').filter((line) => line.trim())

  if (lines.some((line) => /\bPort\b/.test(line) && /\bLatest\b/.test(line))) {
    for (const line of lines.slice(1)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('Username')) continue
      const username = trimmed.split(/\s+/)[0]
      const latestMatch = trimmed.match(
        /\*\*Never logged in\*\*|(?:\w{3}\s+\w{3}\s+\d{1,2}\s+[\d:]+\s*(?:[+-]\d{4})?\s*\d{4})/
      )
      if (username && latestMatch) {
        map.set(username, latestMatch[0] === '**Never logged in**' ? 'Never' : latestMatch[0])
      }
    }
    return map
  }

  for (const line of lines) {
    const trimmed = line.replace(/\r$/, '').trim()
    if (!trimmed) continue
    const match = trimmed.match(/^(\S+)\s+\S+\s+\S+\s+(.+)$/)
    if (!match) continue
    const [, username, timestamp] = match
    if (username && timestamp) {
      map.set(username, timestamp.trim())
    }
  }

  return map
}

export function parsePasswdStatus(content: string): Map<string, AccountStatus> {
  const map = new Map<string, AccountStatus>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 2) continue
    const username = parts[0]
    const flag = parts[1]
    let status: AccountStatus = 'unknown'
    if (flag === 'L') status = 'locked'
    else if (flag === 'P') status = 'password'
    else if (flag === 'NP') status = 'no-password'
    map.set(username, status)
  }
  return map
}

export function parseAdminGroups(content: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parts = trimmed.split(':')
    if (parts.length < 4) continue
    const groupName = parts[0]
    const members = parts[3]
      ? parts[3]
          .split(',')
          .map((member) => member.trim())
          .filter(Boolean)
      : []
    map.set(groupName, new Set(members))
  }
  return map
}

export function parseSshKeygenLine(line: string): SshKeyFingerprint | null {
  const trimmed = line.trim()
  if (!trimmed) return null
  const typeMatch = trimmed.match(/\(([^)]+)\)\s*$/)
  const type = typeMatch?.[1] ?? 'unknown'
  const withoutType = typeMatch ? trimmed.slice(0, typeMatch.index).trim() : trimmed
  const parts = withoutType.split(/\s+/)
  if (parts.length < 2) return null
  return { type, fingerprint: parts[1] }
}

export function parseSshSection(content: string): Map<string, UserSshAccess> {
  const map = new Map<string, UserSshAccess>()
  const fingerprints = new Map<string, SshKeyFingerprint[]>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed.startsWith('KEYS:')) {
      const [, username, path, countText] = trimmed.split(':')
      if (!username || !path) continue
      const keyCount = Number.parseInt(countText ?? '0', 10)
      map.set(username, {
        authorizedKeysPath: path,
        keyCount: Number.isFinite(keyCount) ? keyCount : 0,
        fingerprints: []
      })
      continue
    }
    if (trimmed.startsWith('FPRAW:')) {
      const payload = trimmed.slice('FPRAW:'.length)
      const colon = payload.indexOf(':')
      if (colon === -1) continue
      const username = payload.slice(0, colon)
      const line = payload.slice(colon + 1)
      const parsed = parseSshKeygenLine(line)
      if (!parsed) continue
      const existing = fingerprints.get(username) ?? []
      existing.push(parsed)
      fingerprints.set(username, existing)
    }
  }

  for (const [username, access] of map) {
    access.fingerprints = fingerprints.get(username) ?? []
  }

  return map
}

type SectionKey =
  | 'passwd'
  | 'group'
  | 'whoami'
  | 'uidMin'
  | 'lastlog'
  | 'passwdStatus'
  | 'adminGroups'
  | 'ssh'

export function splitDiscoverySections(stdout: string): DiscoverySections {
  const buffers = new Map<SectionKey, string[]>()
  let current: SectionKey | null = null

  const push = (line: string): void => {
    if (!current) return
    const existing = buffers.get(current)
    if (existing) {
      existing.push(line)
      return
    }
    buffers.set(current, [line])
  }

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '')
    const marker = line.trim()

    if (marker === SECTION_PASSWD) {
      current = 'passwd'
      continue
    }
    if (marker === SECTION_GROUP) {
      current = 'group'
      continue
    }
    if (marker === SECTION_WHOAMI) {
      current = 'whoami'
      continue
    }
    if (marker === SECTION_UID_MIN) {
      current = 'uidMin'
      continue
    }
    if (marker === SECTION_LASTLOG) {
      current = 'lastlog'
      continue
    }
    if (marker === SECTION_PASSWD_STATUS) {
      current = 'passwdStatus'
      continue
    }
    if (marker === SECTION_ADMIN_GROUPS) {
      current = 'adminGroups'
      continue
    }
    if (marker === SECTION_SSH) {
      current = 'ssh'
      continue
    }

    push(line)
  }

  const join = (key: SectionKey): string => (buffers.get(key) ?? []).join('\n')

  let connectedUsername = ''
  for (const line of buffers.get('whoami') ?? []) {
    const trimmed = line.trim()
    if (trimmed) {
      connectedUsername = trimmed
      break
    }
  }

  return {
    passwd: parsePasswd(join('passwd')),
    groups: parseGroup(join('group')),
    connectedUsername,
    uidMin: parseUidMin(join('uidMin')),
    lastLogin: parseLastlog(join('lastlog')),
    accountStatus: parsePasswdStatus(join('passwdStatus')),
    adminGroupMembers: parseAdminGroups(join('adminGroups')),
    sshAccess: parseSshSection(join('ssh'))
  }
}

export function classifyUserKind(uid: number, shell: string, uidMin: number): UserKind {
  if (uid < uidMin || NOLOGIN_SHELLS.has(shell)) return 'system'
  return 'human'
}

export function resolveAdminGroup(
  os: LinuxOsInfo,
  adminGroupMembers: Map<string, Set<string>>
): string | null {
  const candidates =
    os.id === 'debian' || os.id === 'ubuntu' || os.idLike.includes('debian')
      ? ['sudo', 'admin']
      : os.idLike.includes('rhel') || os.idLike.includes('fedora')
        ? ['wheel', 'sudo']
        : ['sudo', 'admin', 'wheel']

  for (const candidate of candidates) {
    if (adminGroupMembers.has(candidate)) return candidate
  }

  for (const candidate of ['sudo', 'admin', 'wheel']) {
    if (adminGroupMembers.has(candidate)) return candidate
  }

  return null
}

export function isAdminUser(
  username: string,
  adminGroupMembers: Map<string, Set<string>>
): boolean {
  for (const members of adminGroupMembers.values()) {
    if (members.has(username)) return true
  }
  return false
}

export function protectedUserReason(
  username: string,
  uid: number,
  uidMin: number,
  connectedUsername: string
): string | null {
  if (username === 'root' || uid === 0) return 'root account'
  if (username === connectedUsername) return 'currently connected SSH user'
  if (uid < uidMin) return 'system account'
  if (ESSENTIAL_SYSTEM_USERS.has(username)) return 'essential system account'
  if (username.startsWith('systemd-')) return 'essential system account'
  return null
}

export function buildUserSummaries(sections: DiscoverySections): UserSummary[] {
  return sections.passwd.map((entry) => {
    const kind = classifyUserKind(entry.uid, entry.shell, sections.uidMin)
    const protectedReason = protectedUserReason(
      entry.username,
      entry.uid,
      sections.uidMin,
      sections.connectedUsername
    )

    return {
      username: entry.username,
      uid: entry.uid,
      gid: entry.gid,
      gecos: entry.gecos,
      home: entry.home,
      shell: entry.shell,
      kind,
      isAdmin: isAdminUser(entry.username, sections.adminGroupMembers),
      accountStatus: sections.accountStatus.get(entry.username) ?? 'unknown',
      lastLogin: sections.lastLogin.get(entry.username) ?? null,
      protected: protectedReason !== null,
      protectedReason: protectedReason ?? undefined
    }
  })
}

export function groupsForUser(username: string, groups: UserGroup[]): string[] {
  return groups.filter((group) => group.members.includes(username)).map((group) => group.name)
}
