import { useCallback, useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import type { LogPriority, LogsQuery, LogStreamStatus, LogTimeRange, LogViewMode } from '@shared/logs'
import { LOG_LINE_PRESETS } from '@shared/logQuery'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import { cn } from '@renderer/lib/utils'

const MODE_OPTIONS: Array<{ id: LogViewMode; label: string }> = [
  { id: 'live', label: 'Live' },
  { id: 'recent', label: 'Recent' }
]

const LINE_OPTIONS = LOG_LINE_PRESETS.map((lines) => ({
  id: String(lines),
  label: lines >= 1000 ? `${lines / 1000}k` : String(lines)
}))

const TIME_RANGE_OPTIONS: Array<{ value: LogTimeRange; label: string }> = [
  { value: 'all', label: 'All time' },
  { value: '15m', label: 'Last 15m' },
  { value: '1h', label: 'Last 1h' },
  { value: '6h', label: 'Last 6h' },
  { value: '24h', label: 'Last 24h' },
  { value: 'today', label: 'Today' }
]

const PRIORITY_OPTIONS: Array<{ value: LogPriority; label: string }> = [
  { value: 'emerg', label: 'Emergency' },
  { value: 'alert', label: 'Alert' },
  { value: 'crit', label: 'Critical' },
  { value: 'err', label: 'Error' },
  { value: 'warning', label: 'Warning' },
  { value: 'notice', label: 'Notice' },
  { value: 'info', label: 'Info' },
  { value: 'debug', label: 'Debug' }
]

interface LogFiltersBarProps {
  search: string
  query: LogsQuery
  status: LogStreamStatus
  paused: boolean
  availableUnits: string[]
  onSearchChange: (value: string) => void
  onQueryChange: (query: LogsQuery | Partial<LogsQuery>) => void
  onClearFilters: () => void
  onCopy: () => void
  canCopy: boolean
  onPause: () => void
  onResume: () => void
  onRefresh: () => void
  onJumpToLatest: () => void
}

function formatLineLabel(lines: number): string {
  if (lines >= 1000) return `${lines / 1000}k`
  return String(lines)
}

function statusLabel(query: LogsQuery, status: LogStreamStatus, paused: boolean): string {
  if (status === 'streaming' && query.mode === 'live') {
    return paused ? '● Paused' : '● Live'
  }
  if (status === 'streaming' && query.mode === 'recent') {
    return 'Loading…'
  }
  if (query.mode === 'recent' && status === 'idle') {
    return `Recent · ${formatLineLabel(query.lines)} lines`
  }
  if (status === 'streaming') return '● Live'
  return status
}

export function LogFiltersBar({
  search,
  query,
  status,
  paused,
  availableUnits,
  onSearchChange,
  onQueryChange,
  onClearFilters,
  onCopy,
  canCopy,
  onPause,
  onResume,
  onRefresh,
  onJumpToLatest
}: LogFiltersBarProps) {
  const [unitPickerOpen, setUnitPickerOpen] = useState(false)

  const hasServerFilters = Boolean(query.timeRange || query.priority || query.unit)
  const isLive = query.mode === 'live'

  const sortedUnits = useMemo(
    () => [...availableUnits].sort((a, b) => a.localeCompare(b)),
    [availableUnits]
  )

  const patchQuery = (patch: Partial<LogsQuery>) => {
    onQueryChange(patch)
  }

  return (
    <div className="border-b border-divider">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <SegmentedControl
          options={MODE_OPTIONS}
          value={query.mode}
          onChange={(mode) => patchQuery({ mode })}
        />

        <div className="flex items-center gap-1">
          {LINE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => patchQuery({ lines: Number(option.id) })}
              className={cn(
                'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                query.lines === Number(option.id)
                  ? 'bg-bg-secondary text-text'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-text-secondary">{statusLabel(query, status, paused)}</span>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          {isLive ? (
            paused ? (
              <Button variant="ghost" size="sm" onClick={onResume}>
                Resume
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={onPause}>
                Pause
              </Button>
            )
          ) : (
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              Refresh
            </Button>
          )}

          <Button variant="ghost" size="sm" onClick={onJumpToLatest}>
            Jump to latest
          </Button>

          <Button variant="ghost" size="sm" onClick={onCopy} disabled={!canCopy}>
            Copy
          </Button>

          <Button variant="ghost" size="sm" onClick={onClearFilters} disabled={!hasServerFilters}>
            Clear filters
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search loaded logs"
          className="min-w-[140px] flex-1"
        />

        <Select
          value={query.timeRange ?? 'all'}
          onValueChange={(value) =>
            patchQuery({ timeRange: value === 'all' ? undefined : (value as LogTimeRange) })
          }
        >
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            {TIME_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={query.priority ?? 'all'}
          onValueChange={(value) =>
            patchQuery({
              priority: value === 'all' ? undefined : (value as LogPriority)
            })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            {PRIORITY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover open={unitPickerOpen} onOpenChange={setUnitPickerOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex min-w-[9rem] items-center justify-between gap-2 rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs outline-none transition-colors duration-default focus:border-text-tertiary',
                query.unit ? 'text-text' : 'text-text-tertiary'
              )}
            >
              <span className="truncate">{query.unit ?? 'All units'}</span>
              <span className="text-[10px] text-text-tertiary">▾</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-0" align="start">
            <Command className="rounded-panel bg-bg-elevated">
              <Command.Input
                placeholder="Search units…"
                className="w-full border-b border-divider bg-transparent px-3 py-2 text-xs outline-none placeholder:text-text-tertiary"
              />
              <Command.List className="max-h-48 overflow-y-auto p-1">
                <Command.Empty className="px-2 py-4 text-center text-xs text-text-secondary">
                  No units found.
                </Command.Empty>
                <Command.Item
                  value="all units"
                  onSelect={() => {
                    patchQuery({ unit: undefined })
                    setUnitPickerOpen(false)
                  }}
                  className="cursor-pointer rounded-sm px-2 py-1.5 text-xs text-text data-[selected=true]:bg-bg-secondary"
                >
                  All units
                </Command.Item>
                {sortedUnits.map((unit) => (
                  <Command.Item
                    key={unit}
                    value={unit}
                    onSelect={() => {
                      patchQuery({ unit })
                      setUnitPickerOpen(false)
                    }}
                    className="cursor-pointer rounded-sm px-2 py-1.5 font-mono text-xs text-text data-[selected=true]:bg-bg-secondary"
                  >
                    {unit}
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  )
}
