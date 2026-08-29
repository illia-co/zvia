import type { PackageOverview } from '@shared/packages'
import { cn } from '@renderer/lib/utils'

interface PackagesOverviewProps {
  overview: PackageOverview | null
  loading: boolean
}

export function PackagesOverview({ overview, loading }: PackagesOverviewProps) {
  if (!overview && loading) {
    return (
      <div className="border-b border-divider px-3 py-2 text-xs text-text-secondary">
        Loading package overview…
      </div>
    )
  }

  if (!overview) return null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-divider px-3 py-2 text-xs">
      <div>
        <span className="text-text-tertiary">Distro </span>
        <span className="text-text">{overview.distro}</span>
      </div>
      <div>
        <span className="text-text-tertiary">Manager </span>
        <span className="text-text">{overview.managerLabel}</span>
      </div>
      <div>
        <span className="text-text-tertiary">Installed </span>
        <span className="font-mono text-text">{overview.installedCount.toLocaleString()}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-text-tertiary">Updates</span>
        <span
          className={cn(
            'rounded-panel px-1.5 py-0.5 font-mono text-[11px]',
            overview.updateCount > 0
              ? 'bg-bg-secondary text-status-warning'
              : 'text-text-secondary'
          )}
        >
          {overview.updateCount.toLocaleString()}
        </span>
      </div>
    </div>
  )
}
