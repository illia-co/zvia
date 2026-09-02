import type { ServerId } from '@shared/server'
import { commandRunnerFor } from '../ServiceBase'
import { detectPackageManager } from './detectPackageManager'
import type { PackageManager } from './PackageManager'

export async function getPackageManager(serverId: ServerId): Promise<PackageManager | null> {
  return detectPackageManager(serverId, commandRunnerFor(serverId))
}

export type { PackageManager } from './PackageManager'
