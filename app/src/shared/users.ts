/**
 * Shared DTOs for the Users tool. Kept free of Node/Electron imports.
 */

export type UserKind = 'human' | 'system'

export type AccountStatus = 'locked' | 'password' | 'no-password' | 'unknown'

export interface SshKeyFingerprint {
  type: string
  fingerprint: string
}

export interface UserSshAccess {
  authorizedKeysPath: string
  keyCount: number
  fingerprints: SshKeyFingerprint[]
}

export interface UserSummary {
  username: string
  uid: number
  gid: number
  gecos: string
  home: string
  shell: string
  kind: UserKind
  isAdmin: boolean
  accountStatus: AccountStatus
  lastLogin: string | null
  protected: boolean
  protectedReason?: string
}

export interface UserDetail extends UserSummary {
  groups: string[]
  sshAccess: UserSshAccess | null
  connectedUser: boolean
}

export interface UserGroup {
  name: string
  gid: number
  members: string[]
}

export interface UsersListResponse {
  users: UserSummary[]
  connectedUsername: string
  uidMin: number
  adminGroup: string | null
}

export type UserAction =
  | {
      type: 'create'
      username: string
      home?: boolean
      shell: string
      gecos?: string
      groups?: string[]
      password?: string
      sudo?: boolean
    }
  | { type: 'delete'; username: string; removeHome: boolean }
  | { type: 'lock'; username: string }
  | { type: 'unlock'; username: string }
  | { type: 'changeShell'; username: string; shell: string }
  | { type: 'setPassword'; username: string; password: string }
  | { type: 'addGroups'; username: string; groups: string[] }
  | { type: 'removeGroups'; username: string; groups: string[] }
  | { type: 'grantSudo'; username: string }
  | { type: 'revokeSudo'; username: string }
  | { type: 'enableSsh'; username: string; publicKey?: string }

const USER_ACTION_TYPES = new Set<UserAction['type']>([
  'create',
  'delete',
  'lock',
  'unlock',
  'changeShell',
  'setPassword',
  'addGroups',
  'removeGroups',
  'grantSudo',
  'revokeSudo',
  'enableSsh'
])

export function isUserAction(value: unknown): value is UserAction {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.type !== 'string' || !USER_ACTION_TYPES.has(record.type as UserAction['type'])) {
    return false
  }
  if (typeof record.username !== 'string') return false

  switch (record.type) {
    case 'create':
      return typeof record.shell === 'string'
    case 'delete':
      return typeof record.removeHome === 'boolean'
    case 'changeShell':
      return typeof record.shell === 'string'
    case 'setPassword':
      return typeof record.password === 'string'
    case 'addGroups':
    case 'removeGroups':
      return Array.isArray(record.groups) && record.groups.every((g) => typeof g === 'string')
    case 'enableSsh':
      return record.publicKey === undefined || typeof record.publicKey === 'string'
    default:
      return true
  }
}
