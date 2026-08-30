import type { ProcessSummary } from '@shared/processes'
import { cn } from '@renderer/lib/utils'
import {
  cnSortableHeader,
  compareProcesses,
  formatCpuPercent,
  formatMemoryPercent,
  formatRss,
  formatRuntime,
  isProcessNoteworthy,
  processDisplayName,
  sortIndicator,
  type ProcessSortKey,
  type ProcessThresholds
} from './processLabels'

interface ProcessesTableProps {
  processes: ProcessSummary[]
  loading: boolean
  thresholds: ProcessThresholds
  sortKey: ProcessSortKey
  sortDirection: 'asc' | 'desc'
  onSort: (key: ProcessSortKey) => void
  onSelect: (process: ProcessSummary) => void
}

const COLUMNS: { key: ProcessSortKey; label: string; className?: string }[] = [
  { key: 'comm', label: 'Name' },
  { key: 'pid', label: 'PID', className: 'w-20' },
  { key: 'user', label: 'User' },
  { key: 'cpuPercent', label: 'CPU', className: 'w-20' },
  { key: 'memoryPercent', label: 'Memory', className: 'w-24' },
  { key: 'elapsedSeconds', label: 'Runtime', className: 'w-24' }
]

export function ProcessesTable({
  processes,
  loading,
  thresholds,
  sortKey,
  sortDirection,
  onSort,
  onSelect
}: ProcessesTableProps) {
  const sorted = [...processes].sort((left, right) =>
    compareProcesses(left, right, sortKey, sortDirection)
  )

  if (loading && processes.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">Reading processes…</p>
  }

  if (sorted.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">No processes match.</p>
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          {COLUMNS.map((column) => (
            <th
              key={column.key}
              className={cn('px-3 py-2 font-medium', column.className, cnSortableHeader(sortKey === column.key))}
              onClick={() => onSort(column.key)}
            >
              {column.label}
              {sortIndicator(sortKey === column.key, sortDirection)}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((process) => (
          <tr
            key={process.pid}
            className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
            onClick={() => onSelect(process)}
          >
            <td className="px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    'size-1.5 shrink-0 rounded-full',
                    isProcessNoteworthy(process, thresholds)
                      ? 'bg-status-warning'
                      : 'bg-text-tertiary'
                  )}
                  aria-hidden
                />
                <span className="truncate font-mono font-medium text-text group-hover:underline">
                  {processDisplayName(process)}
                </span>
              </div>
            </td>
            <td className="px-3 py-2 font-mono text-text-secondary">{process.pid}</td>
            <td className="px-3 py-2 text-text-secondary">{process.user}</td>
            <td className="px-3 py-2 font-mono text-text-secondary">
              {formatCpuPercent(process.cpuPercent)}
            </td>
            <td className="px-3 py-2 text-text-secondary">
              <span className="font-mono">{formatMemoryPercent(process.memoryPercent)}</span>
              <span className="ml-1.5 text-[10px] text-text-tertiary">
                {formatRss(process.rssBytes)}
              </span>
            </td>
            <td className="px-3 py-2 font-mono text-text-secondary">
              {formatRuntime(process.elapsedSeconds)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
