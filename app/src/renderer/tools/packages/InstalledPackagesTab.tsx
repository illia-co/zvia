import type { InstalledPackage } from '@shared/packages'

interface InstalledPackagesTabProps {
  items: InstalledPackage[]
  query: string
  loading: boolean
  onQueryChange: (query: string) => void
  onSelect: (packageName: string) => void
}

export function InstalledPackagesTab({
  items,
  query,
  loading,
  onQueryChange,
  onSelect
}: InstalledPackagesTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-divider px-3 py-2">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Filter installed packages…"
          className="w-full bg-transparent text-xs text-text outline-none placeholder:text-text-tertiary"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && items.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">Loading installed packages…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">No installed packages match this filter.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-primary">
              <tr className="border-b border-divider text-[10px] uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Version</th>
                <th className="px-3 py-2 font-medium">Arch</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Description</th>
              </tr>
            </thead>
            <tbody>
              {items.map((pkg) => (
                <tr
                  key={`${pkg.name}:${pkg.version}`}
                  className="cursor-pointer border-b border-divider hover:bg-bg-secondary"
                  onClick={() => onSelect(pkg.name)}
                >
                  <td className="px-3 py-2 font-mono text-text">{pkg.name}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{pkg.version}</td>
                  <td className="px-3 py-2 text-text-secondary">{pkg.architecture}</td>
                  <td className="hidden px-3 py-2 text-text-secondary md:table-cell">
                    {pkg.description}
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
