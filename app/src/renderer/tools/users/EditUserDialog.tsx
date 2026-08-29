import { useEffect, useState } from 'react'
import type { UserDetail } from '@shared/users'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

interface EditUserDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: { shell: string; gecos: string }) => void
}

export function EditUserDialog({ open, user, submitting, onClose, onSubmit }: EditUserDialogProps) {
  const [shell, setShell] = useState('/bin/bash')
  const [gecos, setGecos] = useState('')

  useEffect(() => {
    if (!open || !user) return
    setShell(user.shell)
    setGecos(user.gecos)
  }, [open, user])

  if (!user) return null

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.username}</DialogTitle>
          <DialogDescription>Update shell and display name for this account.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">
            Shell
            <input
              value={shell}
              onChange={(event) => setShell(event.target.value)}
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
            />
          </label>
          <p className="text-[11px] text-text-tertiary">
            GECOS is applied on create only. Use shell changes here; group membership is managed
            separately.
          </p>
          <label className="block text-xs text-text-secondary">
            Full name (GECOS, read-only)
            <input
              value={gecos}
              readOnly
              className="mt-1 w-full rounded-panel border border-divider bg-bg-secondary px-2.5 py-1.5 text-xs text-text-secondary outline-none"
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !shell.trim()}
            onClick={() => onSubmit({ shell: shell.trim(), gecos: gecos.trim() })}
          >
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
