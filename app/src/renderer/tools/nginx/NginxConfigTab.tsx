import { useCallback, useEffect, useRef, useState } from 'react'
import type { NginxConfigFile, NginxConfigTree as ConfigTree } from '@shared/nginx'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { FileEditor } from '@renderer/tools/files/FileEditor'
import { describeToolError } from '@renderer/lib/toolErrors'
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
    if (!openFile) return
    try {
      await window.zvia.nginx.writeConfig({
        serverId,
        path: openFile.path,
        content: openFile.content
      })
      setOpenFile({ ...openFile, dirty: false })
      setError(null)
      onSaved()
      await loadTree()
    } catch (err) {
      setError(describeToolError(err).message)
    }
  }

  const dirtyPaths = new Set(openFile?.dirty ? [openFile.path] : [])

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
              onChange={(content) => setOpenFile({ ...openFile, content, dirty: true })}
              onSave={() => void save()}
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
    </div>
  )
}
