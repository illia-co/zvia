import type { ServerId } from '@shared/server'
import { connectionManager } from '../ssh/ConnectionManager'
import type { CommandRunner } from './CommandRunner'

export interface LinuxOsInfo {
  id: string
  idLike: string[]
  prettyName: string
  versionId: string
}

export interface LinuxOsContext {
  os: LinuxOsInfo
  uidMin: number
}

const CACHE_TTL_MS = 30_000
const DELIMITER = '---RELAY---'

interface CacheEntry {
  context: LinuxOsContext
  expiresAt: number
}

const cache = new Map<ServerId, CacheEntry>()

export function parseOsRelease(content: string): LinuxOsInfo {
  let id = ''
  const idLike: string[] = []
  let prettyName = ''
  let versionId = ''

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('ID=')) {
      id = trimmed.slice(3).replace(/^"|"$/g, '')
    }
    if (trimmed.startsWith('ID_LIKE=')) {
      idLike.push(
        ...trimmed
          .slice(8)
          .replace(/^"|"$/g, '')
          .split(/\s+/)
          .filter(Boolean)
      )
    }
    if (trimmed.startsWith('PRETTY_NAME=')) {
      prettyName = trimmed.slice('PRETTY_NAME='.length).replace(/^"|"$/g, '')
    }
    if (trimmed.startsWith('VERSION_ID=')) {
      versionId = trimmed.slice('VERSION_ID='.length).replace(/^"|"$/g, '')
    }
  }

  if (!prettyName) {
    prettyName = id || 'Linux'
  }

  return { id, idLike, prettyName, versionId }
}

export function parseUidMin(content: string): number {
  for (const line of content.split('\n')) {
    const match = line.match(/^UID_MIN\s+(\d+)/)
    if (match) {
      return Number.parseInt(match[1], 10)
    }
  }
  return 1000
}

function createRunner(serverId: ServerId): CommandRunner {
  return {
    exec(command, timeoutMs) {
      return connectionManager.exec(serverId, command, timeoutMs)
    }
  }
}

export async function getLinuxOsContext(serverId: ServerId): Promise<LinuxOsContext> {
  const cached = cache.get(serverId)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context
  }

  const runner = createRunner(serverId)
  const result = await runner.exec(
    [
      `cat /etc/os-release 2>/dev/null || true`,
      `echo '${DELIMITER}'`,
      `grep -E '^UID_MIN' /etc/login.defs 2>/dev/null || true`
    ].join('\n'),
    10_000
  )

  const [osRelease, loginDefs] = result.stdout.split(`\n${DELIMITER}\n`)
  const context: LinuxOsContext = {
    os: parseOsRelease(osRelease ?? ''),
    uidMin: parseUidMin(loginDefs ?? '')
  }

  cache.set(serverId, { context, expiresAt: Date.now() + CACHE_TTL_MS })
  return context
}

export function clearCache(serverId: ServerId): void {
  cache.delete(serverId)
}
