import { CommandError } from '@shared/errors'
import { getServerConnection } from './ServiceBase'
import { execStreamOnClient } from '../ssh/exec'

export interface LogStreamEvent {
  serverId: string
  streamId: string
}

export interface LogStreamDataEvent extends LogStreamEvent {
  data: string
}

export interface LogStreamExitEvent extends LogStreamEvent {
  exitCode: number
}

export interface LogStreamCallbacks {
  onData(event: LogStreamDataEvent): void
  onExit(event: LogStreamExitEvent): void
}

interface ActiveStream extends LogStreamEvent {
  channel: { close(): void }
}

export function logStreamKey(serverId: string, streamId: string): string {
  return `${serverId}:${streamId}`
}

export class LogStreamRegistry {
  private streams = new Map<string, ActiveStream>()

  constructor(private readonly callbacks: LogStreamCallbacks) {}

  async start(serverId: string, streamId: string, command: string): Promise<void> {
    const key = logStreamKey(serverId, streamId)
    if (this.streams.has(key)) {
      throw new CommandError(`Log stream already exists: ${streamId}`)
    }

    const connection = getServerConnection(serverId)
    const client = await connection.getInteractiveClient()
    const channel = await execStreamOnClient(client, command)

    this.streams.set(key, { serverId, streamId, channel })

    let finished = false
    const finish = (exitCode: number): void => {
      if (finished) return
      finished = true
      this.streams.delete(key)
      this.callbacks.onExit({ serverId, streamId, exitCode })
    }

    channel.on('data', (data: Buffer) => {
      this.callbacks.onData({ serverId, streamId, data: data.toString('base64') })
    })

    channel.stderr.on('data', (data: Buffer) => {
      this.callbacks.onData({ serverId, streamId, data: data.toString('base64') })
    })

    channel.on('close', (code?: number) => {
      finish(code ?? 0)
    })

    channel.on('error', () => {
      finish(1)
    })
  }

  stop(serverId: string, streamId: string): void {
    const key = logStreamKey(serverId, streamId)
    const stream = this.streams.get(key)
    if (!stream) return
    this.streams.delete(key)
    stream.channel.close()
  }

  stopAllForServer(serverId: string): void {
    for (const [key, stream] of this.streams) {
      if (stream.serverId !== serverId) continue
      this.streams.delete(key)
      stream.channel.close()
    }
  }
}
