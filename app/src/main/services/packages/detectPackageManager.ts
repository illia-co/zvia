import type { ServerId } from '@shared/server'
import type { CommandRunner } from '../CommandRunner'
import { getLinuxOsContext } from '../linuxOs'
import { AptManager } from './AptManager'
import type { PackageManager } from './PackageManager'

function isDebianFamily(id: string, idLike: string[]): boolean {
  return id === 'ubuntu' || id === 'debian' || idLike.includes('debian')
}

async function probeBinary(runner: CommandRunner, binary: string): Promise<boolean> {
  const result = await runner.exec(`command -v ${binary} >/dev/null 2>&1 && echo yes || echo no`, 5000)
  return result.stdout.trim() === 'yes'
}

export async function detectPackageManager(
  serverId: ServerId,
  runner: CommandRunner
): Promise<PackageManager | null> {
  const { os } = await getLinuxOsContext(serverId)

  if (isDebianFamily(os.id, os.idLike)) {
    const apt = new AptManager(runner)
    if (await apt.detect()) return apt
  }

  const otherManagers = ['dnf', 'yum', 'pacman', 'apk', 'zypper'] as const
  for (const binary of otherManagers) {
    if (await probeBinary(runner, binary)) {
      return null
    }
  }

  return null
}
