/**
 * Remote absolute-path helpers shared between IPC validation and the Files UI.
 */

/** Type this phrase in the Files tool to confirm mutations under critical paths. */
export const CRITICAL_PATH_CONFIRMATION_PHRASE = 'DELETE'

/** True when `path` contains a `..` path segment (e.g. `/home/foo/../../etc`). */
export function remotePathHasParentSegment(path: string): boolean {
  return path.split('/').includes('..')
}

/** Collapse repeated slashes; does not resolve `.` or `..`. */
export function collapseAbsolutePath(path: string): string {
  if (path === '/') return '/'
  const collapsed = path.replace(/\/{2,}/g, '/')
  return collapsed.endsWith('/') && collapsed !== '/' ? collapsed.replace(/\/$/, '') : collapsed
}

export const CRITICAL_SYSTEM_PATH_PREFIXES = [
  '/boot',
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
  '/dev',
  '/proc',
  '/sys',
  '/root',
  '/var/lib'
] as const

function matchesCriticalPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** True when `path` resolves inside a known critical system location. */
export function isCriticalSystemPath(path: string): boolean {
  const normalized = collapseAbsolutePath(path.trim())
  if (normalized === '/') return true
  return CRITICAL_SYSTEM_PATH_PREFIXES.some((prefix) => matchesCriticalPrefix(normalized, prefix))
}

/**
 * Returns a user-facing warning when mutating `path` could severely damage the
 * remote system. Null when the path is outside known critical areas.
 */
export function getCriticalPathMutationWarning(path: string): string | null {
  const normalized = collapseAbsolutePath(path.trim())

  if (normalized === '/') {
    return 'This is the filesystem root. Changing it can destroy the entire operating system and make the server unbootable.'
  }

  for (const prefix of CRITICAL_SYSTEM_PATH_PREFIXES) {
    if (matchesCriticalPrefix(normalized, prefix)) {
      return `This path is inside ${prefix}, a critical system location. Changing it can break the operating system, services, or your ability to connect to this server.`
    }
  }

  return null
}

/** @deprecated Use {@link getCriticalPathMutationWarning}. */
export function getCriticalPathDeleteWarning(path: string): string | null {
  return getCriticalPathMutationWarning(path)
}

export function requiresCriticalPathConfirmation(paths: string[]): boolean {
  return paths.some(isCriticalSystemPath)
}
