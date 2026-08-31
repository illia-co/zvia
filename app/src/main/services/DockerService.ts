import type { BrowserWindow } from 'electron'
import type { ClientChannel } from 'ssh2'
import type {
  DockerContainer,
  DockerImage,
  DockerNetwork,
  DockerVolume
} from '@shared/docker'
import type { DockerLogsDataEvent, DockerLogsExitEvent } from '@shared/ipc'
import { CommandError, ConnectionError, DockerUnavailableError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { execStreamOnClient } from '../ssh/exec'
import { topologyService } from './deployments'

interface DockerPsRow {
  ID: string
  Names: string
  Image: string
  Status: string
  State: string
  Ports: string
  RunningFor: string
}

interface DockerStatsRow {
  ID: string
  Name: string
  CPUPerc: string
  MemUsage: string
  MemPerc: string
}

interface DockerImageRow {
  ID: string
  Repository: string
  Tag: string
  Size: string
  CreatedAt: string
}

interface DockerVolumeRow {
  Name: string
  Driver: string
  Mountpoint: string
}

interface DockerNetworkRow {
  ID: string
  Name: string
  Driver: string
  Scope: string
  Containers: string
}

interface LogStream {
  serverId: string
  streamId: string
  channel: ClientChannel
}

function logStreamKey(serverId: string, streamId: string): string {
  return `${serverId}:${streamId}`
}

function parseJsonLines<T>(stdout: string): T[] {
  const rows: T[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed) as T)
    } catch {
      // Skip malformed lines from partial output.
    }
  }
  return rows
}

function normalizeContainerName(names: string): string {
  const first = names.split(',')[0]?.trim() ?? ''
  return first.replace(/^\//, '')
}

function assertDockerId(value: string, label: string): string {
  if (!/^[a-f0-9]{12,64}$/i.test(value)) {
    throw new CommandError(`Invalid ${label}`)
  }
  return value
}

function assertDockerName(value: string, label: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) {
    throw new CommandError(`Invalid ${label}`)
  }
  return value
}

