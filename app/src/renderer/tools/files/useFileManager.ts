import { useCallback, useEffect, useRef, useState } from 'react'
import type { FileTransferProgressEvent, RemoteFileEntry } from '@shared/files'
import type { ServerId } from '@shared/server'
import { generateId } from '@renderer/lib/utils'
import { parseRelayError } from '@renderer/lib/errors'
import type { SortDirection, SortField } from './fileUtils'
import {
  filterEntries,
  joinRemotePath,
  parentPath,
  resolveRevealTarget,
  sortEntries
} from './fileUtils'

export interface OpenEditor {
  path: string
  name: string
  content: string
  dirty: boolean
}

export interface ActiveTransfer extends FileTransferProgressEvent {
  status: 'active' | 'complete' | 'error' | 'cancelled'
  error?: string
}

interface UseFileManagerOptions {
  serverId: ServerId
  isConnected: boolean
  homePath?: string
}

export function useFileManager({ serverId, isConnected, homePath = '/' }: UseFileManagerOptions) {
  const [currentPath, setCurrentPath] = useState('/')
  const [entries, setEntries] = useState<RemoteFileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [editor, setEditor] = useState<OpenEditor | null>(null)
  const [transfers, setTransfers] = useState<ActiveTransfer[]>([])
  const [clipboard, setClipboard] = useState<{ mode: 'copy' | 'move'; paths: string[] } | null>(null)
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  const backStack = useRef<string[]>([])
  const forwardStack = useRef<string[]>([])

  const syncNavState = useCallback(() => {
    setCanGoBack(backStack.current.length > 0)
    setCanGoForward(forwardStack.current.length > 0)
  }, [])

  const refresh = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.relay.files.list({ serverId, path: currentPath })
      setEntries(result.entries)
      setSelectedPaths(new Set())
    } catch (err) {
      setError(parseRelayError(err).message)
    } finally {
      setLoading(false)
    }
  }, [serverId, currentPath, isConnected])

  useEffect(() => {
    setCurrentPath('/')
    backStack.current = []
    forwardStack.current = []
    syncNavState()
    setEditor(null)
    setSelectedPaths(new Set())
    setSearchQuery('')
  }, [serverId, syncNavState])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    const unsubProgress = window.relay.files.onTransferProgress((event) => {
      if (event.serverId !== serverId) return
      setTransfers((current) => {
        const existing = current.find((t) => t.transferId === event.transferId)
        if (existing) {
          return current.map((t) =>
            t.transferId === event.transferId ? { ...t, ...event, status: 'active' } : t
          )
        }
        return [...current, { ...event, status: 'active' }]
      })
    })

    const unsubComplete = window.relay.files.onTransferComplete((event) => {
      if (event.serverId !== serverId) return
      setTransfers((current) =>
        current.map((t) =>
          t.transferId === event.transferId
            ? {
                ...t,
                status: event.success ? 'complete' : 'cancelled',
                error: event.error
              }
            : t
        )
      )
      if (event.success) void refresh()
    })

    return () => {
      unsubProgress()
      unsubComplete()
    }
  }, [serverId, refresh])

  const navigateTo = useCallback(
    (path: string, pushHistory = true) => {
      if (path === currentPath) return
      if (pushHistory) {
        backStack.current.push(currentPath)
        forwardStack.current = []
        syncNavState()
      }
      setCurrentPath(path)
      setSelectedPaths(new Set())
      setSearchQuery('')
    },
    [currentPath, syncNavState]
  )

  const goBack = useCallback(() => {
    const previous = backStack.current.pop()
    if (!previous) return
    forwardStack.current.push(currentPath)
    syncNavState()
    setCurrentPath(previous)
    setSelectedPaths(new Set())
  }, [currentPath, syncNavState])

  const goForward = useCallback(() => {
    const next = forwardStack.current.pop()
    if (!next) return
    backStack.current.push(currentPath)
    syncNavState()
    setCurrentPath(next)
    setSelectedPaths(new Set())
  }, [currentPath, syncNavState])

  const goUp = useCallback(() => {
    navigateTo(parentPath(currentPath))
  }, [currentPath, navigateTo])

  const goHome = useCallback(() => {
    navigateTo(homePath)
  }, [homePath, navigateTo])

  const toggleSort = useCallback((field: SortField) => {
    setSortField((current) => {
      if (current === field) {
        setSortDirection((dir) => (dir === 'asc' ? 'desc' : 'asc'))
        return current
      }
      setSortDirection('asc')
      return field
    })
  }, [])

  const displayedEntries = sortEntries(filterEntries(entries, searchQuery), sortField, sortDirection)

  const toggleSelection = useCallback((path: string, multi: boolean) => {
    setSelectedPaths((current) => {
      const next = multi ? new Set(current) : new Set<string>()
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(displayedEntries.map((e) => e.path)))
  }, [displayedEntries])

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set())
  }, [])

  const openEntry = useCallback(
    async (entry: RemoteFileEntry) => {
      if (entry.type === 'directory') {
        navigateTo(entry.path)
        return
      }
      try {
        const result = await window.relay.files.read({ serverId, path: entry.path })
        setEditor({ path: entry.path, name: entry.name, content: result.content, dirty: false })
      } catch (err) {
        setError(parseRelayError(err).message)
      }
    },
    [serverId, navigateTo]
  )

  /**
   * Entry point for other tools ("Open in Files"). Listing the directory is the
   * part that must always succeed; opening the editor is best-effort, because
   * the path may be unreadable or not a regular file.
   */
  const revealPath = useCallback(
    async (path: string) => {
      const target = resolveRevealTarget(path)
      if (!target) {
        setError(`Cannot open "${path}": expected an absolute path.`)
        return
      }

      navigateTo(target.directory)
      if (!target.fileName) return

      const filePath = joinRemotePath(target.directory, target.fileName)
      try {
        const result = await window.relay.files.read({ serverId, path: filePath })
        setEditor({
          path: filePath,
          name: target.fileName,
          content: result.content,
          dirty: false
        })
      } catch (err) {
        setError(parseRelayError(err).message)
      }
    },
    [navigateTo, serverId]
  )

  const saveEditor = useCallback(async () => {
    if (!editor) return
    try {
      await window.relay.files.write({ serverId, path: editor.path, content: editor.content })
      setEditor({ ...editor, dirty: false })
      void refresh()
    } catch (err) {
      setError(parseRelayError(err).message)
    }
  }, [editor, serverId, refresh])

  const closeEditor = useCallback(() => {
    setEditor(null)
  }, [])

  const createFolder = useCallback(
    async (name: string) => {
      const path = joinRemotePath(currentPath, name)
      await window.relay.files.mkdir({ serverId, path })
      void refresh()
    },
    [serverId, currentPath, refresh]
  )

  const createFile = useCallback(
    async (name: string) => {
      const path = joinRemotePath(currentPath, name)
      await window.relay.files.write({ serverId, path, content: '' })
      void refresh()
      setEditor({ path, name, content: '', dirty: false })
    },
    [serverId, currentPath, refresh]
  )

  const renameEntry = useCallback(
    async (from: string, toName: string) => {
      const parent = parentPath(from)
      const to = joinRemotePath(parent, toName)
      await window.relay.files.rename({ serverId, from, to })
      void refresh()
    },
    [serverId, refresh]
  )

  const deleteEntries = useCallback(
    async (paths: string[], recursive = false) => {
      for (const path of paths) {
        await window.relay.files.delete({ serverId, path, recursive })
      }
      void refresh()
    },
    [serverId, refresh]
  )

  const copyToClipboard = useCallback((paths: string[]) => {
    setClipboard({ mode: 'copy', paths })
  }, [])

  const cutToClipboard = useCallback((paths: string[]) => {
    setClipboard({ mode: 'move', paths })
  }, [])

  const pasteClipboard = useCallback(async () => {
    if (!clipboard) return
    for (const sourcePath of clipboard.paths) {
      const name = sourcePath.split('/').pop() ?? sourcePath
      const dest = joinRemotePath(currentPath, name)
      if (clipboard.mode === 'copy') {
        await window.relay.files.copy({ serverId, from: sourcePath, to: dest })
      } else {
        await window.relay.files.rename({ serverId, from: sourcePath, to: dest })
      }
    }
    if (clipboard.mode === 'move') setClipboard(null)
    void refresh()
  }, [clipboard, currentPath, serverId, refresh])

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files)
      for (const file of fileArray) {
        const transferId = generateId()
        const remotePath = joinRemotePath(currentPath, file.name)
        const buffer = await file.arrayBuffer()
        const bytes = new Uint8Array(buffer)
        let binary = ''
        for (let i = 0; i < bytes.length; i += 1) {
          binary += String.fromCharCode(bytes[i])
        }
        const data = btoa(binary)
        await window.relay.files.upload({
          serverId,
          transferId,
          remotePath,
          data,
          offset: 0,
          totalSize: file.size,
          final: true
        })
      }
    },
    [serverId, currentPath]
  )

  const uploadFromDialog = useCallback(async () => {
    const transferId = generateId()
    try {
      await window.relay.files.upload({ serverId, transferId, remotePath: currentPath })
    } catch {
      // cancelled dialog
    }
  }, [serverId, currentPath])

  const downloadEntry = useCallback(
    async (path: string) => {
      const transferId = generateId()
      try {
        await window.relay.files.download({ serverId, transferId, remotePath: path })
      } catch {
        // cancelled dialog
      }
    },
    [serverId]
  )

  const cancelTransfer = useCallback((transferId: string) => {
    void window.relay.files.cancelTransfer({ transferId })
    setTransfers((current) =>
      current.map((t) => (t.transferId === transferId ? { ...t, status: 'cancelled' } : t))
    )
  }, [])

  const dismissTransfer = useCallback((transferId: string) => {
    setTransfers((current) => current.filter((t) => t.transferId !== transferId))
  }, [])

  return {
    currentPath,
    entries: displayedEntries,
    loading,
    error,
    setError,
    searchQuery,
    setSearchQuery,
    sortField,
    sortDirection,
    toggleSort,
    selectedPaths,
    toggleSelection,
    selectAll,
    clearSelection,
    editor,
    setEditor,
    navigateTo,
    goBack,
    goForward,
    goUp,
    goHome,
    canGoBack,
    canGoForward,
    refresh,
    openEntry,
    revealPath,
    saveEditor,
    closeEditor,
    createFolder,
    createFile,
    renameEntry,
    deleteEntries,
    copyToClipboard,
    cutToClipboard,
    pasteClipboard,
    hasClipboard: clipboard !== null,
    uploadFiles,
    uploadFromDialog,
    downloadEntry,
    transfers,
    cancelTransfer,
    dismissTransfer
  }
}
