import type { BrowserWindow } from 'electron'
import type { ClientChannel } from 'ssh2'
import type { ServerId } from '@shared/server'
import type {
  InstalledPackage,
  PackageDetail,
  PackageOperation,
  PackageOperationStepId,
  PackageOverview,
  PackageSearchResult,
  PackageUpdate,
  PackageWorkflowStepState,
  PackagesAvailability,
  PaginatedResult
} from '@shared/packages'
import type {
  PackagesOperationDoneEvent,
  PackagesOperationOutputEvent,
  PackagesOperationStepEvent
} from '@shared/ipc'
import { CommandError, ConnectionError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { execStreamOnClient } from '../ssh/exec'
import { getLinuxOsContext } from './linuxOs'
import { privilegeService } from './PrivilegeService'
import { getPackageManager } from './packages'
import type { PackageManager } from './packages/PackageManager'
import { parseDpkgQueryLine } from './packagesParsers'

const UNSUPPORTED_MESSAGE = 'No supported package manager was detected.'

interface OperationStream {
  serverId: ServerId
  streamId: string
  channel: ClientChannel | null
  cancelled: boolean
}

function operationStreamKey(serverId: ServerId, streamId: string): string {
  return `${serverId}:${streamId}`
}

export class PackageService {
  private mainWindow: BrowserWindow | null = null
  private operationStreams = new Map<string, OperationStream>()
  private managerCache = new Map<ServerId, Promise<PackageManager | null>>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getConnection(serverId: ServerId) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  private sendOperationStep(event: PackagesOperationStepEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('packages:operationStep', event)
    }
  }

  private sendOperationOutput(event: PackagesOperationOutputEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('packages:operationOutput', event)
    }
  }

  private sendOperationDone(event: PackagesOperationDoneEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('packages:operationDone', event)
    }
  }

  private emitStep(
    serverId: ServerId,
    streamId: string,
    stepId: PackageOperationStepId,
    state: PackageWorkflowStepState,
    message?: string
  ): void {
    this.sendOperationStep({ serverId, streamId, stepId, state, message })
  }

  private emitOutput(serverId: ServerId, streamId: string, text: string): void {
    if (!text) return
    this.sendOperationOutput({
      serverId,
      streamId,
      data: Buffer.from(text).toString('base64')
    })
  }

  private async resolveManager(serverId: ServerId): Promise<PackageManager | null> {
    let pending = this.managerCache.get(serverId)
    if (!pending) {
      pending = getPackageManager(serverId)
      this.managerCache.set(serverId, pending)
    }
    return pending
  }

  async isAvailable(serverId: ServerId): Promise<PackagesAvailability> {
    const manager = await this.resolveManager(serverId)
    if (!manager) {
      return { available: false, reason: UNSUPPORTED_MESSAGE }
    }
    return { available: true }
  }

  async overview(serverId: ServerId): Promise<PackageOverview> {
    const manager = await this.requireManager(serverId)
    const { os } = await getLinuxOsContext(serverId)
    return manager.overview(os.prettyName)
  }

  async listInstalled(
    serverId: ServerId,
    query: string | undefined,
    offset: number,
    limit: number
  ): Promise<PaginatedResult<InstalledPackage>> {
    const manager = await this.requireManager(serverId)
    return manager.listInstalled({ query, offset, limit })
  }

  async search(serverId: ServerId, query: string): Promise<PackageSearchResult[]> {
    const manager = await this.requireManager(serverId)
    return manager.search(query)
  }

  async getInfo(serverId: ServerId, packageName: string): Promise<PackageDetail> {
    const manager = await this.requireManager(serverId)
    return manager.getInfo(packageName)
  }

  async listUpdates(serverId: ServerId): Promise<PackageUpdate[]> {
    const manager = await this.requireManager(serverId)
    return manager.listUpdates()
  }

  async startOperation(
    serverId: ServerId,
    streamId: string,
    operation: PackageOperation
  ): Promise<void> {
    const key = operationStreamKey(serverId, streamId)
    if (this.operationStreams.has(key)) {
      throw new CommandError(`Package operation already exists: ${streamId}`)
    }

    const stream: OperationStream = { serverId, streamId, channel: null, cancelled: false }
    this.operationStreams.set(key, stream)

    void this.runOperation(serverId, streamId, operation).finally(() => {
      this.operationStreams.delete(key)
    })
  }

  cancelOperation(serverId: ServerId, streamId: string): void {
    const key = operationStreamKey(serverId, streamId)
    const stream = this.operationStreams.get(key)
    if (!stream) return
    stream.cancelled = true
    stream.channel?.close()
  }

  clearServer(serverId: ServerId): void {
    this.managerCache.delete(serverId)
    for (const [key, stream] of this.operationStreams) {
      if (stream.serverId !== serverId) continue
      stream.cancelled = true
      stream.channel?.close()
      this.operationStreams.delete(key)
    }
  }

  private async requireManager(serverId: ServerId): Promise<PackageManager> {
    const manager = await this.resolveManager(serverId)
    if (!manager) {
      throw new CommandError(UNSUPPORTED_MESSAGE)
    }
    return manager
  }

  private isCancelled(serverId: ServerId, streamId: string): boolean {
    return this.operationStreams.get(operationStreamKey(serverId, streamId))?.cancelled === true
  }

  private abortIfCancelled(
    serverId: ServerId,
    streamId: string,
    stepId: PackageOperationStepId,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    output = ''
  ): boolean {
    if (!this.isCancelled(serverId, streamId)) return false
    fail(stepId, 'Operation cancelled', output)
    return true
  }

  private async runOperation(
    serverId: ServerId,
    streamId: string,
    operation: PackageOperation
  ): Promise<void> {
    let capturedOutput = ''

    const fail = (stepId: PackageOperationStepId, message: string, output = ''): void => {
      this.emitStep(serverId, streamId, stepId, 'failed', message)
      this.sendOperationDone({
        serverId,
        streamId,
        success: false,
        output: output || message
      })
    }

    const succeed = (output = ''): void => {
      this.sendOperationDone({
        serverId,
        streamId,
        success: true,
        output: output || undefined
      })
    }

    try {
      this.emitStep(serverId, streamId, 'detect-manager', 'running')
      const manager = await this.requireManager(serverId)
      if (this.abortIfCancelled(serverId, streamId, 'detect-manager', fail)) return
      this.emitStep(serverId, streamId, 'detect-manager', 'done', manager.label)

      switch (operation.kind) {
        case 'install':
          await this.runInstall(
            serverId,
            streamId,
            manager,
            operation.packageName,
            operation.version,
            fail,
            succeed
          )
          break
        case 'remove':
          await this.runRemove(serverId, streamId, manager, operation.packageName, fail, succeed)
          break
        case 'upgrade':
          await this.runUpgrade(serverId, streamId, manager, operation.packageName, fail, succeed)
          break
        case 'upgrade-all':
          await this.runUpgradeAll(serverId, streamId, manager, fail, succeed)
          break
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Package operation failed'
      fail('detect-manager', message, capturedOutput)
    } finally {
      this.managerCache.delete(serverId)
    }
  }

  private async runPrivilegedStream(
    serverId: ServerId,
    streamId: string,
    command: string
  ): Promise<{ exitCode: number; output: string }> {
    const connection = this.getConnection(serverId)
    const client = await connection.getInteractiveClient()
    const context = await privilegeService.getContext(serverId)
    const privileged = privilegeService.buildPrivileged(context, command)
    const channel = await execStreamOnClient(client, privileged)
    const stream = this.operationStreams.get(operationStreamKey(serverId, streamId))
    if (stream) stream.channel = channel

    return new Promise((resolve, reject) => {
      let output = ''
      channel.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        output += text
        this.emitOutput(serverId, streamId, text)
      })
      channel.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString('utf8')
        output += text
        this.emitOutput(serverId, streamId, text)
      })
      channel.on('close', (code: number | null) => {
        const active = this.operationStreams.get(operationStreamKey(serverId, streamId))
        if (active?.cancelled) {
          resolve({ exitCode: -1, output })
          return
        }
        resolve({ exitCode: code ?? 0, output })
      })
      channel.on('error', (error: Error) => {
        reject(new CommandError('Package command failed', error.message))
      })
    })
  }

  private async runInstall(
    serverId: ServerId,
    streamId: string,
    manager: PackageManager,
    packageName: string,
    version: string | undefined,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    succeed: (output?: string) => void
  ): Promise<void> {
    this.emitStep(serverId, streamId, 'resolve-dependencies', 'running')
    const simulate = await this.runPrivilegedStream(
      serverId,
      streamId,
      manager.buildSimulateInstallCommand(packageName, version)
    )
    if (this.isCancelled(serverId, streamId) || simulate.exitCode === -1) {
      fail('resolve-dependencies', 'Operation cancelled', simulate.output)
      return
    }
    if (simulate.exitCode !== 0) {
      fail('resolve-dependencies', 'Could not resolve package dependencies', simulate.output)
      return
    }
    this.emitStep(serverId, streamId, 'resolve-dependencies', 'done')

    this.emitStep(serverId, streamId, 'download', 'running')
    this.emitStep(serverId, streamId, 'install', 'running')
    const install = await this.runPrivilegedStream(
      serverId,
      streamId,
      manager.buildInstallCommand(packageName, version)
    )
    if (this.abortIfCancelled(serverId, streamId, 'install', fail, install.output)) return
    if (install.exitCode !== 0) {
      this.emitStep(serverId, streamId, 'download', 'failed')
      fail('install', `Failed to install ${packageName}`, install.output)
      return
    }
    this.emitStep(serverId, streamId, 'download', 'done')
    this.emitStep(serverId, streamId, 'install', 'done')

    await this.verifyPackage(serverId, streamId, manager, packageName, fail, succeed, install.output)
  }

  private async runRemove(
    serverId: ServerId,
    streamId: string,
    manager: PackageManager,
    packageName: string,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    succeed: (output?: string) => void
  ): Promise<void> {
    this.emitStep(serverId, streamId, 'remove', 'running')
    const remove = await this.runPrivilegedStream(
      serverId,
      streamId,
      manager.buildRemoveCommand(packageName)
    )
    if (this.abortIfCancelled(serverId, streamId, 'remove', fail, remove.output)) return
    if (remove.exitCode !== 0) {
      fail('remove', `Failed to remove ${packageName}`, remove.output)
      return
    }
    this.emitStep(serverId, streamId, 'remove', 'done')
    succeed(remove.output)
  }

  private async runUpgrade(
    serverId: ServerId,
    streamId: string,
    manager: PackageManager,
    packageName: string,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    succeed: (output?: string) => void
  ): Promise<void> {
    this.emitStep(serverId, streamId, 'upgrade', 'running')
    const upgrade = await this.runPrivilegedStream(
      serverId,
      streamId,
      manager.buildUpgradeCommand(packageName)
    )
    if (this.abortIfCancelled(serverId, streamId, 'upgrade', fail, upgrade.output)) return
    if (upgrade.exitCode !== 0) {
      fail('upgrade', `Failed to upgrade ${packageName}`, upgrade.output)
      return
    }
    this.emitStep(serverId, streamId, 'upgrade', 'done')
    await this.verifyPackage(serverId, streamId, manager, packageName, fail, succeed, upgrade.output)
  }

  private async runUpgradeAll(
    serverId: ServerId,
    streamId: string,
    manager: PackageManager,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    succeed: (output?: string) => void
  ): Promise<void> {
    this.emitStep(serverId, streamId, 'upgrade', 'running')
    const upgrade = await this.runPrivilegedStream(
      serverId,
      streamId,
      manager.buildUpgradeAllCommand()
    )
    if (this.abortIfCancelled(serverId, streamId, 'upgrade', fail, upgrade.output)) return
    if (upgrade.exitCode !== 0) {
      fail('upgrade', 'Failed to upgrade packages', upgrade.output)
      return
    }
    this.emitStep(serverId, streamId, 'upgrade', 'done')
    this.emitStep(serverId, streamId, 'verify', 'done', 'All packages upgraded')
    succeed(upgrade.output)
  }

  private async verifyPackage(
    serverId: ServerId,
    streamId: string,
    manager: PackageManager,
    packageName: string,
    fail: (stepId: PackageOperationStepId, message: string, output?: string) => void,
    succeed: (output?: string) => void,
    priorOutput = ''
  ): Promise<void> {
    this.emitStep(serverId, streamId, 'verify', 'running')
    const result = await this.getConnection(serverId).exec(
      manager.buildVerifyCommand(packageName),
      20_000
    )
    if (this.abortIfCancelled(serverId, streamId, 'verify', fail, priorOutput)) return

    const installed = parseDpkgQueryLine(result.stdout.trim())
    if (!installed) {
      fail('verify', `Package ${packageName} was not installed`, priorOutput)
      return
    }
    this.emitStep(serverId, streamId, 'verify', 'done', installed.version)
    succeed(priorOutput)
  }
}

export const packageService = new PackageService()
