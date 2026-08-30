import { useEffect, useState } from 'react'
import type { PackageDetail } from '@shared/packages'
import { normalizePackageDetail } from '@shared/packages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'

interface InstallPackageDialogProps {
  open: boolean
  detail: PackageDetail | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (version?: string) => void
}

function installVersions(detail: PackageDetail): string[] {
  const normalized = normalizePackageDetail(detail)
  if (normalized.availableVersions.length > 0) return normalized.availableVersions
  if (normalized.candidateVersion) return [normalized.candidateVersion]
  if (normalized.version) return [normalized.version]
  return []
}

function defaultInstallVersion(detail: PackageDetail): string | null {
  const normalized = normalizePackageDetail(detail)
  return normalized.candidateVersion ?? installVersions(normalized)[0] ?? null
}

function buildInstallCommand(packageName: string, version?: string): string {
  if (version) return `apt-get install -y ${packageName}=${version}`
  return `apt-get install -y ${packageName}`
}

export function InstallPackageDialog({
  open,
  detail,
  loading,
  onOpenChange,
  onConfirm
}: InstallPackageDialogProps) {
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null)

  useEffect(() => {
    if (!detail) {
      setSelectedVersion(null)
      return
    }
    setSelectedVersion(defaultInstallVersion(detail))
  }, [detail])

  if (!detail) return null

  const normalizedDetail = normalizePackageDetail(detail)
  const versions = installVersions(normalizedDetail)
  const latestVersion = normalizedDetail.candidateVersion ?? versions[0] ?? null
  const pinnedVersion =
    selectedVersion && latestVersion && selectedVersion !== latestVersion
      ? selectedVersion
      : undefined
  const command = buildInstallCommand(normalizedDetail.name, pinnedVersion)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {normalizedDetail.name}</DialogTitle>
          <DialogDescription>
            Review the package details before installing on the selected server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ServerScopeNotice />

          <div className="space-y-2 text-xs">
            <p className="text-text">{normalizedDetail.description}</p>

            {versions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-text-tertiary">Version</p>
                {versions.length === 1 ? (
                  <p className="font-mono text-text">{versions[0]}</p>
                ) : (
                  <Select
                    value={selectedVersion ?? undefined}
                    onValueChange={setSelectedVersion}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select version" />
                    </SelectTrigger>
                    <SelectContent>
                      {versions.map((version) => (
                        <SelectItem key={version} value={version}>
                          <span className="font-mono">
                            {version}
                            {version === latestVersion ? ' (latest)' : ''}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {normalizedDetail.dependencies.length > 0 && (
              <div>
                <p className="text-text-tertiary">Dependencies</p>
                <p className="font-mono text-text-secondary">
                  {normalizedDetail.dependencies.join(', ')}
                </p>
              </div>
            )}
          </div>

          <div className="rounded-sm bg-bg-secondary p-2 font-mono text-[11px] text-text-secondary">
            {command}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={loading || !selectedVersion} onClick={() => onConfirm(pinnedVersion)}>
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
