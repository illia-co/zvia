import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { createHash } from 'node:crypto'

export interface StoredHostKey {
  fingerprint: string
  keyType: string
}

interface KnownHostsFile {
  version: 1
  hosts: Record<string, StoredHostKey>
}

function hostKey(host: string, port: number): string {
  return `${host}:${port}`
}

export function fingerprintFromKey(key: Buffer): { fingerprint: string; keyType: string } {
  const hash = createHash('sha256').update(key).digest('base64')
  const fingerprint = `SHA256:${hash.replace(/=+$/, '')}`
  let keyType = 'unknown'
  if (key.length > 11 && key[0] === 0x00 && key[1] === 0x00 && key[2] === 0x00 && key[3] === 0x07) {
    keyType = key.subarray(8, 19).toString('ascii')
  }
  return { fingerprint, keyType }
}

export class HostKeyStore {
  private hosts: Record<string, StoredHostKey> = {}
  private filePath: string | null = null
  private loaded = false

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'known_hosts.json')
    }
    return this.filePath
  }

  async load(): Promise<void> {
    if (this.loaded) return
    const filePath = this.getFilePath()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as KnownHostsFile
      if (parsed.version !== 1 || typeof parsed.hosts !== 'object') {
        throw new Error('Invalid known hosts file format')
      }
      this.hosts = parsed.hosts
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.hosts = {}
      } else {
        throw error
      }
    }
    this.loaded = true
  }

  private async persist(): Promise<void> {
    const filePath = this.getFilePath()
    await mkdir(dirname(filePath), { recursive: true })
    const payload: KnownHostsFile = { version: 1, hosts: this.hosts }
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  getSync(hostname: string, port: number): StoredHostKey | null {
    return this.hosts[hostKey(hostname, port)] ?? null
  }

  async save(hostname: string, port: number, key: Buffer): Promise<StoredHostKey> {
    await this.load()
    const { fingerprint, keyType } = fingerprintFromKey(key)
    const stored: StoredHostKey = { fingerprint, keyType }
    this.hosts[hostKey(hostname, port)] = stored
    await this.persist()
    return stored
  }
}

export const hostKeyStore = new HostKeyStore()
