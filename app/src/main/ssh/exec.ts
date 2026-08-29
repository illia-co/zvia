import type { Client, ClientChannel } from 'ssh2'
import type { ExecResult } from '@shared/ipc'
import { CommandError } from '@shared/errors'

export function execStreamOnClient(client: Client, command: string): Promise<ClientChannel> {
  return new Promise((resolve, reject) => {
    client.exec(command, (error, stream) => {
      if (error) {
        reject(new CommandError('Failed to execute command', error.message))
        return
      }
      resolve(stream)
    })
  })
}

export function execOnClient(
  client: Client,
  command: string,
  timeoutMs = 30000
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new CommandError(`Command timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    client.exec(command, (error, stream) => {
      if (error) {
        clearTimeout(timer)
        if (!settled) {
          settled = true
          reject(new CommandError('Failed to execute command', error.message))
        }
        return
      }

      stream.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8')
      })

      stream.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      stream.on('close', (code: number | null) => {
        clearTimeout(timer)
        if (settled) return
        settled = true
        resolve({
          stdout,
          stderr,
          exitCode: code ?? 0
        })
      })
    })
  })
}
