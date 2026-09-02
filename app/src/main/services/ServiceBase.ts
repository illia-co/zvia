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
