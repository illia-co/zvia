import { useCallback, useEffect, useRef, useState } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { usePanelId } from '@renderer/state/PanelContext'
import { usePanelStateStore } from '@renderer/state/panelStateStore'
import { useServerStore } from '@renderer/state/serverStore'
import { useToolIntent } from '@renderer/state/navigationStore'
import { Button } from '@renderer/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { cn } from '@renderer/lib/utils'
import type { RemoteFileEntry } from '@shared/files'
import { FileBreadcrumbs } from './FileBreadcrumbs'
import { FileEditor } from './FileEditor'
import { FileList } from './FileList'
import { TransferPanel } from './TransferPanel'
import { useFileManager } from './useFileManager'
import { isEditableFile } from './fileUtils'

type PromptMode = 'create-file' | 'create-folder' | 'rename' | 'delete' | null

export function FilesPanel() {
  const panelId = usePanelId()
  const registerPanelDirty = usePanelStateStore((s) => s.registerPanelDirty)
  const { serverId, server, connectionState } = useRequiredServerContext()
  const connect = useServerStore((s) => s.connect)
  const isConnected = connectionState === 'connected'

  const fm = useFileManager({ serverId, isConnected })
  const intent = useToolIntent('files')
  const [promptMode, setPromptMode] = useState<PromptMode>(null)

  // revealPath is re-created whenever the current directory changes, so the
  // intent itself is what marks the navigation as already handled.
  const handledIntent = useRef<typeof intent>(null)
  const revealPath = fm.revealPath
  useEffect(() => {
    if (!intent || !isConnected || handledIntent.current === intent) return
    handledIntent.current = intent
    void revealPath(intent.path)
  }, [intent, isConnected, revealPath])

  useEffect(() => {
    if (fm.editor?.dirty) {
      registerPanelDirty(panelId, { kind: 'files' })
    } else {
      registerPanelDirty(panelId, null)
    }
    return () => registerPanelDirty(panelId, null)
  }, [fm.editor?.dirty, panelId, registerPanelDirty])

  const [promptValue, setPromptValue] = useState('')
  const [promptTarget, setPromptTarget] = useState<RemoteFileEntry | null>(null)
  const [deleteRecursive, setDeleteRecursive] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  const selectedEntries = fm.entries.filter((e) => fm.selectedPaths.has(e.path))
  const hasSelection = selectedEntries.length > 0

  const openPrompt = useCallback((mode: PromptMode, target?: RemoteFileEntry) => {
    setPromptMode(mode)
    setPromptTarget(target ?? null)
    setPromptValue(target?.name ?? '')
    setDeleteRecursive(false)
  }, [])

  const closePrompt = useCallback(() => {
    setPromptMode(null)
    setPromptValue('')
    setPromptTarget(null)
  }, [])

  const handlePromptConfirm = useCallback(async () => {
    try {
      if (promptMode === 'create-file' && promptValue.trim()) {
        await fm.createFile(promptValue.trim())
      } else if (promptMode === 'create-folder' && promptValue.trim()) {
        await fm.createFolder(promptValue.trim())
      } else if (promptMode === 'rename' && promptTarget && promptValue.trim()) {
        await fm.renameEntry(promptTarget.path, promptValue.trim())
      } else if (promptMode === 'delete') {
        const paths = promptTarget ? [promptTarget.path] : Array.from(fm.selectedPaths)
        const needsRecursive = paths.some((path) => {
          const entry = fm.entries.find((e) => e.path === path)
          return entry?.type === 'directory'
        })
        await fm.deleteEntries(paths, needsRecursive && deleteRecursive)
        fm.clearSelection()
      }
      closePrompt()
    } catch (err) {
      fm.setError(err instanceof Error ? err.message : 'Operation failed')
    }
  }, [promptMode, promptValue, promptTarget, deleteRecursive, fm, closePrompt])

  const handleDrop = useCallback(
    async (event: React.DragEvent) => {
      event.preventDefault()
      setIsDragging(false)
      if (!isConnected || !event.dataTransfer.files.length) return
      try {
        await fm.uploadFiles(event.dataTransfer.files)
      } catch (err) {
        fm.setError(err instanceof Error ? err.message : 'Upload failed')
      }
    },
    [fm, isConnected]
  )

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to browse remote files.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => void connect(serverId)}
            disabled={connectionState === 'connecting' || connectionState === 'reconnecting'}
          >
            {connectionState === 'connecting' || connectionState === 'reconnecting'
              ? 'Connecting…'
              : 'Connect'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-bg-secondary">
      <div className="flex shrink-0 items-center gap-2 border-b border-divider px-3 py-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={fm.goBack} disabled={!fm.canGoBack}>
            ←
          </Button>
          <Button size="sm" variant="ghost" onClick={fm.goForward} disabled={!fm.canGoForward}>
            →
          </Button>
          <Button size="sm" variant="ghost" onClick={fm.goUp} disabled={fm.currentPath === '/'}>
            ↑
          </Button>
          <Button size="sm" variant="ghost" onClick={fm.goHome}>
            Home
          </Button>
        </div>

        <div className="min-w-0 flex-1">
          <FileBreadcrumbs
            serverName={server.name}
            path={fm.currentPath}
            onNavigate={fm.navigateTo}
          />
        </div>

        <input
          type="search"
          placeholder="Search"
          value={fm.searchQuery}
          onChange={(event) => fm.setSearchQuery(event.target.value)}
          className="w-36 rounded-panel border border-divider bg-bg px-2 py-1 text-xs text-text outline-none focus:border-text-tertiary"
        />

        <Button size="sm" variant="ghost" onClick={() => openPrompt('create-folder')}>
          New Folder
        </Button>
        <Button size="sm" variant="ghost" onClick={() => openPrompt('create-file')}>
          New File
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void fm.uploadFromDialog()}>
          Upload
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void fm.refresh()} disabled={fm.loading}>
          {fm.loading ? '…' : 'Refresh'}
        </Button>
      </div>

      {fm.error && (
        <div className="shrink-0 border-b border-divider px-3 py-2">
          <ErrorSurface error={fm.error} onDismiss={() => fm.setError(null)} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                'flex min-h-0 min-w-0 flex-1 flex-col',
                isDragging && 'ring-2 ring-inset ring-text-tertiary'
              )}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(event) => void handleDrop(event)}
            >
              <FileList
                entries={fm.entries}
                selectedPaths={fm.selectedPaths}
                sortField={fm.sortField}
                sortDirection={fm.sortDirection}
                onSort={fm.toggleSort}
                onOpen={(entry) => {
                  if (entry.type === 'file' && !isEditableFile(entry)) {
                    void fm.downloadEntry(entry.path)
                    return
                  }
                  void fm.openEntry(entry)
                }}
                onSelect={fm.toggleSelection}
                onContextMenu={(entry, event) => {
                  event.preventDefault()
                  if (!fm.selectedPaths.has(entry.path)) {
                    fm.toggleSelection(entry.path, false)
                  }
                }}
              />
            </div>
          </ContextMenuTrigger>

          <ContextMenuContent>
            <ContextMenuItem onSelect={() => void fm.openEntry(selectedEntries[0] ?? fm.entries[0])}>
              Open
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => {
                const target = selectedEntries[0]
                if (target) void fm.downloadEntry(target.path)
              }}
              disabled={!hasSelection}
            >
              Download
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => fm.copyToClipboard(Array.from(fm.selectedPaths))}
              disabled={!hasSelection}
            >
              Copy
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => fm.cutToClipboard(Array.from(fm.selectedPaths))}
              disabled={!hasSelection}
            >
              Cut
            </ContextMenuItem>
            <ContextMenuItem onSelect={() => void fm.pasteClipboard()} disabled={!fm.hasClipboard}>
              Paste
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onSelect={() => openPrompt('rename', selectedEntries[0])}
              disabled={selectedEntries.length !== 1}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              onSelect={() => openPrompt('delete', selectedEntries[0])}
              disabled={!hasSelection}
            >
              Delete
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        {fm.editor && (
          <div className="w-1/2 min-w-[20rem] shrink-0">
            <FileEditor
              path={fm.editor.path}
              name={fm.editor.name}
              content={fm.editor.content}
              dirty={fm.editor.dirty}
              onChange={(content) =>
                fm.setEditor(fm.editor ? { ...fm.editor, content, dirty: true } : null)
              }
              onSave={() => void fm.saveEditor()}
              onClose={fm.closeEditor}
            />
          </div>
        )}
      </div>

      <TransferPanel
        transfers={fm.transfers}
        onCancel={fm.cancelTransfer}
        onDismiss={fm.dismissTransfer}
      />

      <Dialog open={promptMode !== null} onOpenChange={(open) => !open && closePrompt()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {promptMode === 'create-file' && 'New File'}
              {promptMode === 'create-folder' && 'New Folder'}
              {promptMode === 'rename' && 'Rename'}
              {promptMode === 'delete' && 'Delete'}
            </DialogTitle>
            {promptMode === 'delete' && (
              <DialogDescription>
                {promptTarget
                  ? `Delete "${promptTarget.name}"? This cannot be undone.`
                  : `Delete ${fm.selectedPaths.size} selected items? This cannot be undone.`}
              </DialogDescription>
            )}
          </DialogHeader>

          {promptMode !== 'delete' ? (
            <input
              autoFocus
              value={promptValue}
              onChange={(event) => setPromptValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void handlePromptConfirm()
              }}
              className="w-full rounded-panel border border-divider bg-bg px-3 py-2 text-sm text-text outline-none focus:border-text-tertiary"
              placeholder="Name"
            />
          ) : (
            (promptTarget?.type === 'directory' ||
              selectedEntries.some((e) => e.type === 'directory')) && (
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <input
                  type="checkbox"
                  checked={deleteRecursive}
                  onChange={(event) => setDeleteRecursive(event.target.checked)}
                />
                Delete folder and all contents
              </label>
            )
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closePrompt}>
              Cancel
            </Button>
            <Button
              variant={promptMode === 'delete' ? 'destructive' : 'default'}
              onClick={() => void handlePromptConfirm()}
              disabled={
                promptMode === 'delete'
                  ? (promptTarget?.type === 'directory' ||
                      selectedEntries.some((e) => e.type === 'directory')) &&
                    !deleteRecursive
                  : !promptValue.trim()
              }
            >
              {promptMode === 'delete' ? 'Delete' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
