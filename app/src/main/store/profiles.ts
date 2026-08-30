import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ServerProfile, ServerId } from '@shared/server'
import { ZviaError } from '@shared/errors'
import type { ProfileCreateRequest, ProfileUpdateRequest } from '@shared/ipc'
import { createServerId } from '@shared/validate'
import { secretsStore } from './secrets'

interface ProfilesFile {
  version: 1
  profiles: ServerProfile[]
}

export class ProfileStore {
  private profiles: ServerProfile[] = []
  private filePath: string | null = null

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'profiles.json')
    }
    return this.filePath
  }

  async load(): Promise<void> {
    const filePath = this.getFilePath()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as ProfilesFile
      if (parsed.version !== 1 || !Array.isArray(parsed.profiles)) {
        throw new Error('Invalid profiles file format')
      }
      this.profiles = parsed.profiles
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.profiles = []
        await this.save()
        return
      }
      throw error
    }
  }

  async save(): Promise<void> {
    const filePath = this.getFilePath()
    await mkdir(dirname(filePath), { recursive: true })
    const payload: ProfilesFile = { version: 1, profiles: this.profiles }
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  list(): ServerProfile[] {
    return [...this.profiles]
  }

  get(id: ServerId): ServerProfile {
    const profile = this.profiles.find((item) => item.id === id)
    if (!profile) {
      throw new ZviaError('NOT_FOUND', `Profile not found: ${id}`)
    }
    return { ...profile }
  }

  async create(request: ProfileCreateRequest): Promise<ServerProfile> {
    const profile: ServerProfile = {
      id: createServerId(request.name),
      name: request.name,
      hostname: request.hostname,
      username: request.username,
      port: request.port ?? 22,
      auth: request.auth
    }
    if (request.auth.type === 'key-file') {
      profile.auth = {
        ...request.auth,
        hasPassphrase: Boolean(request.passphrase)
      }
    }
    this.profiles.push(profile)
    await this.save()
    if (request.passphrase) {
      await secretsStore.setPassphrase(profile.id, request.passphrase)
    }
    return { ...profile }
  }

  async update(request: ProfileUpdateRequest): Promise<ServerProfile> {
    const index = this.profiles.findIndex((item) => item.id === request.id)
    if (index === -1) {
      throw new ZviaError('NOT_FOUND', `Profile not found: ${request.id}`)
    }
    const existing = this.profiles[index]
    const updated: ServerProfile = {
      ...existing,
      name: request.name ?? existing.name,
      hostname: request.hostname ?? existing.hostname,
      username: request.username ?? existing.username,
      port: request.port ?? existing.port,
      auth: request.auth ?? existing.auth
    }
    if (updated.auth.type === 'key-file') {
      updated.auth = {
        ...updated.auth,
        hasPassphrase:
          request.clearPassphrase === true
            ? false
            : request.passphrase !== undefined
              ? true
              : updated.auth.hasPassphrase
      }
    }
    this.profiles[index] = updated
    await this.save()
    if (request.clearPassphrase) {
      await secretsStore.deletePassphrase(request.id)
    }
    if (request.passphrase) {
      await secretsStore.setPassphrase(request.id, request.passphrase)
    }
    return { ...updated }
  }

  async remove(id: ServerId): Promise<void> {
    const index = this.profiles.findIndex((item) => item.id === id)
    if (index === -1) {
      throw new ZviaError('NOT_FOUND', `Profile not found: ${id}`)
    }
    this.profiles.splice(index, 1)
    await this.save()
    await secretsStore.deletePassphrase(id)
  }
}

export const profileStore = new ProfileStore()
