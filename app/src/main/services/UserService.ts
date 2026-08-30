import type { ServerId } from '@shared/server'
import type { UserAction, UserDetail, UserGroup, UsersListResponse } from '@shared/users'
import { CommandError, ConnectionError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { getLinuxOsContext } from './linuxOs'
import { privilegeService } from './PrivilegeService'
import {
  buildDiscoveryCommand,
  buildUserSummaries,
  groupsForUser,
  resolveAdminGroup,
  splitDiscoverySections
} from './usersParsers'

const AVAILABILITY_TTL_MS = 5000
const DISCOVERY_TIMEOUT_MS = 30_000
const ACTION_TIMEOUT_MS = 60_000

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function describePasswordSetupFailure(details: string): string {
  if (/pam_chauthtok|authentication token manipulation|password not changed/i.test(details)) {
    return 'The password was rejected by the server password policy. Try a stronger password.'
  }
  return details
}

export class UserService {
  private availabilityCache = new Map<ServerId, { available: boolean; checkedAt: number }>()
  private listCache = new Map<ServerId, { response: UsersListResponse; sections: ReturnType<typeof splitDiscoverySections>; expiresAt: number }>()

  private getConnection(serverId: ServerId) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  async isAvailable(serverId: ServerId): Promise<boolean> {
    const cached = this.availabilityCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < AVAILABILITY_TTL_MS) {
      return cached.available
    }

    let available = false
    try {
      const result = await this.getConnection(serverId).exec(
        'command -v getent >/dev/null 2>&1 && echo yes || echo no',
        10_000
      )
      available = result.stdout.trim() === 'yes'
    } catch {
      available = false
    }

    this.availabilityCache.set(serverId, { available, checkedAt: Date.now() })
    return available
  }

  private async ensureAvailable(serverId: ServerId): Promise<void> {
    if (await this.isAvailable(serverId)) return
    throw new CommandError(
      'User management is not available on this server',
      'getent was not found on this host.'
    )
  }

  private async discover(serverId: ServerId, force = false) {
    const cached = this.listCache.get(serverId)
    if (!force && cached && cached.expiresAt > Date.now()) {
      return cached
    }

    await this.ensureAvailable(serverId)
    const result = await this.getConnection(serverId).exec(buildDiscoveryCommand(), DISCOVERY_TIMEOUT_MS)
    if (result.exitCode !== 0 && !result.stdout.trim()) {
      throw new CommandError(
        'Failed to discover users',
        (result.stderr || result.stdout).trim()
      )
    }

    const sections = splitDiscoverySections(result.stdout)
    const os = await getLinuxOsContext(serverId)
    const adminGroup = resolveAdminGroup(os.os, sections.adminGroupMembers)
    const response: UsersListResponse = {
      users: buildUserSummaries(sections),
      connectedUsername: sections.connectedUsername,
      uidMin: sections.uidMin,
      adminGroup
    }

    const entry = {
      response,
      sections,
      expiresAt: Date.now() + 5000
    }
    this.listCache.set(serverId, entry)
    return entry
  }

  async list(serverId: ServerId): Promise<UsersListResponse> {
    return (await this.discover(serverId)).response
  }

  async get(serverId: ServerId, username: string): Promise<UserDetail> {
    const { response, sections } = await this.discover(serverId)
    const summary = response.users.find((user) => user.username === username)
    if (!summary) {
      throw new CommandError(`User ${username} was not found`, 'Refresh the user list and try again.')
    }

    const sshAccess =
      summary.kind === 'human' ? sections.sshAccess.get(username) ?? null : null

    return {
      ...summary,
      groups: groupsForUser(username, sections.groups),
      sshAccess,
      connectedUser: username === response.connectedUsername
    }
  }

  async groups(serverId: ServerId): Promise<UserGroup[]> {
    const { sections } = await this.discover(serverId)
    return sections.groups
  }

  private invalidate(serverId: ServerId): void {
    this.listCache.delete(serverId)
  }

  private async execPrivileged(serverId: ServerId, command: string): Promise<void> {
    const context = await privilegeService.getContext(serverId)
    const privileged = privilegeService.buildPrivileged(context, command)
    const result = await this.getConnection(serverId).exec(privileged, ACTION_TIMEOUT_MS)
    if (result.exitCode !== 0) {
      throw new CommandError('Remote command failed', (result.stderr || result.stdout).trim())
    }
  }

  private async findUser(serverId: ServerId, username: string) {
    const { response } = await this.discover(serverId)
    const user = response.users.find((entry) => entry.username === username)
    if (!user) {
      throw new CommandError(`User ${username} was not found`, 'Refresh the user list and try again.')
    }
    return { user, response }
  }

  private assertMutable(user: UserDetail | UsersListResponse['users'][number]): void {
    if (user.protected) {
      throw new ValidationError(
        `Cannot modify protected user: ${user.protectedReason ?? 'protected account'}`
      )
    }
  }

  async action(serverId: ServerId, action: UserAction): Promise<void> {
    switch (action.type) {
      case 'create':
        await this.createUser(serverId, action)
        break
      case 'delete':
        await this.deleteUser(serverId, action)
        break
      case 'lock':
      case 'unlock':
        await this.setLocked(serverId, action)
        break
      case 'changeShell':
        await this.changeShell(serverId, action)
        break
      case 'setPassword':
        await this.setPassword(serverId, action)
        break
      case 'addGroups':
      case 'removeGroups':
        await this.modifyGroups(serverId, action)
        break
      case 'grantSudo':
      case 'revokeSudo':
        await this.modifySudo(serverId, action)
        break
      case 'enableSsh':
        await this.enableSsh(serverId, action)
        break
      default:
        throw new ValidationError('Unsupported user action')
    }

    this.invalidate(serverId)
  }

  private async createUser(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'create' }>
  ): Promise<void> {
    const existing = (await this.discover(serverId)).response.users.find(
      (user) => user.username === action.username
    )
    if (existing) {
      throw new ValidationError(`User ${action.username} already exists`)
    }

    const args = ['useradd']
    if (action.home !== false) args.push('-m')
    args.push('-s', shellQuote(action.shell))
    if (action.gecos?.trim()) {
      args.push('-c', shellQuote(action.gecos.trim()))
    }
    const groups = [...(action.groups ?? [])]
    if (groups.length > 0) {
      args.push('-G', shellQuote(groups.join(',')))
    }
    args.push(shellQuote(action.username))

    await this.execPrivileged(serverId, args.join(' '))
    this.invalidate(serverId)

    const followUpIssues: string[] = []

    if (action.password) {
      try {
        await this.execPrivileged(
          serverId,
          `printf '%s\\n' ${shellQuote(`${action.username}:${action.password}`)} | chpasswd`
        )
      } catch (error) {
        const details =
          error instanceof CommandError
            ? error.details ?? error.message
            : 'Password could not be set.'
        followUpIssues.push(`password was not set (${describePasswordSetupFailure(details)})`)
      }
    }

    if (action.sudo) {
      try {
        const adminGroup = (await this.discover(serverId, true)).response.adminGroup ?? 'sudo'
        await this.execPrivileged(
          serverId,
          `usermod -aG ${shellQuote(adminGroup)} ${shellQuote(action.username)}`
        )
      } catch (error) {
        const details =
          error instanceof CommandError
            ? error.details ?? error.message
            : 'Sudo access could not be granted.'
        followUpIssues.push(`sudo access was not granted (${details})`)
      }
    }

    if (followUpIssues.length > 0) {
      throw new CommandError(
        `User ${action.username} was created, but ${followUpIssues.join('; ')}.`,
        followUpIssues.join('\n')
      )
    }
  }

  private async deleteUser(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'delete' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)

    const command = action.removeHome
      ? `userdel -r ${shellQuote(action.username)}`
      : `userdel ${shellQuote(action.username)}`
    await this.execPrivileged(serverId, command)
  }

  private async setLocked(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'lock' | 'unlock' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)

    const flag = action.type === 'lock' ? '-L' : '-U'
    await this.execPrivileged(
      serverId,
      `usermod ${flag} ${shellQuote(action.username)}`
    )
  }

  private async changeShell(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'changeShell' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)

    await this.execPrivileged(
      serverId,
      `usermod -s ${shellQuote(action.shell)} ${shellQuote(action.username)}`
    )
  }

  private async setPassword(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'setPassword' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)

    await this.execPrivileged(
      serverId,
      `printf '%s\\n' ${shellQuote(`${action.username}:${action.password}`)} | chpasswd`
    )
  }

  private async modifyGroups(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'addGroups' | 'removeGroups' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)

    if (action.type === 'addGroups') {
      if (action.groups.length === 0) return
      await this.execPrivileged(
        serverId,
        `usermod -aG ${shellQuote(action.groups.join(','))} ${shellQuote(action.username)}`
      )
      return
    }

    for (const group of action.groups) {
      await this.execPrivileged(
        serverId,
        `gpasswd -d ${shellQuote(action.username)} ${shellQuote(group)}`
      )
    }
  }

  private async modifySudo(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'grantSudo' | 'revokeSudo' }>
  ): Promise<void> {
    const { user, response } = await this.findUser(serverId, action.username)
    this.assertMutable(user)
    const adminGroup = response.adminGroup ?? 'sudo'

    if (action.type === 'grantSudo') {
      await this.execPrivileged(
        serverId,
        `usermod -aG ${shellQuote(adminGroup)} ${shellQuote(action.username)}`
      )
      return
    }

    await this.execPrivileged(
      serverId,
      `gpasswd -d ${shellQuote(action.username)} ${shellQuote(adminGroup)}`
    )
  }

  private async enableSsh(
    serverId: ServerId,
    action: Extract<UserAction, { type: 'enableSsh' }>
  ): Promise<void> {
    const { user } = await this.findUser(serverId, action.username)
    this.assertMutable(user)
    const home = shellQuote(user.home)
    const username = shellQuote(action.username)
    const sshDir = `${home}/.ssh`
    const keysPath = `${sshDir}/authorized_keys`

    const commands = [
      `install -d -m 700 -o ${username} -g ${username} ${sshDir}`,
      `install -m 600 -o ${username} -g ${username} /dev/null ${keysPath}`
    ]

    if (action.publicKey?.trim()) {
      const keyLine = action.publicKey.trim().replace(/\n/g, '')
      commands.push(
        `grep -qxF ${shellQuote(keyLine)} ${keysPath} 2>/dev/null || printf '%s\\n' ${shellQuote(keyLine)} >> ${keysPath}`
      )
    }

    await this.execPrivileged(serverId, commands.join(' && '))
  }

  clearServer(serverId: ServerId): void {
    this.availabilityCache.delete(serverId)
    this.listCache.delete(serverId)
  }
}

export const userService = new UserService()
