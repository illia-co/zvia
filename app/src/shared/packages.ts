/**
 * Shared DTOs for the Packages tool. Kept free of Node/Electron imports.
 */

export type PackageManagerId = 'apt' | 'dnf' | 'yum' | 'pacman' | 'apk' | 'zypper'

export const PACKAGE_MANAGER_IDS = [
  'apt',
  'dnf',
  'yum',
  'pacman',
  'apk',
  'zypper'
] as const

export type PackageWorkflowStepState = 'pending' | 'running' | 'done' | 'failed'

export type PackageOperationStepId =
  | 'detect-manager'
  | 'resolve-dependencies'
  | 'download'
  | 'install'
  | 'remove'
  | 'upgrade'
  | 'configure'
  | 'verify'

export interface PackagesAvailability {
  available: boolean
  reason?: string
}

export interface PackageOverview {
  distro: string
  manager: PackageManagerId
  managerLabel: string
  installedCount: number
  updateCount: number
}

export interface InstalledPackage {
  name: string
  version: string
  architecture: string
  description: string
  status: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface PackageSearchResult {
  name: string
  description: string
}

export interface PackageDetail {
  name: string
  version: string | null
  candidateVersion: string | null
  availableVersions: string[]
  installedVersion: string | null
  architecture: string | null
  description: string
  homepage: string | null
  installed: boolean
  dependencies: string[]
  reverseDependencies: string[]
  installedFiles: string[]
}

export function normalizePackageDetail(detail: PackageDetail): PackageDetail {
  const availableVersions = detail.availableVersions ?? []
  const candidateVersion = detail.candidateVersion ?? detail.version ?? availableVersions[0] ?? null

  return {
    ...detail,
    version: detail.version ?? candidateVersion,
    candidateVersion,
    availableVersions,
    dependencies: detail.dependencies ?? [],
    reverseDependencies: detail.reverseDependencies ?? [],
    installedFiles: detail.installedFiles ?? []
  }
}

export interface PackageUpdate {
  name: string
  installedVersion: string
  candidateVersion: string
  architecture: string
}

export type PackageOperation =
  | { kind: 'install'; packageName: string; version?: string }
  | { kind: 'remove'; packageName: string }
  | { kind: 'upgrade'; packageName: string }
  | { kind: 'upgrade-all' }

const PACKAGE_OPERATION_KINDS = new Set<PackageOperation['kind']>([
  'install',
  'remove',
  'upgrade',
  'upgrade-all'
])

export function isPackageOperation(value: unknown): value is PackageOperation {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  if (typeof record.kind !== 'string' || !PACKAGE_OPERATION_KINDS.has(record.kind as PackageOperation['kind'])) {
    return false
  }
  if (record.kind === 'upgrade-all') return true
  if (record.kind === 'install') {
    if (typeof record.packageName !== 'string' || record.packageName.length === 0) return false
    if (record.version === undefined) return true
    return typeof record.version === 'string' && record.version.length > 0
  }
  return typeof record.packageName === 'string' && record.packageName.length > 0
}

export function isPackageManagerId(value: unknown): value is PackageManagerId {
  return typeof value === 'string' && (PACKAGE_MANAGER_IDS as readonly string[]).includes(value)
}

/**
 * Packages whose removal can break SSH access, privilege escalation, or core
 * system services. Matched case-insensitively on the package name.
 */
const CRITICAL_REMOVE_PACKAGES = new Set([
  'openssh-server',
  'openssh-sftp-server',
  'sudo',
  'systemd',
  'systemd-sysv',
  'systemd-timesyncd',
  'dbus',
  'dbus-user-session',
  'login',
  'passwd',
  'apt',
  'dpkg',
  'bash',
  'coreutils',
  'libc6',
  'init',
  'procps',
  'netbase'
])

/**
 * Returns a user-facing warning when removing this package could severely
 * damage the remote system or lock you out. Null for ordinary packages.
 */
export function getCriticalPackageRemoveWarning(packageName: string): string | null {
  const normalized = packageName.trim().toLowerCase()
  if (!CRITICAL_REMOVE_PACKAGES.has(normalized)) return null

  if (normalized.startsWith('openssh')) {
    return 'Removing OpenSSH can disconnect you from this server and prevent future SSH access until it is reinstalled from the console.'
  }
  if (normalized === 'sudo') {
    return 'Removing sudo removes your ability to run privileged commands non-interactively from Zvia tools that depend on elevation.'
  }
  if (normalized.startsWith('systemd') || normalized === 'dbus' || normalized === 'dbus-user-session') {
    return 'Removing core init or D-Bus packages can stop services, break boot, or destabilize the entire system.'
  }
  if (normalized === 'apt' || normalized === 'dpkg') {
    return 'Removing the package manager can make the server impossible to repair from Zvia or apt until restored from the console.'
  }
  if (normalized === 'libc6' || normalized === 'bash' || normalized === 'coreutils' || normalized === 'init') {
    return 'Removing this package can render the system unbootable or unusable.'
  }

  return 'Removing this package can break essential system services or your ability to administer this server.'
}
