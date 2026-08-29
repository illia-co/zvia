import type { PackageDetail } from '@shared/packages'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'

interface InstallPackageDialogProps {
  open: boolean
  detail: PackageDetail | null
  loading: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function InstallPackageDialog({
  open,
  detail,
  loading,
  onOpenChange,
  onConfirm
}: InstallPackageDialogProps) {
  if (!detail) return null

  const command = `apt-get install -y ${detail.name}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install {detail.name}</DialogTitle>
          <DialogDescription>
            Review the package details before installing on the selected server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <ServerScopeNotice />

          <div className="space-y-2 text-xs">
            <p className="text-text">{detail.description}</p>
            {detail.version && (
              <p className="text-text-secondary">
                Version <span className="font-mono text-text">{detail.version}</span>
              </p>
            )}
            {detail.dependencies.length > 0 && (
              <div>
                <p className="text-text-tertiary">Dependencies</p>
                <p className="font-mono text-text-secondary">
                  {detail.dependencies.join(', ')}
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
          <Button disabled={loading} onClick={onConfirm}>
            Install
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
