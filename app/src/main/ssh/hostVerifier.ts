import type { HostVerifier } from 'ssh2'
import type { HostKeyPrompt } from '@shared/server'
import { fingerprintFromKey, hostKeyStore } from './hostKeys'

export interface HostKeyPromptHandler {
  (prompt: HostKeyPrompt): Promise<boolean>
}

export function createHostVerifier(
  serverId: string,
  hostname: string,
  port: number,
  promptHostKey: HostKeyPromptHandler
): HostVerifier {
  return (key: Buffer, callback) => {
    void (async () => {
      try {
        const { fingerprint, keyType } = fingerprintFromKey(key)
        const stored = hostKeyStore.getSync(hostname, port)

        if (stored && stored.fingerprint === fingerprint) {
          callback(true)
          return
        }

        const prompt: HostKeyPrompt = {
          serverId,
          hostname,
          port,
          keyType: stored?.keyType ?? keyType,
          fingerprint,
          isChanged: Boolean(stored && stored.fingerprint !== fingerprint)
        }

        const accepted = await promptHostKey(prompt)
        if (!accepted) {
          callback(false)
          return
        }

        await hostKeyStore.save(hostname, port, key)
        callback(true)
      } catch {
        callback(false)
      }
    })()
  }
}
