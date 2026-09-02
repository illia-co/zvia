import { app } from 'electron'
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ServerId } from '@shared/server'
import type { TopologySnapshot } from '@shared/topology'

export const HISTORY_PER_SERVER_LIMIT = 10

export interface PersistedSnapshot {
  id: string
  scannedAt: string
  snapshot: TopologySnapshot
  deploymentTags: Record<string, string[]>
}

export interface ServerHistory {
  snapshots: PersistedSnapshot[]
}

interface TopologyHistoryFile {
  version: 3
  byServer: Record<string, ServerHistory>
}

export class TopologyHistoryStore {
  private byServer: Record<string, ServerHistory> = {}
  private filePath: string | null = null
  private writeQueue: Promise<void> = Promise.resolve()

  private getFilePath(): string {
    if (!this.filePath) {
      this.filePath = join(app.getPath('userData'), 'topologyHistory.json')
    }
    return this.filePath
  }

  async load(): Promise<void> {
    const filePath = this.getFilePath()
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed = JSON.parse(raw) as TopologyHistoryFile
      if (!parsed.byServer || typeof parsed.byServer !== 'object') {
        throw new Error('Invalid topology history file format')
      }

      const version = parsed.version as number
      if (version === 1) {
        this.byServer = this.migrateV1(parsed.byServer as Record<string, unknown>)
      } else if (version === 2) {
        this.byServer = this.migrateV2(parsed.byServer as Record<string, unknown>)
      } else if (version === 3) {
        this.byServer = parsed.byServer as Record<string, ServerHistory>
      } else {
        throw new Error('Invalid topology history file format')
      }

      await this.save()
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.byServer = {}
        await this.save()
        return
      }
      throw error
    }
  }

  private migrateV1(
    oldByServer: Record<string, unknown>
  ): Record<string, ServerHistory> {
    const result: Record<string, ServerHistory> = {}
    for (const [serverId, oldEntry] of Object.entries(oldByServer)) {
      const entry = oldEntry as {
        snapshots?: Array<{
          id: string
          scannedAt: string
          snapshot: TopologySnapshot
        }>
        pinnedId?: string | null
      }
      const snapshots: PersistedSnapshot[] = (entry.snapshots ?? []).map((s) => ({
        id: s.id,
        scannedAt: s.scannedAt,
        snapshot: s.snapshot,
        deploymentTags: {}
      }))
      result[serverId] = { snapshots }
    }
    return result
  }

  private migrateV2(
    oldByServer: Record<string, unknown>
  ): Record<string, ServerHistory> {
    const result: Record<string, ServerHistory> = {}
    for (const [serverId, oldEntry] of Object.entries(oldByServer)) {
      const entry = oldEntry as {
        snapshots?: Array<{
          id: string
          scannedAt: string
          snapshot: TopologySnapshot
          tags?: string[]
        }>
      }
      const snapshots: PersistedSnapshot[] = (entry.snapshots ?? []).map((s) => ({
        id: s.id,
        scannedAt: s.scannedAt,
        snapshot: s.snapshot,
        deploymentTags: {}
      }))
      result[serverId] = { snapshots }
    }
    return result
  }

  async save(): Promise<void> {
    const filePath = this.getFilePath()
    const payload = JSON.stringify({ version: 3 as const, byServer: this.byServer }, null, 2)

    const write = this.writeQueue.then(async () => {
      await mkdir(dirname(filePath), { recursive: true })
      const temporaryPath = `${filePath}.tmp`
      await writeFile(temporaryPath, payload, 'utf8')
      await rename(temporaryPath, filePath)
    })
    this.writeQueue = write.then(
      () => undefined,
      () => undefined
    )
    return write
  }

  list(serverId: ServerId): PersistedSnapshot[] {
    const history = this.byServer[serverId]
    return history ? [...history.snapshots].reverse() : []
  }

  get(serverId: ServerId, snapshotId: string): PersistedSnapshot | null {
    return this.byServer[serverId]?.snapshots.find((entry) => entry.id === snapshotId) ?? null
  }

  latest(serverId: ServerId): PersistedSnapshot | null {
    const history = this.byServer[serverId]
    if (!history || history.snapshots.length === 0) return null
    return history.snapshots[history.snapshots.length - 1] ?? null
  }

  getDeploymentTags(serverId: ServerId, snapshotId: string, deploymentId: string): string[] {
    const snapshot = this.get(serverId, snapshotId)
    return snapshot?.deploymentTags[deploymentId] ?? []
  }

  getLatestDeploymentTag(serverId: ServerId, deploymentId: string): string | null {
    const history = this.byServer[serverId]
    if (!history) return null
    for (let i = history.snapshots.length - 1; i >= 0; i--) {
      const tags = history.snapshots[i].deploymentTags[deploymentId]
      if (tags && tags.length > 0) return tags[tags.length - 1]
    }
    return null
  }

  getTaggedDeploymentSnapshots(
    serverId: ServerId,
    deploymentId: string
  ): PersistedSnapshot[] {
    const history = this.byServer[serverId]
    if (!history) return []
    return history.snapshots.filter(
      (s) => s.deploymentTags[deploymentId] && s.deploymentTags[deploymentId].length > 0
    )
  }

  hasAnyDeploymentTags(serverId: ServerId): boolean {
    const history = this.byServer[serverId]
    if (!history) return false
    return history.snapshots.some((s) => {
      for (const tags of Object.values(s.deploymentTags)) {
        if (tags.length > 0) return true
      }
      return false
    })
  }

  async record(serverId: ServerId, snapshot: TopologySnapshot): Promise<string> {
    const id = snapshot.scannedAt
    const history = this.byServer[serverId] ?? { snapshots: [] }
    const existing = history.snapshots.findIndex((entry) => entry.id === id)
    if (existing === -1) {
      history.snapshots.push({ id, scannedAt: snapshot.scannedAt, snapshot, deploymentTags: {} })
      if (history.snapshots.length > HISTORY_PER_SERVER_LIMIT) {
        while (history.snapshots.length > HISTORY_PER_SERVER_LIMIT) {
          const oldestUntagged = history.snapshots.find((s) => {
            for (const tags of Object.values(s.deploymentTags)) {
              if (tags.length > 0) return false
            }
            return true
          })
          if (!oldestUntagged) break
          const idx = history.snapshots.indexOf(oldestUntagged)
          history.snapshots.splice(idx, 1)
        }
      }
    }
    this.byServer[serverId] = history
    await this.save()
    return id
  }

  async addDeploymentTag(
    serverId: ServerId,
    snapshotId: string,
    deploymentId: string,
    tagName: string
  ): Promise<void> {
    const history = this.byServer[serverId]
    if (!history) return
    if (tagName === 'latest') throw new Error('"latest" is a reserved tag name')
    const snapshot = history.snapshots.find((entry) => entry.id === snapshotId)
    if (!snapshot) return
    if (!snapshot.deploymentTags[deploymentId]) {
      snapshot.deploymentTags[deploymentId] = []
    }
    const tags = snapshot.deploymentTags[deploymentId]
    if (!tags.includes(tagName)) {
      tags.push(tagName)
      await this.save()
    }
  }

  async removeDeploymentTag(
    serverId: ServerId,
    snapshotId: string,
    deploymentId: string,
    tagName: string
  ): Promise<void> {
    const history = this.byServer[serverId]
    if (!history) return
    const snapshot = history.snapshots.find((entry) => entry.id === snapshotId)
    if (!snapshot) return
    const tags = snapshot.deploymentTags[deploymentId]
    if (!tags) return
    const idx = tags.indexOf(tagName)
    if (idx !== -1) {
      tags.splice(idx, 1)
      await this.save()
    }
  }

  async removeServer(serverId: ServerId): Promise<void> {
    if (!this.byServer[serverId]) return
    delete this.byServer[serverId]
    await this.save()
  }

  reset(): void {
    this.byServer = {}
    this.filePath = null
    this.writeQueue = Promise.resolve()
  }
}

export const topologyHistoryStore = new TopologyHistoryStore()
