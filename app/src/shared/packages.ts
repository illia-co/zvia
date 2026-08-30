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
