import { Client } from 'ssh2'
import type { ConnectionTestRequest } from '@shared/ipc'
import type { PassphrasePrompt, ServerProfile } from '@shared/server'
import { AuthenticationError, ConnectionError, PassphraseRequiredError } from '@shared/errors'
import { buildConnectConfig } from './auth'
import { toConnectionOrAuthError } from './authErrors'
import { createHostVerifier, type HostKeyPromptHandler } from './hostVerifier'

const TEST_CONNECT_TIMEOUT_MS = 20000
const MAX_PASSPHRASE_ATTEMPTS = 2

export type PassphrasePromptHandler = (prompt: PassphrasePrompt) => Promise<string | null>

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

async function attemptTestConnect(
  connectConfig: Awaited<ReturnType<typeof buildConnectConfig>>,
  profile: ServerProfile,
  promptHostKey: HostKeyPromptHandler
): Promise<void> {
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
  } finally {
    client.end()
  }
}

export async function runTestConnection(
  request: ConnectionTestRequest,
  promptHostKey: HostKeyPromptHandler,
  promptPassphrase?: PassphrasePromptHandler
): Promise<void> {
  const profile = profileFromTestRequest(request)
  let explicitPassphrase: string | undefined = request.passphrase
  let passphraseAttempts = 0

  for (;;) {
    let connectConfig: Awaited<ReturnType<typeof buildConnectConfig>>
    try {
      connectConfig = await buildConnectConfig(
        profile,
        explicitPassphrase ? { passphrase: explicitPassphrase } : undefined
      )
    } catch (error) {
      if (!(error instanceof PassphraseRequiredError) || !promptPassphrase) throw error
      if (passphraseAttempts >= MAX_PASSPHRASE_ATTEMPTS) {
        throw new AuthenticationError(`Passphrase required for ${error.keyLabel}`)
      }
      passphraseAttempts += 1
      const supplied = await promptPassphrase({
        serverId: profile.id,
        hostname: profile.hostname,
        keyLabel: error.keyLabel
      })
      if (!supplied) throw new AuthenticationError(`Passphrase required for ${error.keyLabel}`)
      explicitPassphrase = supplied
      continue
    }

    try {
      await attemptTestConnect(connectConfig, profile, promptHostKey)
      return
    } catch (error) {
      throw toConnectionOrAuthError(error)
    }
  }
}
