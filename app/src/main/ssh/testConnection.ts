import { Client } from 'ssh2'
import type { ConnectionTestRequest } from '@shared/ipc'
import type { ServerProfile } from '@shared/server'
import { AuthenticationError, ConnectionError } from '@shared/errors'
import { buildConnectConfig } from './auth'
import { createHostVerifier, type HostKeyPromptHandler } from './hostVerifier'

const TEST_CONNECT_TIMEOUT_MS = 20000

function profileFromTestRequest(request: ConnectionTestRequest): ServerProfile {
  return {
    id: request.serverId ?? 'test-connection',
    name: 'test',
    hostname: request.hostname,
    username: request.username,
    port: request.port ?? 22,
    auth: request.auth
  }
}

export async function runTestConnection(
  request: ConnectionTestRequest,
  promptHostKey: HostKeyPromptHandler
): Promise<void> {
  const profile = profileFromTestRequest(request)
  const connectConfig = await buildConnectConfig(profile, {
    passphrase: request.passphrase
  })

  const client = new Client()

  try {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.end()
        reject(new ConnectionError('Connection test timed out'))
      }, TEST_CONNECT_TIMEOUT_MS)

      client.once('ready', () => {
        clearTimeout(timeout)
        resolve()
      })
      client.once('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })

      client.connect({
        ...connectConfig,
        hostVerifier: createHostVerifier(
          profile.id,
          profile.hostname,
          profile.port,
          promptHostKey
        )
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection test failed'
    if (error instanceof AuthenticationError) {
      throw error
    }
    throw error instanceof ConnectionError ? error : new ConnectionError(message)
  } finally {
    client.end()
  }
}
