import type { ServerId } from '@shared/server'
import { connectionManager } from '../../ssh/ConnectionManager'
import type { CommandRunner } from '../CommandRunner'
import { detectPackageManager } from './detectPackageManager'
import type { PackageManager } from './PackageManager'

function createRunner(serverId: ServerId): CommandRunner {
  return {
    exec(command, timeoutMs) {
      return connectionManager.exec(serverId, command, timeoutMs)
    }
  }
}

export async function getPackageManager(serverId: ServerId): Promise<PackageManager | null> {
  return detectPackageManager(serverId, createRunner(serverId))
}

export type { PackageManager } from './PackageManager'
