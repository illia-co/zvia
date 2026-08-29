import type { PackageDetail } from '@shared/packages'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { packageNavLinks } from './packageCrossLinks'

interface PackageDetailViewProps {
  serverId: ServerId
  detail: PackageDetail
  loading: boolean
  onInstall: (packageName: string) => void
  onRemove: (packageName: string) => void
  onUpgrade: (packageName: string) => void
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-divider py-2">
      <dt className="w-36 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 break-all font-mono text-xs text-text">{value}</dd>
    </div>
  )
}

function ListField({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null
  return (
    <div className="border-b border-divider py-2">
      <p className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">{label}</p>
      <ul className="space-y-1">
        {values.map((value) => (
          <li key={value} className="font-mono text-xs text-text-secondary">
            {value}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PackageDetailView({
  serverId,
  detail,
  loading,
  onInstall,
  onRemove,
  onUpgrade
}: PackageDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const openTool = useWorkspaceStore((state) => state.openTool)
  const version = detail.installed ? detail.installedVersion : detail.version
  const crossLinks = packageNavLinks(serverId, detail.name, openWithIntent, openTool)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <div>
          <p className="font-mono text-sm text-text">{detail.name}</p>
          <p className="text-xs text-text-secondary">{detail.description}</p>
        </div>
        <div className="flex items-center gap-2">
          {!detail.installed && (
            <Button size="sm" disabled={loading} onClick={() => onInstall(detail.name)}>
              Install
            </Button>
          )}
          {detail.installed && (
            <>
              <Button size="sm" variant="ghost" disabled={loading} onClick={() => onUpgrade(detail.name)}>
                Upgrade
              </Button>
              <Button
                size="sm"
                variant="destructive"
                disabled={loading}
                onClick={() => onRemove(detail.name)}
              >
                Remove
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <dl>
          <Field label="Status" value={detail.installed ? 'Installed' : 'Not installed'} />
          {version && <Field label="Version" value={version} />}
          {detail.architecture && <Field label="Architecture" value={detail.architecture} />}
          {detail.homepage && <Field label="Homepage" value={detail.homepage} />}
        </dl>

        <ListField label="Dependencies" values={detail.dependencies} />
        <ListField label="Reverse dependencies" values={detail.reverseDependencies} />

        {detail.installedFiles.length > 0 && (
          <div className="mt-2">
            <p className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">
              Installed files ({detail.installedFiles.length})
            </p>
            <div className="max-h-48 overflow-auto rounded-sm bg-bg-secondary p-2">
              {detail.installedFiles.map((path) => (
                <p key={path} className="font-mono text-[10px] leading-relaxed text-text-secondary">
                  {path}
                </p>
              ))}
            </div>
          </div>
        )}

        {crossLinks.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {crossLinks.map((link) => (
              <Button key={link.label} size="sm" variant="ghost" onClick={link.onClick}>
                {link.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
