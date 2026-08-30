import type { ServerId } from './server'
import type { ServerScoped } from './ipc'

export type FileEntryType = 'file' | 'directory' | 'symlink' | 'other'

export interface RemoteFileEntry {
  name: string
  path: string
  type: FileEntryType
  size: number
  modified: number
  permissions: string
}

export type TransferDirection = 'upload' | 'download'

export interface FileTransferProgressEvent {
  serverId: ServerId
  transferId: string
  direction: TransferDirection
  name: string
  bytesTransferred: number
  totalBytes: number
  speedBps: number
}

export interface FileTransferCompleteEvent {
  serverId: ServerId
  transferId: string
  direction: TransferDirection
  name: string
  success: boolean
  error?: string
  localPath?: string
}

export interface FilesListRequest extends ServerScoped {
  path: string
}

export interface FilesReadRequest extends ServerScoped {
  path: string
}

export interface FilesWriteRequest extends ServerScoped {
  path: string
  content: string
  /** Required when writing under a critical system path. */
  dangerousPathConfirmed?: boolean
}

export interface FilesMkdirRequest extends ServerScoped {
  path: string
}

export interface FilesRenameRequest extends ServerScoped {
  from: string
  to: string
  /** Required when renaming from or to a critical system path. */
  dangerousPathConfirmed?: boolean
}

export interface FilesDeleteRequest extends ServerScoped {
  path: string
  recursive?: boolean
  /** Required when deleting a critical system path. */
  dangerousPathConfirmed?: boolean
}

export interface FilesCopyRequest extends ServerScoped {
  from: string
  to: string
  /** Required when copying from or to a critical system path. */
  dangerousPathConfirmed?: boolean
}

export interface FilesUploadRequest extends ServerScoped {
  transferId: string
  remotePath: string
  localPath?: string
  data?: string
  offset?: number
  totalSize?: number
  final?: boolean
  /** Required when uploading to a critical system path. */
  dangerousPathConfirmed?: boolean
}

export interface FilesDownloadRequest extends ServerScoped {
  transferId: string
  remotePath: string
  localPath?: string
}

export interface FilesCancelTransferRequest {
  transferId: string
}

export interface FilesReadResponse {
  content: string
  size: number
}

export interface FilesListResponse {
  path: string
  entries: RemoteFileEntry[]
}

export interface FilesDownloadResponse {
  localPath: string
}
