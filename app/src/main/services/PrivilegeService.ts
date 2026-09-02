import type { ServerId } from '@shared/server'
import { PrivilegeRequiredError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'

export interface PrivilegeContext {
  isRoot: boolean
  canSudoNonInteractive: boolean
}

export class PrivilegeService {
  private cache = new Map<ServerId, PrivilegeContext>()

  async getContext(serverId: ServerId): Promise<PrivilegeContext> {
    const cached = this.cache.get(serverId)
    if (cached) return cached

    const idResult = await connectionManager.exec(serverId, 'id -u')
    const isRoot = idResult.stdout.trim() === '0'

    let canSudoNonInteractive = isRoot
    if (!isRoot) {
      const sudoResult = await connectionManager.exec(serverId, 'sudo -n true')
      canSudoNonInteractive = sudoResult.exitCode === 0
    }

    const context: PrivilegeContext = { isRoot, canSudoNonInteractive }
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
