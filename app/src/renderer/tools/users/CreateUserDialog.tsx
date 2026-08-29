import { useEffect, useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

interface CreateUserDialogProps {
  open: boolean
  adminGroup: string | null
  submitting: boolean
  onClose: () => void
  onSubmit: (values: {
    username: string
    shell: string
    gecos: string
    groups: string[]
    password: string
    sudo: boolean
    createHome: boolean
  }) => void
}

export function CreateUserDialog({
  open,
  adminGroup,
  submitting,
  onClose,
  onSubmit
}: CreateUserDialogProps) {
  const [username, setUsername] = useState('')
  const [shell, setShell] = useState('/bin/bash')
  const [gecos, setGecos] = useState('')
  const [groups, setGroups] = useState('')
  const [password, setPassword] = useState('')
  const [sudo, setSudo] = useState(false)
  const [createHome, setCreateHome] = useState(true)

  useEffect(() => {
    if (!open) return
    setUsername('')
    setShell('/bin/bash')
    setGecos('')
    setGroups('')
    setPassword('')
    setSudo(false)
    setCreateHome(true)
  }, [open])

  const handleSubmit = (): void => {
    const trimmedUsername = username.trim()
    if (!trimmedUsername) return
    onSubmit({
      username: trimmedUsername,
      shell: shell.trim() || '/bin/bash',
      gecos: gecos.trim(),
      groups: groups
        .split(',')
        .map((group) => group.trim())
        .filter(Boolean),
      password: password.trim(),
      sudo,
      createHome
    })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create a Linux user account on the selected server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block text-xs text-text-secondary">
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
              autoFocus
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Shell
            <input
              value={shell}
              onChange={(event) => setShell(event.target.value)}
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Full name (GECOS)
            <input
              value={gecos}
              onChange={(event) => setGecos(event.target.value)}
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-text-tertiary"
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Supplementary groups (comma-separated)
            <input
              value={groups}
              onChange={(event) => setGroups(event.target.value)}
              placeholder="docker, www-data"
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs text-text outline-none focus:border-text-tertiary"
            />
          </label>
          <label className="block text-xs text-text-secondary">
            Password (optional)
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-xs text-text outline-none focus:border-text-tertiary"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={createHome}
              onChange={(event) => setCreateHome(event.target.checked)}
            />
            Create home directory
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input type="checkbox" checked={sudo} onChange={(event) => setSudo(event.target.checked)} />
            Grant {adminGroup ?? 'sudo'} access
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !username.trim()}
            onClick={handleSubmit}
          >
            Create user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
