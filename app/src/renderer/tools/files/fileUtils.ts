import type { RemoteFileEntry } from '@shared/files'

export type SortField = 'name' | 'size' | 'modified' | 'permissions'
export type SortDirection = 'asc' | 'desc'

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[index]}`
}

export function formatSpeed(bytesPerSecond: number): string {
  return `${formatFileSize(bytesPerSecond)}/s`
}

export function formatModified(timestamp: number): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatRemaining(bytesRemaining: number, speedBps: number): string {
  if (speedBps <= 0) return '—'
  const seconds = bytesRemaining / speedBps
  if (seconds < 60) return `${Math.ceil(seconds)}s`
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`
  return `${Math.ceil(seconds / 3600)}h`
}

export function joinRemotePath(dir: string, name: string): string {
  if (dir === '/') return `/${name}`
  return `${dir.replace(/\/$/, '')}/${name}`
}

export function parentPath(path: string): string {
  if (path === '/') return '/'
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return parts.length === 0 ? '/' : `/${parts.join('/')}`
}

export interface RevealTarget {
  /** Directory to list. Always absolute. */
  directory: string
  /** Basename to open in the editor, or null when the path names a directory. */
  fileName: string | null
}

/**
 * Resolves a path handed over by another tool into somewhere the file manager
 * can go. A trailing slash means the caller pointed at a directory; anything
 * that is not an absolute path is refused rather than guessed at.
 */
export function resolveRevealTarget(path: string): RevealTarget | null {
  const trimmed = path.trim()
  if (!trimmed.startsWith('/')) return null

  const collapsed = trimmed.replace(/\/{2,}/g, '/')
  if (collapsed === '/' || collapsed.endsWith('/')) {
    return { directory: collapsed === '/' ? '/' : collapsed.replace(/\/$/, ''), fileName: null }
  }

  const fileName = collapsed.slice(collapsed.lastIndexOf('/') + 1)
  if (fileName === '.' || fileName === '..') return null

  return { directory: parentPath(collapsed), fileName }
}

export function breadcrumbSegments(path: string): { label: string; path: string }[] {
  if (path === '/') return [{ label: '/', path: '/' }]
  const parts = path.split('/').filter(Boolean)
  return parts.map((part, index) => ({
    label: part,
    path: `/${parts.slice(0, index + 1).join('/')}`
  }))
}

export function sortEntries(
  entries: RemoteFileEntry[],
  field: SortField,
  direction: SortDirection
): RemoteFileEntry[] {
  const sorted = [...entries].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1

    let comparison = 0
    switch (field) {
      case 'name':
        comparison = a.name.localeCompare(b.name)
        break
      case 'size':
        comparison = a.size - b.size
        break
      case 'modified':
        comparison = a.modified - b.modified
        break
      case 'permissions':
        comparison = a.permissions.localeCompare(b.permissions)
        break
    }
    return direction === 'asc' ? comparison : -comparison
  })
  return sorted
}

export function filterEntries(entries: RemoteFileEntry[], query: string): RemoteFileEntry[] {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return entries
  return entries.filter((entry) => entry.name.toLowerCase().includes(normalized))
}

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.xml',
  '.yml', '.yaml', '.env', '.sh', '.bash', '.py', '.rb', '.go', '.rs', '.toml',
  '.ini', '.conf', '.cfg', '.log', '.sql', '.graphql', '.vue', '.svelte'
])

export function isLikelyTextFile(name: string): boolean {
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  return TEXT_EXTENSIONS.has(name.slice(dot).toLowerCase())
}

export function isEditableFile(entry: RemoteFileEntry): boolean {
  return entry.type === 'file' && (isLikelyTextFile(entry.name) || entry.size < 512_000)
}
