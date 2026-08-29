import { app, safeStorage } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ServerId } from '@shared/server'
import { RelayError } from '@shared/errors'

interface SecretsFile {
  version: 1
  passphrases: Record<ServerId, string>
}

export class SecretsStore {
  private cache: Record<ServerId, string> = {}
  private filePath: string | null = null
  private loaded = false

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'secrets.json')
    }
    return this.filePath
  }

  private ensureEncryptionAvailable(): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new RelayError(
        'INTERNAL_ERROR',
        'OS secure storage is not available on this system'
      )
    }
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return
    const filePath = this.getFilePath()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as SecretsFile
      if (parsed.version !== 1 || typeof parsed.passphrases !== 'object') {
        throw new Error('Invalid secrets file format')
      }
      this.cache = parsed.passphrases
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.cache = {}
      } else {
        throw error
      }
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    const filePath = this.getFilePath()
    await mkdir(dirname(filePath), { recursive: true })
    const payload: SecretsFile = { version: 1, passphrases: this.cache }
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  async setPassphrase(serverId: ServerId, passphrase: string): Promise<void> {
    this.ensureEncryptionAvailable()
    await this.ensureLoaded()
    const encrypted = safeStorage.encryptString(passphrase).toString('base64')
    this.cache[serverId] = encrypted
    await this.persist()
  }

  async getPassphrase(serverId: ServerId): Promise<string | null> {
    this.ensureEncryptionAvailable()
    await this.ensureLoaded()
    const encrypted = this.cache[serverId]
    if (!encrypted) return null
    return safeStorage.decryptString(Buffer.from(encrypted, 'base64'))
  }

  async deletePassphrase(serverId: ServerId): Promise<void> {
    await this.ensureLoaded()
    if (!(serverId in this.cache)) return
    delete this.cache[serverId]
    await this.persist()
  }
}

export const secretsStore = new SecretsStore()
