import type { PackageUpdate } from '@shared/packages'
import { Button } from '@renderer/components/ui/button'

interface UpdatesTabProps {
  updates: PackageUpdate[]
  loading: boolean
  onSelect: (packageName: string) => void
  onUpgradeAll: () => void
  onUpgrade: (packageName: string) => void
}

export function UpdatesTab({
  updates,
  loading,
  onSelect,
  onUpgradeAll,
  onUpgrade
}: UpdatesTabProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <p className="text-xs text-text-secondary">
          {updates.length} package{updates.length === 1 ? '' : 's'} can be upgraded
        </p>
        <Button
          size="sm"
          variant="ghost"
          disabled={updates.length === 0 || loading}
          onClick={onUpgradeAll}
        >
          Upgrade all
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && updates.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">Loading available updates…</p>
        ) : updates.length === 0 ? (
          <p className="p-4 text-xs text-text-secondary">All packages are up to date.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-primary">
              <tr className="border-b border-divider text-[10px] uppercase tracking-wider text-text-tertiary">
                <th className="px-3 py-2 font-medium">Package</th>
                <th className="px-3 py-2 font-medium">Installed</th>
                <th className="px-3 py-2 font-medium">Candidate</th>
                <th className="px-3 py-2 font-medium">Arch</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {updates.map((update) => (
                <tr key={update.name} className="border-b border-divider hover:bg-bg-secondary">
                  <td
                    className="cursor-pointer px-3 py-2 font-mono text-text"
                    onClick={() => onSelect(update.name)}
                  >
                    {update.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-text-secondary">
                    {update.installedVersion}
                  </td>
                  <td className="px-3 py-2 font-mono text-text">{update.candidateVersion}</td>
                  <td className="px-3 py-2 text-text-secondary">{update.architecture}</td>
                  <td className="px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => onUpgrade(update.name)}>
                      Upgrade
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
