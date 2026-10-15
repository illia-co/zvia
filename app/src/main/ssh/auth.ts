import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ConnectConfig } from 'ssh2'
import type { ServerProfile } from '@shared/server'
import { AuthenticationError, PassphraseRequiredError } from '@shared/errors'
import { secretsStore } from '../store/secrets'

/**
 * Default identity files probed when `ssh-agent` has nothing to offer,
 * in OpenSSH order. Fixed allowlist — never derived from renderer input.
 */
const AGENT_FALLBACK_KEY_PATHS = [
  '~/.ssh/id_ed25519',
  '~/.ssh/id_ecdsa',
  '~/.ssh/id_rsa'
]

function expandPath(path: string): string {
  if (path.startsWith('~/')) {
    return join(homedir(), path.slice(2))
  }
  return path
}

export function isEncryptedPrivateKey(content: string): boolean {
  return /ENCRYPTED PRIVATE KEY/.test(content)
}

async function readFirstExistingKey(
  candidates: string[]
): Promise<{ displayPath: string; content: string } | null> {
  for (const displayPath of candidates) {
    const absolute = expandPath(displayPath)
    try {
      await access(absolute, constants.R_OK)
    } catch {
      continue
    }
    try {
      const content = await readFile(absolute, 'utf8')
      if (!content.includes('PRIVATE KEY')) continue
      return { displayPath, content }
    } catch {
      continue
    }
  }
  return null
}

function resolvePassphrase(
  explicit: string | undefined,
  stored: string | null,
  keyLabel: string,
  hostname: string
): string {
  if (explicit) return explicit
  if (stored) return stored
  throw new PassphraseRequiredError(keyLabel, hostname)
}

export async function buildConnectConfig(
  profile: ServerProfile,
  options?: { passphrase?: string }
): Promise<ConnectConfig> {
  const config: ConnectConfig = {
    host: profile.hostname,
    port: profile.port,
    username: profile.username,
    readyTimeout: 20000,
    keepaliveInterval: 15000,
    keepaliveCountMax: 3
  }

  if (profile.auth.type === 'ssh-agent') {
    const agent = process.env.SSH_AUTH_SOCK
    if (agent) {
      config.agent = agent
    }

    const fallback = await readFirstExistingKey(AGENT_FALLBACK_KEY_PATHS)
    if (!fallback) {
      if (config.agent) return config
      throw new AuthenticationError(
        'No SSH agent or default key found. Start the SSH agent or add a key to ~/.ssh.'
      )
    }

    if (isEncryptedPrivateKey(fallback.content) && !options?.passphrase) {
      if (config.agent) {
        // Agent may still hold the decrypted key; try it first without
        // prompting. A passphrase prompt happens only after the agent
        // attempt fails (see ServerConnection/testConnection retry).
        return config
      }
      throw new PassphraseRequiredError(fallback.displayPath, profile.hostname)
    }

    config.privateKey = fallback.content
    if (options?.passphrase) {
      config.passphrase = options.passphrase
    }
    return config
  }

  const keyPath = expandPath(profile.auth.privateKeyPath)
  let content: string
  try {
    content = await readFile(keyPath, 'utf8')
  } catch {
    throw new AuthenticationError(`Unable to read private key at ${profile.auth.privateKeyPath}`)
  }

  config.privateKey = content
  if (isEncryptedPrivateKey(content)) {
    const stored = profile.auth.hasPassphrase
      ? await secretsStore.getPassphrase(profile.id)
      : null
    config.passphrase = resolvePassphrase(
      options?.passphrase,
      stored,
      profile.auth.privateKeyPath,
      profile.hostname
    )
  } else if (options?.passphrase) {
    config.passphrase = options.passphrase
  }

  return config
}
