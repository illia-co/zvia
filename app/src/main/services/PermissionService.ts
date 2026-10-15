import type { ServerId } from '@shared/server'
import {
  PERMISSION_CAPABILITIES,
  parseSudoListGrants,
  sudoersEntryMatches,
  type PrivilegeProbeResult
} from '@shared/permissions'
import { connectionManager } from '../ssh/ConnectionManager'
import { profileStore } from '../store/profiles'
import { privilegeService } from './PrivilegeService'

/**
 * Probes effective NOPASSWD grants via a single `sudo -n -l` listing — no
 * side effects, unlike probing each command by execution. Dynamic
 * placeholders (`{configRoot}`, `{units}`) are treated as wildcards: a
 * capability counts as granted when every line matches some granted entry.
 */

function capabilityGranted(
  commands: string[],
  grants: string[],
  placeholdersAsWildcard: boolean
): boolean {
  return commands.every((command) => {
    const pattern = placeholdersAsWildcard
      ? command
          .replace('{configRoot}', '*')
          .replace('{units}', '*')
          .replace('{action}', '*')
      : command
    if (pattern.includes('{')) return false
    return grants.some(
      (granted) => granted === 'ALL' || sudoersEntryMatches(granted, pattern)
    )
  })
}

export class PermissionService {
  async probe(serverId: ServerId): Promise<PrivilegeProbeResult> {
    const profile = profileStore.get(serverId)
    const context = await privilegeService.getContext(serverId)
    const granted: Record<string, boolean> = {}

    if (context.isRoot) {
      for (const capability of PERMISSION_CAPABILITIES) {
        granted[capability.id] = true
      }
      return { username: profile.username, isRoot: true, sudoKind: 'root', granted, unrestricted: true }
    }

    const result = await connectionManager.exec(serverId, 'sudo -n -l 2>&1', 15000).catch(() => null)
    const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`
    if (!result || result.exitCode !== 0 || /a password is required/i.test(output)) {
      for (const capability of PERMISSION_CAPABILITIES) {
        granted[capability.id] = false
      }
      return { username: profile.username, isRoot: false, sudoKind: context.sudoKind, granted, unrestricted: false }
    }

    const grants = parseSudoListGrants(output)
    const allAllowed = grants.some((entry) => entry === 'ALL' || entry === '(ALL) ALL')
    for (const capability of PERMISSION_CAPABILITIES) {
      granted[capability.id] = allAllowed || capabilityGranted(capability.commands, grants, true)
    }
    return { username: profile.username, isRoot: false, sudoKind: context.sudoKind, granted, unrestricted: allAllowed }
  }
}

export const permissionService = new PermissionService()
