import type { NginxConfigFile, NginxConfigGroup, NginxConfigTree as ConfigTree } from '@shared/nginx'
import { cn } from '@renderer/lib/utils'

interface NginxConfigTreeProps {
  tree: ConfigTree | null
  loading: boolean
  activePath: string | null
  dirtyPaths: Set<string>
  onSelect: (file: NginxConfigFile) => void
}

const GROUP_ORDER: NginxConfigGroup[] = [
  'root',
  'conf.d',
  'sites-enabled',
  'sites-available',
  'snippets',
  'modules-enabled'
]

const GROUP_LABELS: Record<NginxConfigGroup, string> = {
  root: 'Config root',
  'conf.d': 'conf.d',
  'sites-enabled': 'sites-enabled',
  'sites-available': 'sites-available',
  snippets: 'snippets',
  'modules-enabled': 'modules-enabled'
}

export function NginxConfigTree({
  tree,
  loading,
  activePath,
  dirtyPaths,
  onSelect
}: NginxConfigTreeProps) {
  if (loading && !tree) {
    return <p className="p-4 text-xs text-text-secondary">Reading config directory…</p>
  }

  if (!tree || tree.files.length === 0) {
    return <p className="p-4 text-xs text-text-secondary">No config files found.</p>
  }

  return (
    <div className="py-1">
      {GROUP_ORDER.map((group) => {
        const files = tree.files.filter((file) => file.group === group)
        if (files.length === 0) return null

        return (
          <div key={group} className="mb-2">
            <p className="px-3 py-1 text-[10px] uppercase tracking-wider text-text-tertiary">
              {GROUP_LABELS[group]}
            </p>
            {files.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => onSelect(file)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors duration-default',
                  activePath === file.path
                    ? 'bg-bg text-text'
                    : 'text-text-secondary hover:bg-bg hover:text-text'
                )}
              >
                <span className="min-w-0 flex-1 truncate font-mono">{file.name}</span>
                {file.enabled === false && (
                  <span className="shrink-0 text-[10px] text-text-tertiary">disabled</span>
                )}
                {dirtyPaths.has(file.path) && (
                  <span className="shrink-0 text-[10px] text-text-tertiary">unsaved</span>
                )}
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )
}
