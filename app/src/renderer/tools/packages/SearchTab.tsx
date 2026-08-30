import type { PackageSearchResult } from '@shared/packages'
import { Button } from '@renderer/components/ui/button'

interface SearchTabProps {
  results: PackageSearchResult[]
  query: string
  loading: boolean
  onQueryChange: (query: string) => void
  onSelect: (packageName: string) => void
  onInstall: (packageName: string) => void
}

export function SearchTab({
  results,
  query,
  loading,
  onQueryChange,
  onSelect,
  onInstall
}: SearchTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-divider px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search packages…"
          className="w-full bg-transparent text-xs text-text outline-none placeholder:text-text-tertiary"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!query.trim() ? (
          <p className="p-4 text-xs text-text-secondary">Search for packages to install.</p>
        ) : loading && results.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">Searching…</p>
        ) : results.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">No packages matched this search.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-primary">
              <tr className="border-b border-divider text-[10px] uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {results.map((result) => (
                <tr
                  key={result.name}
                  className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
                  onClick={() => onSelect(result.name)}
                >
                  <td className="px-3 py-2 font-mono font-medium text-text group-hover:underline">
                    {result.name}
                  </td>
                  <td className="px-3 py-2 text-text-secondary">{result.description}</td>
                  <td className="px-3 py-2 text-right" onClick={(event) => event.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => onInstall(result.name)}>
                      Install
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
