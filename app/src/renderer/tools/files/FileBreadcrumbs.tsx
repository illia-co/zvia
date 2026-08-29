import { cn } from '@renderer/lib/utils'
import { breadcrumbSegments } from './fileUtils'

interface FileBreadcrumbsProps {
  serverName: string
  path: string
  onNavigate: (path: string) => void
}

export function FileBreadcrumbs({ serverName, path, onNavigate }: FileBreadcrumbsProps) {
  const segments = breadcrumbSegments(path)

  return (
    <div className="flex min-w-0 items-center gap-1 text-xs">
      <span className="shrink-0 font-medium uppercase tracking-wide text-text">
        {serverName}
      </span>
      <span className="shrink-0 text-text-tertiary">/</span>
      {segments.map((segment, index) => (
        <div key={segment.path} className="flex min-w-0 items-center gap-1">
          {index > 0 && <span className="shrink-0 text-text-tertiary">/</span>}
          <button
            type="button"
            onClick={() => onNavigate(segment.path)}
            className={cn(
              'truncate rounded-sm px-1 py-0.5 transition-colors duration-default hover:bg-bg-secondary',
              index === segments.length - 1 ? 'text-text' : 'text-text-secondary hover:text-text'
            )}
          >
            {segment.label}
          </button>
        </div>
      ))}
    </div>
  )
}
