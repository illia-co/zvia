import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { RemoteFileEntry } from '@shared/files'
import { cn } from '@renderer/lib/utils'
import type { SortDirection, SortField } from './fileUtils'
import { formatFileSize, formatModified } from './fileUtils'

interface FileListProps {
  entries: RemoteFileEntry[]
  selectedPaths: Set<string>
  sortField: SortField
  sortDirection: SortDirection
  onSort: (field: SortField) => void
  onOpen: (entry: RemoteFileEntry) => void
  onSelect: (path: string, multi: boolean) => void
  onContextMenu?: (entry: RemoteFileEntry, event: React.MouseEvent) => void
}

const ROW_HEIGHT = 32

function SortIndicator({
  field,
  activeField,
  direction
}: {
  field: SortField
  activeField: SortField
  direction: SortDirection
}) {
  if (field !== activeField) return null
  return <span className="ml-1 text-text-tertiary">{direction === 'asc' ? '↑' : '↓'}</span>
}

function EntryIcon({ type }: { type: RemoteFileEntry['type'] }) {
  if (type === 'directory') return <span className="text-text-secondary">▸</span>
  if (type === 'symlink') return <span className="text-text-tertiary">⇢</span>
  return <span className="text-text-tertiary">·</span>
}

export function FileList({
  entries,
  selectedPaths,
  sortField,
  sortDirection,
  onSort,
  onOpen,
  onSelect,
  onContextMenu
}: FileListProps) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12
  })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_5rem_8rem_5rem] gap-3 border-b border-divider px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
        <button type="button" className="text-left" onClick={() => onSort('name')}>
          Name
          <SortIndicator field="name" activeField={sortField} direction={sortDirection} />
        </button>
        <button type="button" className="text-right" onClick={() => onSort('size')}>
          Size
          <SortIndicator field="size" activeField={sortField} direction={sortDirection} />
        </button>
        <button type="button" className="text-left" onClick={() => onSort('modified')}>
          Modified
          <SortIndicator field="modified" activeField={sortField} direction={sortDirection} />
        </button>
        <button type="button" className="text-left" onClick={() => onSort('permissions')}>
          Perms
          <SortIndicator field="permissions" activeField={sortField} direction={sortDirection} />
        </button>
      </div>

      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-xs text-text-secondary">
            Empty directory
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = entries[virtualRow.index]
              const selected = selectedPaths.has(entry.path)
              return (
                <div
                  key={entry.path}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualRow.size,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                  className={cn(
                    'group grid cursor-pointer grid-cols-[minmax(0,1fr)_5rem_8rem_5rem] items-center gap-3 px-3 text-xs transition-colors duration-default',
                    selected ? 'bg-bg-secondary text-text' : 'text-text hover:bg-bg-secondary'
                  )}
                  onClick={(event) => {
                    onSelect(entry.path, event.metaKey || event.ctrlKey || event.shiftKey)
                  }}
                  onDoubleClick={() => onOpen(entry)}
                  onContextMenu={(event) => onContextMenu?.(entry, event)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <EntryIcon type={entry.type} />
                    <span className="truncate group-hover:underline">{entry.name}</span>
                  </div>
                  <span className="text-right font-mono text-text-secondary">
                    {entry.type === 'directory' ? '—' : formatFileSize(entry.size)}
                  </span>
                  <span className="truncate text-text-secondary">{formatModified(entry.modified)}</span>
                  <span className="truncate font-mono text-text-tertiary">{entry.permissions}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
