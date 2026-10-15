import { useEffect, useRef, useState } from 'react'
import { EditorState, Prec } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands'
import { indentUnit } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { python } from '@codemirror/lang-python'
import { markdown } from '@codemirror/lang-markdown'
import { xml } from '@codemirror/lang-xml'
import { StreamLanguage } from '@codemirror/language'
import { nginx } from '@codemirror/legacy-modes/mode/nginx'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import {
  CRITICAL_PATH_CONFIRMATION_PHRASE,
  getCriticalPathMutationWarning,
  isCriticalSystemPath
} from '@shared/remotePaths'

export type EditorLanguage = 'nginx'

const editorChipClassName =
  'rounded-sm bg-status-warning/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-status-warning'

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12px',
    fontFamily: 'var(--font-mono)',
    color: 'var(--color-text)'
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'inherit'
  },
  '.cm-content': {
    padding: '8px 0',
    caretColor: 'var(--color-text)'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-tertiary)'
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeft: '2px solid var(--color-text)'
  }
})

interface FileEditorProps {
  path: string
  name: string
  content: string
  dirty: boolean
  onChange: (content: string) => void
  onSave: (options?: { dangerousPathConfirmed?: boolean }) => void
  onClose: () => void
  /** Overrides filename-based detection for files whose type the caller knows. */
  language?: EditorLanguage
  /**
   * Skips the critical-path DELETE confirmation (e.g. the nginx tool shows its
   * own "Are you sure?" save dialog instead). Defaults to false.
   */
  disableCriticalConfirm?: boolean
  /** Externally disables Save (e.g. permission guard); shown as tooltip. */
  saveDisabled?: boolean
  saveDisabledReason?: string
}

/** nginx site configs are conventionally extensionless, so fall back to the path. */
function looksLikeNginxConfig(path: string): boolean {
  return /(^|\/)nginx(\.conf$|\/)/.test(path)
}

function languageExtension(filename: string, path: string, language?: EditorLanguage) {
  if (language === 'nginx') return StreamLanguage.define(nginx)

  const dot = filename.lastIndexOf('.')
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase()
  switch (ext) {
    case '.js':
    case '.jsx':
    case '.ts':
    case '.tsx':
    case '.mjs':
    case '.cjs':
      return javascript({ typescript: ext.includes('ts'), jsx: ext.includes('x') })
    case '.json':
      return json()
    case '.html':
    case '.htm':
      return html()
    case '.css':
    case '.scss':
      return css()
    case '.py':
      return python()
    case '.md':
    case '.markdown':
      return markdown()
    case '.xml':
    case '.svg':
      return xml()
    case '.conf':
      return StreamLanguage.define(nginx)
    default:
      return looksLikeNginxConfig(path) ? StreamLanguage.define(nginx) : []
  }
}

/** Indent unit per file type: 4 spaces for whitespace-sensitive configs. */
function indentForFile(filename: string, path: string, language?: EditorLanguage): string {
  if (language === 'nginx') return '    '
  const dot = filename.lastIndexOf('.')
  const ext = dot === -1 ? '' : filename.slice(dot).toLowerCase()
  if (ext === '.py' || ext === '.sh' || ext === '.bash' || ext === '.conf') return '    '
  if (looksLikeNginxConfig(path)) return '    '
  return '  '
}

export function FileEditor({
  path,
  name,
  content,
  dirty,
  onChange,
  onSave,
  onClose,
  language,
  disableCriticalConfirm = false,
  saveDisabled = false,
  saveDisabledReason
}: FileEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false)
  const [saveConfirmText, setSaveConfirmText] = useState('')
  onChangeRef.current = onChange

  const requestSave = () => {
    if (!disableCriticalConfirm && isCriticalSystemPath(path)) {
      setSaveConfirmText('')
      setConfirmSaveOpen(true)
      return
    }
    onSave()
  }

  const confirmSave = () => {
    setConfirmSaveOpen(false)
    onSave({ dangerousPathConfirmed: true })
  }

  const requestClose = () => {
    if (dirty) {
      setConfirmCloseOpen(true)
      return
    }
    onClose()
  }

  useEffect(() => {
    if (!containerRef.current) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString())
      }
    })

    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        doc: content,
        extensions: [
          lineNumbers(),
          history(),
          highlightSelectionMatches(),
          languageExtension(name, path, language),
          indentUnit.of(indentForFile(name, path, language)),
          EditorView.lineWrapping,
          keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          updateListener,
          Prec.high(editorTheme)
        ]
      })
    })

    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
  }, [path, name, language])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content }
      })
    }
  }, [content])

  return (
    <div className="flex h-full flex-col border-l border-divider bg-bg-secondary">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <span className={editorChipClassName}>Remote file</span>
        <span className="min-w-0 flex-1 truncate text-xs text-text">{name}</span>
        {dirty && <span className={editorChipClassName}>Unsaved</span>}
        <Button
          size="sm"
          variant="ghost"
          onClick={requestSave}
          disabled={!dirty || saveDisabled}
          title={saveDisabledReason}
        >
          Save
        </Button>
        <Button size="sm" variant="ghost" onClick={requestClose}>
          Close
        </Button>
      </div>
      <div ref={containerRef} className={cn('min-h-0 flex-1 overflow-hidden')} />

      <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save critical system file?</DialogTitle>
            <DialogDescription>
              {getCriticalPathMutationWarning(path) ??
                'Saving this file can affect core system behavior.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <p className="text-xs text-text-secondary">
              Type <span className="font-mono">{CRITICAL_PATH_CONFIRMATION_PHRASE}</span> to
              confirm.
            </p>
            <Input
              autoFocus
              value={saveConfirmText}
              onChange={(event) => setSaveConfirmText(event.target.value)}
              className="w-full font-mono text-sm"
              placeholder={CRITICAL_PATH_CONFIRMATION_PHRASE}
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmSaveOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={saveConfirmText !== CRITICAL_PATH_CONFIRMATION_PHRASE}
              onClick={confirmSave}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              {name} has unsaved changes that will be lost if you close it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmCloseOpen(false)
                onClose()
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
