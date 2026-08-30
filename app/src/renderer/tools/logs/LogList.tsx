import { useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { LogEntry, LogViewMode } from '@shared/logs'
import { cn } from '@renderer/lib/utils'
import { formatLogTimestamp, formatLogPriority, entryMatchesSearch } from './logFormat'

interface LogListProps {
  entries: LogEntry[]
  search: string
  mode: LogViewMode
  paused: boolean
  onPause: () => void
  loadGeneration: number
  onJumpToLatest: () => void
  selectedIds: Set<string>
  onToggleSelect: (entryId: string) => void
  emptyMessage?: string
}

const ROW_HEIGHT = 20
const BOTTOM_THRESHOLD_PX = 80

export function LogList({
  entries,
  search,
  mode,
  paused,
  loadGeneration,
  onPause,
  onJumpToLatest,
  selectedIds,
  onToggleSelect,
  emptyMessage
}: LogListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const atBottomRef = useRef(true)
  const initialScrollDoneRef = useRef(false)
  const isLive = mode === 'live'

  const visibleEntries = useMemo(
    () => entries.filter((entry) => entryMatchesSearch(entry, search)),
    [entries, search]
  )

  const virtualizer = useVirtualizer({
    count: visibleEntries.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 20
  })

  useEffect(() => {
    initialScrollDoneRef.current = false
  }, [mode, loadGeneration])

  useEffect(() => {
    if (visibleEntries.length === 0) return

    if (isLive) {
      if (paused || !atBottomRef.current) return
      virtualizer.scrollToIndex(visibleEntries.length - 1, { align: 'end' })
      return
    }

    if (!initialScrollDoneRef.current) {
      virtualizer.scrollToIndex(visibleEntries.length - 1, { align: 'end' })
      initialScrollDoneRef.current = true
    }
  }, [isLive, paused, visibleEntries.length, virtualizer])

  const handleScroll = () => {
    const element = parentRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    atBottomRef.current = distanceFromBottom < BOTTOM_THRESHOLD_PX
    if (isLive && !paused && !atBottomRef.current) {
      onPause()
    }
  }

  const handleJumpToLatest = () => {
    atBottomRef.current = true
    onJumpToLatest()
    if (visibleEntries.length > 0) {
      virtualizer.scrollToIndex(visibleEntries.length - 1, { align: 'end' })
    }
  }

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={parentRef}
        onScroll={handleScroll}
        className="h-full overflow-auto bg-bg font-mono text-[11px] leading-5"
      >
        {visibleEntries.length === 0 && emptyMessage ? (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <p className="text-xs text-text-secondary">{emptyMessage}</p>
          </div>
        ) : (
          <div
            className="relative w-full"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const entry = visibleEntries[virtualRow.index]
              if (!entry) return null
              const selected = selectedIds.has(entry.id)
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onToggleSelect(entry.id)}
                  className={cn(
                    'absolute left-0 top-0 flex w-full items-start gap-3 px-3 text-left hover:bg-bg-secondary',
                    selected && 'bg-bg-secondary',
                    entry.priority <= 3 && 'text-status-error',
                    entry.priority === 4 && 'text-status-warning'
                  )}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  <span className="shrink-0 text-text-tertiary">{formatLogTimestamp(entry.timestamp)}</span>
                  <span className="shrink-0 w-10 text-text-secondary">{formatLogPriority(entry.priority)}</span>
                  <span className="shrink-0 w-40 truncate text-text-secondary">{entry.unit ?? '—'}</span>
                  <span className="min-w-0 flex-1 truncate text-text">{entry.message}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {isLive && paused && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            type="button"
            onClick={handleJumpToLatest}
            className="rounded-panel border border-divider bg-bg-elevated px-2.5 py-1 text-xs text-text-secondary shadow-panel"
          >
            New logs below
          </button>
          <button
            type="button"
            onClick={handleJumpToLatest}
            className="rounded-panel border border-divider bg-bg-elevated px-2.5 py-1 text-xs text-text shadow-panel"
          >
            Jump to latest
          </button>
        </div>
      )}
    </div>
  )
}
