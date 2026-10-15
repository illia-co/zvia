import { useEffect, useState } from 'react'
import type { ZviaErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { Field } from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import { elevationCommand } from '@renderer/lib/errors'
import { getPasswordPolicyIssues } from '@shared/userPassword'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { PasswordFieldHints } from './PasswordFieldHints'

interface CreateUserDialogProps {
  serverId: ServerId
  open: boolean
  adminGroup: string | null
  submitting: boolean
  error: ZviaErrorPayload | null
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
  serverId,
  open,
  adminGroup,
  submitting,
  error,
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

  const elevation = error ? elevationCommand(error) : null
  const passwordIssues = getPasswordPolicyIssues(password, username.trim())

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !submitting && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Create a Linux user account on the selected server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div>
              {elevation ? (
                <ElevationRequired serverId={serverId} command={elevation} />
              ) : (
                <ErrorSurface error={error} />
              )}
            </div>
          )}

          <div className="space-y-3">
          <Field label="Username">
            <Input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-1 w-full font-mono"
              autoFocus
            />
          </Field>
          <Field label="Shell">
            <Input
              value={shell}
              onChange={(event) => setShell(event.target.value)}
              className="mt-1 w-full font-mono"
            />
          </Field>
          <Field label="Full name (GECOS)">
            <Input
              value={gecos}
              onChange={(event) => setGecos(event.target.value)}
              className="mt-1 w-full"
            />
          </Field>
          <Field label="Supplementary groups (comma-separated)">
            <Input
              value={groups}
              onChange={(event) => setGroups(event.target.value)}
              placeholder="docker, www-data"
              className="mt-1 w-full font-mono"
            />
          </Field>
          <Field label="Password (optional)">
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full"
            />
            <PasswordFieldHints username={username.trim()} password={password} />
          </Field>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <Checkbox
              checked={createHome}
              onCheckedChange={(checked) => setCreateHome(checked === true)}
            />
            Create home directory
          </label>
          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <Checkbox checked={sudo} onCheckedChange={(checked) => setSudo(checked === true)} />
            Grant {adminGroup ?? 'sudo'} access
          </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={submitting || !username.trim() || passwordIssues.length > 0}
            onClick={handleSubmit}
          >
            {submitting ? 'Creating…' : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
