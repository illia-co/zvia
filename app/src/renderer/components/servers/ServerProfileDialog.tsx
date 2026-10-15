import { useEffect, useState } from 'react'
import type { ConnectionTestRequest, ProfileCreateRequest, ProfileUpdateRequest } from '@shared/ipc'
import type { AuthMethod } from '@shared/server'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { humanizeError, parseZviaError } from '@renderer/lib/errors'
import { DEFAULT_TOOL } from '@renderer/lib/tools'
import { useServerStore } from '@renderer/state/serverStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'

interface ServerProfileDialogProps {
  mode: 'add' | 'edit'
  serverId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

function createTestSessionId(): string {
  return `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

const AUTH_OPTIONS: Array<{ value: 'ssh-agent' | 'key-file'; label: string }> = [
  { value: 'ssh-agent', label: 'SSH Agent' },
  { value: 'key-file', label: 'Private Key File' }
]

export function ServerProfileDialog({
  mode,
  serverId,
  open,
  onOpenChange
}: ServerProfileDialogProps) {
  const profiles = useServerStore((s) => s.profiles)
  const createProfile = useServerStore((s) => s.createProfile)
  const updateProfile = useServerStore((s) => s.updateProfile)
  const testConnection = useServerStore((s) => s.testConnection)
  const openTool = useWorkspaceStore((s) => s.openTool)

  const existingProfile = mode === 'edit' && serverId ? profiles.find((p) => p.id === serverId) : null

  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [username, setUsername] = useState('')
  const [port, setPort] = useState('22')
  const [keyPath, setKeyPath] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [authType, setAuthType] = useState<'ssh-agent' | 'key-file'>('ssh-agent')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSubmitError(null)
    if (mode === 'edit' && existingProfile) {
      setName(existingProfile.name)
      setHostname(existingProfile.hostname)
      setUsername(existingProfile.username)
      setPort(String(existingProfile.port))
      setAuthType(existingProfile.auth.type)
      setKeyPath(existingProfile.auth.type === 'key-file' ? existingProfile.auth.privateKeyPath : '')
      setPassphrase('')
    } else if (mode === 'add') {
      setName('')
      setHostname('')
      setUsername('')
      setPort('22')
      setKeyPath('')
      setPassphrase('')
      setAuthType('ssh-agent')
    }
  }, [open, mode, existingProfile])

  const buildAuth = (): AuthMethod => {
    if (authType === 'ssh-agent') {
      return { type: 'ssh-agent' }
    }
    const trimmedPassphrase = passphrase.trim()
    const hasStoredPassphrase =
      mode === 'edit' &&
      existingProfile?.auth.type === 'key-file' &&
      existingProfile.auth.hasPassphrase
    return {
      type: 'key-file',
      privateKeyPath: keyPath.trim(),
      hasPassphrase: Boolean(trimmedPassphrase) || Boolean(hasStoredPassphrase)
    }
  }

  const buildTestRequest = (): ConnectionTestRequest => {
    const auth = buildAuth()
    const trimmedPassphrase = passphrase.trim()
    const request: ConnectionTestRequest = {
      hostname: hostname.trim(),
      username: username.trim(),
      port: Number(port) || 22,
      auth,
      serverId: mode === 'edit' && serverId ? serverId : createTestSessionId()
    }
    if (trimmedPassphrase) {
      request.passphrase = trimmedPassphrase
    }
    return request
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      await testConnection(buildTestRequest())

      if (mode === 'add') {
        const auth = buildAuth()
        const createRequest: ProfileCreateRequest = {
          name: name.trim(),
          hostname: hostname.trim(),
          username: username.trim(),
          port: Number(port) || 22,
          auth
        }
        const trimmedPassphrase = passphrase.trim()
        if (trimmedPassphrase) {
          createRequest.passphrase = trimmedPassphrase
        }
        const profile = await createProfile(createRequest)
        openTool(profile.id, DEFAULT_TOOL)
      } else if (serverId) {
        const auth = buildAuth()
        const updateRequest: ProfileUpdateRequest = {
          id: serverId,
          name: name.trim(),
          hostname: hostname.trim(),
          username: username.trim(),
          port: Number(port) || 22,
          auth
        }
        const trimmedPassphrase = passphrase.trim()
        if (trimmedPassphrase) {
          updateRequest.passphrase = trimmedPassphrase
        }
        await updateProfile(updateRequest)
      }

      onOpenChange(false)
    } catch (error) {
      const parsed = parseZviaError(error)
      setSubmitError(
        `${humanizeError(parsed)} Check hostname, port, username, and credentials, then try again.`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasStoredPassphrase =
    mode === 'edit' &&
    existingProfile?.auth.type === 'key-file' &&
    existingProfile.auth.hasPassphrase

  if (mode === 'edit' && open && serverId && !existingProfile) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>{mode === 'add' ? 'Add Server' : 'Edit Server'}</DialogTitle>
            <DialogDescription>
              {mode === 'add'
                ? 'Create a connection profile. Credentials stay in the main process.'
                : 'Update connection settings. Credentials are tested before saving.'}
            </DialogDescription>
          </DialogHeader>

          {submitError && (
            <div className="mt-3">
              <ErrorSurface error={submitError} />
            </div>
          )}

          <div className="space-y-3">
            <Field label="Name">
              <Input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full text-sm"
                placeholder="Production"
              />
            </Field>
            <Field label="Hostname">
              <Input
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="mt-1 w-full text-sm"
                placeholder="203.0.113.10"
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Username" className="col-span-2">
                <Input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full text-sm"
                  placeholder="ubuntu"
                />
              </Field>
              <Field label="Port">
                <Input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="mt-1 w-full text-sm"
                />
              </Field>
            </div>
            <div className="block">
              <span className="text-xs text-text-secondary">Authentication</span>
              <Select
                value={authType}
                onValueChange={(value) => setAuthType(value as 'ssh-agent' | 'key-file')}
              >
                <SelectTrigger className="mt-1 w-full py-1.5 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="z-[60]">
                  {AUTH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {authType === 'key-file' && (
              <>
                <Field label="Private key path">
                  <Input
                    required
                    value={keyPath}
                    onChange={(e) => setKeyPath(e.target.value)}
                    className="mt-1 w-full font-mono text-xs"
                    placeholder="~/.ssh/id_ed25519"
                  />
                </Field>
                <Field label="Passphrase">
                  <Input
                    type="password"
                    value={passphrase}
                    onChange={(e) => setPassphrase(e.target.value)}
                    className="mt-1 w-full text-sm"
                    placeholder={
                      hasStoredPassphrase ? 'Leave blank to keep existing' : 'Optional'
                    }
                    autoComplete="off"
                  />
                </Field>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? 'Testing connection…'
                : mode === 'add'
                  ? 'Add Server'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
