import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ServerId } from '@shared/server'
import type { PermissionChoices } from '@shared/ipc'
import { PERMISSION_CAPABILITIES } from '@shared/permissions'

interface PermissionsFile {
  version: 1
  choices: Record<ServerId, PermissionChoices>
}

const KNOWN_IDS = new Set(PERMISSION_CAPABILITIES.map((capability) => capability.id))
const UNIT_PATTERN = /^[a-zA-Z0-9@._:-]{1,256}$/

function cleanChoices(enabled: string[], units: string[]): PermissionChoices {
  return {
    enabled: [...new Set(enabled)].filter((id) => KNOWN_IDS.has(id)),
    units: [...new Set(units)].filter((unit) => UNIT_PATTERN.test(unit)).slice(0, 128)
  }
}

function defaultChoices(): PermissionChoices {
  return cleanChoices(
    PERMISSION_CAPABILITIES.filter((capability) => capability.defaultEnabled).map(
      (capability) => capability.id
    ),
    []
  )
}

export class PermissionStore {
  private choices: Record<ServerId, PermissionChoices> = {}
  private filePath: string | null = null

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'permissions.json')
    }
    return this.filePath
  }

  async load(): Promise<void> {
    const filePath = this.getFilePath()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as PermissionsFile
      if (parsed.version !== 1 || typeof parsed.choices !== 'object') {
        throw new Error('Invalid permissions file format')
      }
      this.choices = parsed.choices
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.choices = {}
        await this.save()
        return
      }
      throw error
    }
  }

  private async save(): Promise<void> {
    const filePath = this.getFilePath()
    await mkdir(dirname(filePath), { recursive: true })
    const payload: PermissionsFile = { version: 1, choices: this.choices }
    await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf8')
  }

  /** Stored choices, or catalog defaults when never set for this server. */
  getChoices(serverId: ServerId): PermissionChoices {
    const stored = this.choices[serverId]
    if (stored) return cleanChoices(stored.enabled, stored.units)
    return defaultChoices()
  }

  async setChoices(serverId: ServerId, enabled: string[], units: string[] = []): Promise<PermissionChoices> {
    const clean = cleanChoices(enabled, units)
    this.choices[serverId] = clean
    await this.save()
    return clean
  }
}

export const permissionStore = new PermissionStore()
