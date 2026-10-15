import { ConnectionError } from '@shared/errors'
import type { ServerConnection } from '../ssh/ServerConnection'
import { connectionManager } from '../ssh/ConnectionManager'
import type { CommandRunner } from './CommandRunner'

export function getServerConnection(serverId: string): ServerConnection {
  const connection = connectionManager.getConnection(serverId)
  if (!connection) {
    throw new ConnectionError('Server is not connected')
  }
  return connection
}

export function commandRunnerFor(serverId: string): CommandRunner {
  return {
    exec: (command, timeoutMs) => connectionManager.exec(serverId, command, timeoutMs)
  }
}

export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

/**
 * Resolves a server binary without assuming PATH. Non-interactive SSH
 * sessions often lack sbin dirs, so absolute fallbacks are probed when
 * `command -v` finds nothing. Returns the usable path or null.
 */
export async function resolveBinary(
  serverId: string,
  name: string,
  fallbacks: string[]
): Promise<string | null> {
  const candidates = [name, ...fallbacks].map((candidate) => shellQuote(candidate)).join(' ')
  const result = await connectionManager
    .exec(
      serverId,
      `for p in ${candidates}; do if command -v "$p" >/dev/null 2>&1; then command -v "$p"; break; elif [ -x "$p" ]; then echo "$p"; break; fi; done`,
      10000
    )
    .catch(() => null)
  const found = result?.stdout
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0)
  return found ?? null
}

export const NGINX_BINARY_FALLBACKS = ['/usr/sbin/nginx', '/usr/local/sbin/nginx']

export const CERTBOT_BINARY_FALLBACKS = [
  '/usr/bin/certbot',
  '/snap/bin/certbot',
  '/usr/local/bin/certbot'
]