export class DockerService {
  private mainWindow: BrowserWindow | null = null
  private logStreams = new Map<string, LogStream>()
  private availabilityCache = new Map<string, { available: boolean; checkedAt: number }>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private sendLogsData(event: DockerLogsDataEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('docker:logsData', event)
    }
  }

  private sendLogsExit(event: DockerLogsExitEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('docker:logsExit', event)
    }
  }

  private getConnection(serverId: string) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  private async runDocker(serverId: string, args: string, timeoutMs = 30000): Promise<string> {
    const connection = this.getConnection(serverId)
    const result = await connection.exec(`docker ${args}`, timeoutMs)
    if (result.exitCode !== 0) {
      const details = (result.stderr || result.stdout).trim()
      if (
        details.includes('Cannot connect to the Docker daemon') ||
        details.includes('permission denied') ||
        details.includes('command not found') ||
        details.includes('No such file or directory')
      ) {
        throw new DockerUnavailableError(
          'Docker is not installed or the current SSH user does not have permission to access Docker.',
          details
        )
      }
      throw new CommandError('Docker command failed', details)
    }
    return result.stdout
  }

  private async ensureAvailable(serverId: string): Promise<void> {
    const available = await this.isAvailable(serverId)
    if (!available) {
      throw new DockerUnavailableError(
        'Docker is not installed or the current SSH user does not have permission to access Docker.'
      )
    }
  }

  async isAvailable(serverId: string): Promise<boolean> {
    const cached = this.availabilityCache.get(serverId)
    if (cached && Date.now() - cached.checkedAt < 5000) {
      return cached.available
    }

    try {
      const connection = this.getConnection(serverId)
      const result = await connection.exec('docker info --format "{{json .}}" 2>/dev/null', 10000)
      const available = result.exitCode === 0 && result.stdout.trim().length > 0
      this.availabilityCache.set(serverId, { available, checkedAt: Date.now() })
      return available
    } catch {
      this.availabilityCache.set(serverId, { available: false, checkedAt: Date.now() })
      return false
    }
  }

  async listContainers(serverId: string, all = false): Promise<DockerContainer[]> {
    await this.ensureAvailable(serverId)
    const psFlag = all ? '-a' : ''
    const stdout = await this.runDocker(
      serverId,
      `ps ${psFlag} --format '{{json .}}'`.replace(/\s+/g, ' ').trim()
    )
    const containers = parseJsonLines<DockerPsRow>(stdout)

    let statsById = new Map<string, DockerStatsRow>()
    try {
      const statsStdout = await this.runDocker(
        serverId,
        "stats --no-stream --format '{{json .}}'"
      )
      statsById = new Map(
        parseJsonLines<DockerStatsRow>(statsStdout).map((row) => [row.ID, row])
      )
    } catch {
      // Stats are optional when no containers are running.
    }

    return containers.map((row) => {
      const stats = statsById.get(row.ID)
      return {
        id: row.ID,
        name: normalizeContainerName(row.Names),
        status: row.Status,
        state: row.State,
        image: row.Image,
        ports: row.Ports || '—',
        uptime: row.RunningFor || '—',
        cpuPercent: stats?.CPUPerc?.trim() || '—',
        memoryUsage: stats?.MemUsage?.trim() || '—',
        memoryPercent: stats?.MemPerc?.trim() || '—'
      }
    })
  }

  async listImages(serverId: string): Promise<DockerImage[]> {
    await this.ensureAvailable(serverId)
    const stdout = await this.runDocker(serverId, "images --format '{{json .}}'")
    return parseJsonLines<DockerImageRow>(stdout).map((row) => ({
      id: row.ID,
      repository: row.Repository,
      tag: row.Tag,
      size: row.Size,
      created: row.CreatedAt
    }))
  }

  async listVolumes(serverId: string): Promise<DockerVolume[]> {
    await this.ensureAvailable(serverId)
    const stdout = await this.runDocker(serverId, "volume ls --format '{{json .}}'")
    return parseJsonLines<DockerVolumeRow>(stdout).map((row) => ({
      name: row.Name,
      driver: row.Driver,
      mountpoint: row.Mountpoint
    }))
  }

  async listNetworks(serverId: string): Promise<DockerNetwork[]> {
    await this.ensureAvailable(serverId)
    const stdout = await this.runDocker(serverId, "network ls --format '{{json .}}'")
    return parseJsonLines<DockerNetworkRow>(stdout).map((row) => ({
      id: row.ID,
      name: row.Name,
      driver: row.Driver,
      scope: row.Scope,
      containers: row.Containers || '—'
    }))
  }

  async startContainer(serverId: string, containerId: string): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    await this.runDocker(serverId, `start ${id}`)
    this.availabilityCache.delete(serverId)
    topologyService.invalidate(serverId)
  }

  async stopContainer(serverId: string, containerId: string): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    await this.runDocker(serverId, `stop ${id}`)
    topologyService.invalidate(serverId)
  }

  async restartContainer(serverId: string, containerId: string): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    await this.runDocker(serverId, `restart ${id}`)
    topologyService.invalidate(serverId)
  }

  async removeContainer(serverId: string, containerId: string, force = false): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    const forceFlag = force ? ' -f' : ''
    await this.runDocker(serverId, `rm${forceFlag} ${id}`)
    topologyService.invalidate(serverId)
  }

  async inspectContainer(serverId: string, containerId: string): Promise<unknown> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    const stdout = await this.runDocker(serverId, `inspect ${id}`)
    const parsed = JSON.parse(stdout) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new CommandError('Container inspect returned no data')
    }
    return parsed[0]
  }

  async removeImage(serverId: string, imageId: string, force = false): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(imageId, 'imageId')
    const forceFlag = force ? ' -f' : ''
    await this.runDocker(serverId, `rmi${forceFlag} ${id}`)
  }

  async removeVolume(serverId: string, volumeName: string, force = false): Promise<void> {
    await this.ensureAvailable(serverId)
    const name = assertDockerName(volumeName, 'volumeName')
    const forceFlag = force ? ' -f' : ''
    await this.runDocker(serverId, `volume rm${forceFlag} ${name}`)
  }

  async startLogs(
    serverId: string,
    streamId: string,
    containerId: string,
    options?: { timestamps?: boolean; tail?: number }
  ): Promise<void> {
    await this.ensureAvailable(serverId)
    const id = assertDockerId(containerId, 'containerId')
    const key = logStreamKey(serverId, streamId)
    if (this.logStreams.has(key)) {
      throw new CommandError(`Log stream already exists: ${streamId}`)
    }

    const timestamps = options?.timestamps ? '--timestamps ' : ''
    const tail =
      options?.tail !== undefined && Number.isInteger(options.tail) && options.tail > 0
        ? `--tail ${options.tail} `
        : ''
    const command = `docker logs -f ${timestamps}${tail}${id}`

    const connection = this.getConnection(serverId)
    const client = await connection.getInteractiveClient()
    const channel = await execStreamOnClient(client, command)

    const stream: LogStream = { serverId, streamId, channel }
    this.logStreams.set(key, stream)

    channel.on('data', (data: Buffer) => {
      this.sendLogsData({
        serverId,
        streamId,
        data: data.toString('base64')
      })
    })

    channel.stderr.on('data', (data: Buffer) => {
      this.sendLogsData({
        serverId,
        streamId,
        data: data.toString('base64')
      })
    })

    channel.on('close', (code?: number) => {
      this.logStreams.delete(key)
      this.sendLogsExit({
        serverId,
        streamId,
        exitCode: code ?? 0
      })
    })
  }

  stopLogs(serverId: string, streamId: string): void {
    const key = logStreamKey(serverId, streamId)
    const stream = this.logStreams.get(key)
    if (!stream) return
    this.logStreams.delete(key)
    stream.channel.close()
  }

  stopAllLogsForServer(serverId: string): void {
    for (const [key, stream] of this.logStreams) {
      if (stream.serverId !== serverId) continue
      this.logStreams.delete(key)
      stream.channel.close()
    }
  }

  buildExecCommand(containerId: string): string {
    const id = assertDockerId(containerId, 'containerId')
    return `docker exec -it ${id} /bin/sh`
  }
}

export const dockerService = new DockerService()
