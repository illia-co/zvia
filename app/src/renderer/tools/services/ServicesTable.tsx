import type { SystemdAction, SystemdUnit } from '@shared/systemd'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

export function unitStateDotClass(activeState: string): string {
  switch (activeState) {
    case 'active':
      return 'bg-status-healthy'
    case 'activating':
    case 'deactivating':
    case 'reloading':
      return 'bg-status-warning'
    case 'failed':
      return 'bg-status-error'
    default:
      return 'bg-text-tertiary'
  }
}

export function startupLabel(unitFileState: string): string {
  return unitFileState || '—'
}

interface ServicesTableProps {
  units: SystemdUnit[]
  loading: boolean
  actionLoading: boolean
  onSelect: (unit: SystemdUnit) => void
  onAction: (unit: SystemdUnit, action: SystemdAction) => void
  onViewLogs: (unit: SystemdUnit) => void
}

export function ServicesTable({
  units,
  loading,
  actionLoading,
  onSelect,
  onAction,
  onViewLogs
}: ServicesTableProps) {
  if (loading && units.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading services…</p>
  }

  if (units.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">No services match.</p>
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          <th className="px-3 py-2 font-medium">Unit</th>
          <th className="px-3 py-2 font-medium">State</th>
          <th className="px-3 py-2 font-medium">Startup</th>
          <th className="px-3 py-2 font-medium">Description</th>
          <th className="px-3 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {units.map((unit) => {
          const isRunning = unit.activeState === 'active'
          const isFailed = unit.activeState === 'failed'

          return (
            <tr
              key={unit.unit}
              className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
              onClick={() => onSelect(unit)}
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2 text-left">
                  <span
                    className={cn('size-1.5 shrink-0 rounded-full', unitStateDotClass(unit.activeState))}
                    aria-hidden
                  />
                  <span className="font-medium text-text group-hover:underline">{unit.unit}</span>
                </div>
              </td>
              <td className="px-3 py-2">
                <span className={cn('text-text-secondary', isFailed && 'text-status-error')}>
                  {unit.activeState}
                </span>
                <span className="ml-1.5 text-text-tertiary">{unit.subState}</span>
              </td>
              <td className="px-3 py-2 text-text-secondary">{startupLabel(unit.unitFileState)}</td>
              <td className="max-w-[22rem] truncate px-3 py-2 text-text-secondary">
                {unit.description || '—'}
              </td>
              <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
                <div className="flex flex-wrap gap-1">
                  {isFailed ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => onViewLogs(unit)}>
                        View Logs
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => onAction(unit, 'restart')}
                      >
                        Restart
                      </Button>
                    </>
                  ) : isRunning ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => onAction(unit, 'stop')}
                      >
                        Stop
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={actionLoading}
                        onClick={() => onAction(unit, 'restart')}
                      >
                        Restart
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={actionLoading}
                      onClick={() => onAction(unit, 'start')}
                    >
                      Start
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
