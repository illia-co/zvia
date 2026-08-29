import { useEffect, useState } from 'react'
import type { UserDetail } from '@shared/users'
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

interface DeleteUserDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onConfirm: (removeHome: boolean) => void
}

export function DeleteUserDialog({
  open,
  user,
  submitting,
  onClose,
  onConfirm
}: DeleteUserDialogProps) {
  const [removeHome, setRemoveHome] = useState(false)

  useEffect(() => {
    if (open) setRemoveHome(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Permanently remove <span className="font-mono">{user?.username}</span> from this server.
          </DialogDescription>
        </DialogHeader>

        <ServerScopeNotice />

        <label className="flex items-center gap-2 text-xs text-text-secondary">
          <input
            type="checkbox"
            checked={removeHome}
            onChange={(event) => setRemoveHome(event.target.checked)}
          />
          Remove home directory ({user?.home})
        </label>

        <p className="rounded-panel bg-bg-secondary p-2 font-mono text-[11px] text-text-tertiary">
          {removeHome ? `userdel -r ${user?.username}` : `userdel ${user?.username}`}
        </p>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={submitting}
            onClick={() => onConfirm(removeHome)}
          >
            Delete user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ConfirmUserActionDialogProps {
  open: boolean
  title: string
  description: string
  command: string
  confirmLabel: string
  destructive?: boolean
  submitting: boolean
  onClose: () => void
  onConfirm: () => void
}

function ConfirmUserActionDialog({
  open,
  title,
  description,
  command,
  confirmLabel,
  destructive,
  submitting,
  onClose,
  onConfirm
}: ConfirmUserActionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ServerScopeNotice />
        <p className="rounded-panel bg-bg-secondary p-2 font-mono text-[11px] text-text-tertiary">
          {command}
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            disabled={submitting}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface PasswordDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onConfirm: (password: string) => void
}

export function PasswordDialog({
  open,
  user,
  submitting,
  onClose,
  onConfirm
}: PasswordDialogProps) {
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>
            Set a new password for <span className="font-mono">{user?.username}</span>.
          </DialogDescription>
        </DialogHeader>
        <ServerScopeNotice />
        <label className="block text-xs text-text-secondary">
          New password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-text-tertiary"
            autoFocus
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !password}
            onClick={() => onConfirm(password)}
          >
            Set password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface GroupsDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onConfirm: (addGroups: string[], removeGroups: string[]) => void
}

export function GroupsDialog({ open, user, submitting, onClose, onConfirm }: GroupsDialogProps) {
  const [addGroups, setAddGroups] = useState('')
  const [removeGroups, setRemoveGroups] = useState('')

  useEffect(() => {
    if (!open) return
    setAddGroups('')
    setRemoveGroups('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage groups</DialogTitle>
          <DialogDescription>
            Current groups:{' '}
            <span className="font-mono">{user?.groups.join(', ') || 'none'}</span>
          </DialogDescription>
        </DialogHeader>
        <ServerScopeNotice />
        <label className="block text-xs text-text-secondary">
          Add to groups (comma-separated)
          <input
            value={addGroups}
            onChange={(event) => setAddGroups(event.target.value)}
            className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
          />
        </label>
        <label className="block text-xs text-text-secondary">
          Remove from groups (comma-separated)
          <input
            value={removeGroups}
            onChange={(event) => setRemoveGroups(event.target.value)}
            className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || (!addGroups.trim() && !removeGroups.trim())}
            onClick={() =>
              onConfirm(
                addGroups
                  .split(',')
                  .map((group) => group.trim())
                  .filter(Boolean),
                removeGroups
                  .split(',')
                  .map((group) => group.trim())
                  .filter(Boolean)
              )
            }
          >
            Update groups
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface ChangeShellDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onConfirm: (shell: string) => void
}

export function ChangeShellDialog({
  open,
  user,
  submitting,
  onClose,
  onConfirm
}: ChangeShellDialogProps) {
  const [shell, setShell] = useState('/bin/bash')

  useEffect(() => {
    if (open && user) setShell(user.shell)
  }, [open, user])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change shell</DialogTitle>
          <DialogDescription>
            Set the login shell for <span className="font-mono">{user?.username}</span>.
          </DialogDescription>
        </DialogHeader>
        <ServerScopeNotice />
        <label className="block text-xs text-text-secondary">
          Shell
          <input
            value={shell}
            onChange={(event) => setShell(event.target.value)}
            className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !shell.trim()}
            onClick={() => onConfirm(shell.trim())}
          >
            Change shell
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface EnableSshDialogProps {
  open: boolean
  user: UserDetail | null
  submitting: boolean
  onClose: () => void
  onConfirm: (publicKey: string) => void
}

export function EnableSshDialog({
  open,
  user,
  submitting,
  onClose,
  onConfirm
}: EnableSshDialogProps) {
  const [publicKey, setPublicKey] = useState('')

  useEffect(() => {
    if (open) setPublicKey('')
  }, [open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable SSH access</DialogTitle>
          <DialogDescription>
            Creates <span className="font-mono">~/.ssh</span> and{' '}
            <span className="font-mono">authorized_keys</span> for{' '}
            <span className="font-mono">{user?.username}</span>. Password SSH is not enabled.
          </DialogDescription>
        </DialogHeader>
        <ServerScopeNotice />
        <label className="block text-xs text-text-secondary">
          Public key (optional)
          <textarea
            value={publicKey}
            onChange={(event) => setPublicKey(event.target.value)}
            rows={4}
            placeholder="ssh-ed25519 AAAA... comment"
            className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={submitting} onClick={() => onConfirm(publicKey.trim())}>
            Enable SSH
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export { ConfirmUserActionDialog }
