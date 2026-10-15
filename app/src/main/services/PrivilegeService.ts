import type { ServerId } from '@shared/server'
import type { SudoKind } from '@shared/permissions'
import { PrivilegeRequiredError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'

export type { SudoKind }

export interface PrivilegeContext {
  isRoot: boolean
  canSudoNonInteractive: boolean
  /**
   * `password` means the user is in sudoers but must type a password
   * (`sudo -n` can never succeed). The app never prompts for that password —
   * see the NOPASSWD guidance in the topology/SSL warnings.
   */
  sudoKind: SudoKind
}

export class PrivilegeService {
  private cache = new Map<ServerId, PrivilegeContext>()

  async getContext(serverId: ServerId): Promise<PrivilegeContext> {
    const cached = this.cache.get(serverId)
    if (cached) return cached

    const idResult = await connectionManager.exec(serverId, 'id -u')
    const isRoot = idResult.stdout.trim() === '0'

    let canSudoNonInteractive = isRoot
    let sudoKind: SudoKind = isRoot ? 'root' : 'none'
    if (!isRoot) {
      const sudoResult = await connectionManager.exec(serverId, 'sudo -n true 2>&1')
      canSudoNonInteractive = sudoResult.exitCode === 0
      const output = `${sudoResult.stdout} ${sudoResult.stderr}`.toLowerCase()
      if (sudoResult.exitCode === 0) {
        sudoKind = 'nopasswd'
      } else if (/a password is required/.test(output)) {
        sudoKind = 'password'
      } else {
        sudoKind = 'none'
      }
    }

    const context: PrivilegeContext = { isRoot, canSudoNonInteractive, sudoKind }
    this.cache.set(serverId, context)
    return context
  }

  buildPrivileged(ctx: PrivilegeContext, command: string): string {
    if (ctx.isRoot) return command
    if (ctx.canSudoNonInteractive) return `sudo -n ${command}`
    throw new PrivilegeRequiredError('Elevated privileges required', command)
  }

  clearCache(serverId: ServerId): void {
    this.cache.delete(serverId)
  }
}

export const privilegeService = new PrivilegeService()
connectionManager.registerTeardown((serverId) => privilegeService.clearCache(serverId))
