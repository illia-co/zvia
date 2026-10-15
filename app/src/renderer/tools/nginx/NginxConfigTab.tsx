import { useCallback, useEffect, useRef, useState } from 'react'
import type { NginxConfigFile, NginxConfigTree as ConfigTree } from '@shared/nginx'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { FileEditor } from '@renderer/tools/files/FileEditor'
import { describeToolError } from '@renderer/lib/toolErrors'
import { denialMessage, isAllowed, useCapabilities, usePermissionsStore } from '@renderer/state/permissionsStore'
import { NginxConfigTree } from './NginxConfigTree'

interface NginxConfigTabProps {
  serverId: ServerId
  initialPath?: string
  onInitialPathApplied?: () => void
  onSaved: () => void
  onDirtyChange: (dirty: boolean) => void
}

interface OpenFile {
  path: string
  name: string
  content: string
  dirty: boolean
}

export function NginxConfigTab({
  serverId,
  initialPath,
  onInitialPathApplied,
  onSaved,
  onDirtyChange
}: NginxConfigTabProps) {
  const [tree, setTree] = useState<ConfigTree | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [openFile, setOpenFile] = useState<OpenFile | null>(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const initialPathConsumed = useRef(false)

  const loadTree = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.zvia.nginx.configTree({ serverId })
      setTree(result)
      setError(null)
    } catch (err) {
      setError(describeToolError(err).message)
    } finally {
      setLoading(false)
    }
  }, [serverId])

  useEffect(() => {
    setTree(null)
    setOpenFile(null)
    void loadTree()
  }, [loadTree])

  const selectFile = useCallback(
    async (file: NginxConfigFile): Promise<void> => {
      if (openFile?.dirty && openFile.path !== file.path) {
        setError('Save or close the current file before opening another one.')
        return
      }
      try {
        const result = await window.zvia.nginx.readConfig({ serverId, path: file.path })
        setOpenFile({ path: result.path, name: file.name, content: result.content, dirty: false })
        setError(null)
      } catch (err) {
        setError(describeToolError(err).message)
      }
    },
    [openFile, serverId]
  )

  useEffect(() => {
    if (!initialPath || !tree || initialPathConsumed.current) return
    const file = tree.files.find((entry) => entry.path === initialPath)
    if (!file) return
    initialPathConsumed.current = true

    void (async () => {
      try {
        const result = await window.zvia.nginx.readConfig({ serverId, path: file.path })
        setOpenFile({ path: result.path, name: file.name, content: result.content, dirty: false })
        setError(null)
        onInitialPathApplied?.()
      } catch (err) {
        setError(describeToolError(err).message)
      }
    })()
  }, [initialPath, onInitialPathApplied, serverId, tree])

  useEffect(() => {
    onDirtyChange(openFile?.dirty === true)
    return () => onDirtyChange(false)
  }, [openFile?.dirty, onDirtyChange])

  const save = async (): Promise<void> => {
    if (!openFile || saving) return
    const guard = usePermissionsStore.getState().byServer[serverId]
    if (!isAllowed(guard, 'nginx.write_config')) {
      setError(denialMessage(guard, 'nginx.write_config'))
      setSaveConfirmOpen(false)
      return
    }
    setSaving(true)
    try {
      await window.zvia.nginx.writeConfig({
        serverId,
        path: openFile.path,
        content: openFile.content
      })
      setOpenFile({ ...openFile, dirty: false })
      setError(null)
      setSaveConfirmOpen(false)
      onSaved()
      await loadTree()
    } catch (err) {
      setError(describeToolError(err).message)
      setSaveConfirmOpen(false)
    } finally {
      setSaving(false)
    }
  }

  const requestSave = (): void => {
    if (!openFile?.dirty || saving) return
    setSaveConfirmOpen(true)
  }

  const dirtyPaths = new Set(openFile?.dirty ? [openFile.path] : [])
  const caps = useCapabilities(serverId)
  const saveAllowed = caps.can('nginx.write_config')
  const saveReason = caps.reason('nginx.write_config') ?? undefined

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-text-tertiary">
          {tree?.configRoot ?? ''}
        </span>
        <Button size="sm" variant="ghost" onClick={() => void loadTree()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        <div className="w-60 shrink-0 overflow-auto border-r border-divider bg-bg-secondary">
          <NginxConfigTree
            tree={tree}
            loading={loading}
            activePath={openFile?.path ?? null}
            dirtyPaths={dirtyPaths}
            onSelect={(file) => void selectFile(file)}
          />
        </div>

        <div className="min-w-0 flex-1">
          {openFile ? (
            <FileEditor
              path={openFile.path}
              name={openFile.name}
              language="nginx"
              content={openFile.content}
              dirty={openFile.dirty}
              disableCriticalConfirm
              saveDisabled={!saveAllowed}
              saveDisabledReason={saveReason}
              onChange={(content) => setOpenFile({ ...openFile, content, dirty: true })}
              onSave={() => requestSave()}
              onClose={() => setOpenFile(null)}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center">
              <p className="max-w-xs text-xs leading-relaxed text-text-secondary">
                Select a config file to edit it. Saving invalidates the last configuration test, so
                run Test configuration again before reloading.
              </p>
            </div>
          )}
        </div>
      </div>

      <Dialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save nginx config?</DialogTitle>
            <DialogDescription>
              Are you sure you want to save {openFile?.path ?? 'this file'}? The change applies on
              the next reload and can take sites offline if invalid.
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
            sudo cp {openFile?.path ?? ''}
          </pre>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-text-tertiary">
            Runs as root on the remote server
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setSaveConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={saving || !saveAllowed}
              title={saveReason}
              onClick={() => void save()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
