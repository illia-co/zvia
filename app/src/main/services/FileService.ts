import { basename } from 'node:path'
import type { BrowserWindow, OpenDialogOptions, SaveDialogOptions } from 'electron'
import { dialog } from 'electron'
import type { SFTPWrapper, Stats, FileEntryWithStats } from 'ssh2'
import type {
  FileEntryType,
  FileTransferCompleteEvent,
  FileTransferProgressEvent,
  FilesCopyRequest,
  FilesDeleteRequest,
  FilesDownloadRequest,
  FilesListRequest,
  FilesMkdirRequest,
  FilesReadRequest,
  FilesRenameRequest,
  FilesUploadRequest,
  FilesWriteRequest,
  RemoteFileEntry
} from '@shared/files'
import { CommandError, ConnectionError, PermissionError, ZviaError, SFTPError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'

const S_IFMT = 0o170000
const S_IFDIR = 0o040000
const S_IFLNK = 0o120000
const S_IFREG = 0o100000

interface ActiveTransfer {
  serverId: string
  transferId: string
  direction: 'upload' | 'download'
  name: string
  totalBytes: number
  bytesTransferred: number
  startedAt: number
  cancelled: boolean
}

function joinRemotePath(dir: string, name: string): string {
  if (dir === '/') return `/${name}`
  return `${dir.replace(/\/$/, '')}/${name}`
}

function formatPermissions(mode: number): string {
  const typeChar =
    (mode & S_IFMT) === S_IFDIR
      ? 'd'
      : (mode & S_IFMT) === S_IFLNK
        ? 'l'
        : '-'

  const bits = ['r', 'w', 'x']
  let result = typeChar
  for (let shift = 6; shift >= 0; shift -= 3) {
    for (let bit = 2; bit >= 0; bit -= 1) {
      result += mode & (1 << (shift + bit)) ? bits[2 - bit] : '-'
    }
  }
  return result
}

function entryTypeFromMode(mode: number): FileEntryType {
  const fileType = mode & S_IFMT
  if (fileType === S_IFDIR) return 'directory'
  if (fileType === S_IFLNK) return 'symlink'
  if (fileType === S_IFREG) return 'file'
  return 'other'
}

function mapEntry(parentPath: string, entry: FileEntryWithStats): RemoteFileEntry {
  const attrs = entry.attrs
  const mode = attrs.mode ?? 0
  return {
    name: entry.filename,
    path: joinRemotePath(parentPath, entry.filename),
    type: entryTypeFromMode(mode),
    size: attrs.size ?? 0,
    modified: (attrs.mtime ?? 0) * 1000,
    permissions: formatPermissions(mode)
  }
}

function shellQuote(value: string): string {
  return JSON.stringify(value)
}

function sftpCallback<T>(
  operation: string,
  fn: (callback: (err: Error | null | undefined, result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    fn((error, result) => {
      if (error) {
        const message = error.message || `SFTP ${operation} failed`
        if (/permission denied/i.test(message)) {
          reject(new PermissionError(message))
          return
        }
        reject(new SFTPError(message))
        return
      }
      resolve(result)
    })
  })
}

export class FileService {
  private mainWindow: BrowserWindow | null = null
  private transfers = new Map<string, ActiveTransfer>()
  private uploadBuffers = new Map<string, Buffer[]>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getConnection(serverId: string) {
    const connection = connectionManager.getConnection(serverId)
    if (!connection) {
      throw new ConnectionError('Server is not connected')
    }
    return connection
  }

  private async getSftp(serverId: string): Promise<SFTPWrapper> {
    return this.getConnection(serverId).getSftp()
  }

  private sendProgress(event: FileTransferProgressEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('files:transferProgress', event)
    }
  }

  private sendComplete(event: FileTransferCompleteEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('files:transferComplete', event)
    }
  }

  private updateProgress(transfer: ActiveTransfer): void {
    const elapsed = Math.max(Date.now() - transfer.startedAt, 1)
    const speedBps = (transfer.bytesTransferred / elapsed) * 1000
    this.sendProgress({
      serverId: transfer.serverId,
      transferId: transfer.transferId,
      direction: transfer.direction,
      name: transfer.name,
      bytesTransferred: transfer.bytesTransferred,
      totalBytes: transfer.totalBytes,
      speedBps
    })
  }

  private finishTransfer(transferId: string, success: boolean, error?: string, localPath?: string): void {
    const transfer = this.transfers.get(transferId)
    if (!transfer) return
    this.transfers.delete(transferId)
    this.uploadBuffers.delete(transferId)
    this.sendComplete({
      serverId: transfer.serverId,
      transferId: transfer.transferId,
      direction: transfer.direction,
      name: transfer.name,
      success,
      error,
      localPath
    })
  }

  cancelTransfer(transferId: string): void {
    const transfer = this.transfers.get(transferId)
    if (!transfer) return
    transfer.cancelled = true
    this.finishTransfer(transferId, false, 'Transfer cancelled')
  }

  async list(request: FilesListRequest): Promise<{ path: string; entries: RemoteFileEntry[] }> {
    const sftp = await this.getSftp(request.serverId)
    const entries = await sftpCallback<FileEntryWithStats[]>('readdir', (callback) => {
      sftp.readdir(request.path, callback)
    })

    const mapped = entries
      .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
      .map((entry) => mapEntry(request.path, entry))
      .sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1
        if (a.type !== 'directory' && b.type === 'directory') return 1
        return a.name.localeCompare(b.name)
      })

    return { path: request.path, entries: mapped }
  }

  async read(request: FilesReadRequest): Promise<{ content: string; size: number }> {
    const sftp = await this.getSftp(request.serverId)
    const buffer = await sftpCallback<Buffer>('readFile', (callback) => {
      sftp.readFile(request.path, callback)
    })
    return { content: buffer.toString('utf8'), size: buffer.length }
  }

  async write(request: FilesWriteRequest): Promise<void> {
    const sftp = await this.getSftp(request.serverId)
    await sftpCallback<void>('writeFile', (callback) => {
      sftp.writeFile(request.path, request.content, 'utf8', callback)
    })
  }

  async mkdir(request: FilesMkdirRequest): Promise<void> {
    const sftp = await this.getSftp(request.serverId)
    await sftpCallback<void>('mkdir', (callback) => {
      sftp.mkdir(request.path, callback)
    })
  }

  async rename(request: FilesRenameRequest): Promise<void> {
    const sftp = await this.getSftp(request.serverId)
    await sftpCallback<void>('rename', (callback) => {
      sftp.rename(request.from, request.to, callback)
    })
  }

  async delete(request: FilesDeleteRequest): Promise<void> {
    const sftp = await this.getSftp(request.serverId)
    const stats = await sftpCallback<Stats>('stat', (callback) => {
      sftp.stat(request.path, callback)
    })

    const isDirectory = ((stats.mode ?? 0) & S_IFMT) === S_IFDIR
    if (isDirectory) {
      if (!request.recursive) {
        throw new ZviaError('VALIDATION_ERROR', 'Directory delete requires recursive confirmation')
      }
      await this.getConnection(request.serverId).exec(
        `rm -rf ${shellQuote(request.path)}`
      )
      return
    }

    await sftpCallback<void>('unlink', (callback) => {
      sftp.unlink(request.path, callback)
    })
  }

  async copy(request: FilesCopyRequest): Promise<void> {
    const result = await this.getConnection(request.serverId).exec(
      `cp -a ${shellQuote(request.from)} ${shellQuote(request.to)}`
    )
    if (result.exitCode !== 0) {
      throw new CommandError(result.stderr || 'Copy failed', result.stdout)
    }
  }

  async upload(request: FilesUploadRequest): Promise<void> {
    if (request.data !== undefined) {
      await this.uploadFromChunks(request)
      return
    }
    await this.uploadFromLocalPath(request)
  }

  private async uploadFromLocalPath(request: FilesUploadRequest): Promise<void> {
    let localPath = request.localPath
    if (!localPath) {
      const picked = await this.pickUploadPaths()
      if (!picked || picked.length === 0) {
        throw new ZviaError('VALIDATION_ERROR', 'Upload cancelled')
      }
      localPath = picked[0]
    }

    const name = basename(localPath)
    const remotePath = request.localPath
      ? request.remotePath
      : joinRemotePath(request.remotePath.replace(/\/$/, '') || '/', name)
    const transfer: ActiveTransfer = {
      serverId: request.serverId,
      transferId: request.transferId,
      direction: 'upload',
      name,
      totalBytes: 0,
      bytesTransferred: 0,
      startedAt: Date.now(),
      cancelled: false
    }
    this.transfers.set(request.transferId, transfer)

    const sftp = await this.getSftp(request.serverId)

    await new Promise<void>((resolve, reject) => {
      sftp.fastPut(localPath!, remotePath, {
        step: (totalTransferred, _chunk, total) => {
          transfer.bytesTransferred = totalTransferred
          transfer.totalBytes = total
          this.updateProgress(transfer)
        }
      }, (error) => {
        if (error) {
          if (transfer.cancelled) return
          this.finishTransfer(request.transferId, false, error.message)
          reject(new SFTPError(error.message))
          return
        }
        if (transfer.cancelled) return
        this.finishTransfer(request.transferId, true)
        resolve()
      })
    })
  }

  private async uploadFromChunks(request: FilesUploadRequest): Promise<void> {
    const transferId = request.transferId
    let transfer = this.transfers.get(transferId)

    if (!transfer) {
      transfer = {
        serverId: request.serverId,
        transferId,
        direction: 'upload',
        name: basename(request.remotePath),
        totalBytes: request.totalSize ?? 0,
        bytesTransferred: 0,
        startedAt: Date.now(),
        cancelled: false
      }
      this.transfers.set(transferId, transfer)
      this.uploadBuffers.set(transferId, [])
    }

    if (request.data) {
      const chunk = Buffer.from(request.data, 'base64')
      const chunks = this.uploadBuffers.get(transferId) ?? []
      chunks.push(chunk)
      this.uploadBuffers.set(transferId, chunks)
      transfer.bytesTransferred += chunk.length
      if (request.totalSize) transfer.totalBytes = request.totalSize
      this.updateProgress(transfer)
    }

    if (!request.final) return

    const buffer = Buffer.concat(this.uploadBuffers.get(transferId) ?? [])
    const sftp = await this.getSftp(request.serverId)

    await sftpCallback<void>('writeFile', (callback) => {
      sftp.writeFile(request.remotePath, buffer, callback)
    })

    if (transfer.cancelled) return
    transfer.bytesTransferred = buffer.length
    transfer.totalBytes = buffer.length
    this.updateProgress(transfer)
    this.finishTransfer(transferId, true)
  }

  async download(request: FilesDownloadRequest): Promise<{ localPath: string }> {
    const name = basename(request.remotePath)
    let localPath = request.localPath

    if (!localPath) {
      const picked = await this.pickDownloadPath(name)
      if (!picked) {
        throw new ZviaError('VALIDATION_ERROR', 'Download cancelled')
      }
      localPath = picked
    }

    const transfer: ActiveTransfer = {
      serverId: request.serverId,
      transferId: request.transferId,
      direction: 'download',
      name,
      totalBytes: 0,
      bytesTransferred: 0,
      startedAt: Date.now(),
      cancelled: false
    }
    this.transfers.set(request.transferId, transfer)

    const sftp = await this.getSftp(request.serverId)

    await new Promise<void>((resolve, reject) => {
      sftp.fastGet(request.remotePath, localPath!, {
        step: (totalTransferred, _chunk, total) => {
          transfer.bytesTransferred = totalTransferred
          transfer.totalBytes = total
          this.updateProgress(transfer)
        }
      }, (error) => {
        if (error) {
          if (transfer.cancelled) return
          this.finishTransfer(request.transferId, false, error.message)
          reject(new SFTPError(error.message))
          return
        }
        if (transfer.cancelled) return
        this.finishTransfer(request.transferId, true, undefined, localPath)
        resolve()
      })
    })

    return { localPath: localPath! }
  }

  async pickUploadPaths(): Promise<string[] | null> {
    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections']
    }
    const result = this.mainWindow
      ? await dialog.showOpenDialog(this.mainWindow, options)
      : await dialog.showOpenDialog(options)
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths
  }

  async pickDownloadPath(defaultName: string): Promise<string | null> {
    const options: SaveDialogOptions = {
      defaultPath: defaultName
    }
    const result = this.mainWindow
      ? await dialog.showSaveDialog(this.mainWindow, options)
      : await dialog.showSaveDialog(options)
    if (result.canceled || !result.filePath) return null
    return result.filePath
  }
}

export const fileService = new FileService()
