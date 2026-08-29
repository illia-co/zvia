import type { ProcessesSubscriptionInterval } from '@shared/processes'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { cn } from '@renderer/lib/utils'
import {
  DEFAULT_PROCESS_THRESHOLDS,
  liveLabel,
  PROCESS_FILTERS,
  PROCESS_INTERVAL_OPTIONS,
  type ProcessFilter,
  type ProcessThresholds
} from './processLabels'

interface ProcessFiltersProps {
  search: string
  filter: ProcessFilter
  thresholds: ProcessThresholds
  intervalMs: ProcessesSubscriptionInterval
  paused: boolean
  loading: boolean
  onSearchChange: (value: string) => void
  onFilterChange: (filter: ProcessFilter) => void
  onThresholdsChange: (thresholds: ProcessThresholds) => void
  onIntervalChange: (intervalMs: ProcessesSubscriptionInterval) => void
  onRefresh: () => void
}

export function ProcessFilters({
  search,
  filter,
  thresholds,
  intervalMs,
  paused,
  loading,
  onSearchChange,
  onFilterChange,
  onThresholdsChange,
  onIntervalChange,
  onRefresh
}: ProcessFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
      <input
        type="search"
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search processes"
        className="min-w-[140px] flex-1 rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none focus:border-text-tertiary"
      />

      <div className="flex flex-wrap items-center gap-1">
        {PROCESS_FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onFilterChange(option.id)}
            className={cn(
              'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
              filter === option.id
                ? 'bg-bg-secondary text-text'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm">
            Thresholds
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-tertiary">
              High CPU (%)
            </label>
            <Input
              type="number"
              min={1}
              max={100}
              value={thresholds.cpuPercent}
              onChange={(event) =>
                onThresholdsChange({
                  ...thresholds,
                  cpuPercent: Number(event.target.value) || DEFAULT_PROCESS_THRESHOLDS.cpuPercent
                })
              }
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-text-tertiary">
              High memory (MB)
            </label>
            <Input
              type="number"
              min={1}
              value={thresholds.memoryMb}
              onChange={(event) =>
                onThresholdsChange({
                  ...thresholds,
                  memoryMb: Number(event.target.value) || DEFAULT_PROCESS_THRESHOLDS.memoryMb
                })
              }
              className="mt-1"
            />
          </div>
        </PopoverContent>
      </Popover>

      <div className="flex items-center gap-1">
        {PROCESS_INTERVAL_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onIntervalChange(option.value)}
            className={cn(
              'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
              intervalMs === option.value
                ? 'bg-bg-secondary text-text'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="text-xs text-text-secondary">{liveLabel(paused)}</span>

      <Button variant="ghost" size="sm" onClick={() => void onRefresh()} disabled={loading}>
        Refresh
      </Button>
    </div>
  )
}
