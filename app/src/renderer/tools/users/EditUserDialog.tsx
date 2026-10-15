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
import { Field } from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'

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
          <Field label="Shell">
            <Input
              value={shell}
              onChange={(event) => setShell(event.target.value)}
              className="mt-1 w-full font-mono"
            />
          </Field>
          <p className="text-[11px] text-text-tertiary">
            GECOS is applied on create only. Use shell changes here; group membership is managed
            separately.
          </p>
          <Field label="Full name (GECOS, read-only)">
            <Input
              value={gecos}
              readOnly
              className="mt-1 w-full bg-bg-secondary text-text-secondary"
            />
          </Field>
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
