import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ConnectConfig } from 'ssh2'
import type { ServerProfile } from '@shared/server'
import { AuthenticationError } from '@shared/errors'
import { secretsStore } from '../store/secrets'

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

export async function buildConnectConfig(profile: ServerProfile): Promise<ConnectConfig> {
  const config: ConnectConfig = {
    host: profile.hostname,
    port: profile.port,
    username: profile.username,
    readyTimeout: 20000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 3
  }

  if (profile.auth.type === 'ssh-agent') {
    config.agent = process.env.SSH_AUTH_SOCK
    if (!config.agent) {
      throw new AuthenticationError('SSH agent is not available (SSH_AUTH_SOCK is unset)')
    }
    return config
  }

  const keyPath = expandPath(profile.auth.privateKeyPath)
  try {
    config.privateKey = await readFile(keyPath, 'utf8')
  } catch {
    throw new AuthenticationError(`Unable to read private key at ${profile.auth.privateKeyPath}`)
  }

  if (profile.auth.hasPassphrase) {
    const passphrase = await secretsStore.getPassphrase(profile.id)
    if (!passphrase) {
      throw new AuthenticationError('Passphrase is required but not stored for this profile')
    }
    config.passphrase = passphrase
  }

  return config
}
