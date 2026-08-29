import { useState } from 'react'
import type { ProfileCreateRequest } from '@shared/ipc'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { useServerStore } from '@renderer/state/serverStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'

interface AddServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddServerDialog({ open, onOpenChange }: AddServerDialogProps) {
  const createProfile = useServerStore((s) => s.createProfile)
  const openTool = useWorkspaceStore((s) => s.openTool)
  const [name, setName] = useState('')
  const [hostname, setHostname] = useState('')
  const [username, setUsername] = useState('')
  const [port, setPort] = useState('22')
  const [keyPath, setKeyPath] = useState('')
  const [authType, setAuthType] = useState<'ssh-agent' | 'key-file'>('ssh-agent')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setHostname('')
    setUsername('')
    setPort('22')
    setKeyPath('')
    setAuthType('ssh-agent')
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsSubmitting(true)
    try {
      const request: ProfileCreateRequest = {
        name: name.trim(),
        hostname: hostname.trim(),
        username: username.trim(),
        port: Number(port) || 22,
        auth:
          authType === 'ssh-agent'
            ? { type: 'ssh-agent' }
            : { type: 'key-file', privateKeyPath: keyPath.trim() }
      }
      const profile = await createProfile(request)
      openTool(profile.id, 'overview')
      reset()
      onOpenChange(false)
    } catch {
      // error surfaced via store
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Add Server</DialogTitle>
            <DialogDescription>
              Create a connection profile. Credentials stay in the main process.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <label className="block">
              <span className="text-xs text-text-secondary">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-text-tertiary"
                placeholder="Production"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary">Hostname</span>
              <input
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-text-tertiary"
                placeholder="203.0.113.10"
              />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="col-span-2 block">
                <span className="text-xs text-text-secondary">Username</span>
                <input
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-text-tertiary"
                  placeholder="ubuntu"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-secondary">Port</span>
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-text-tertiary"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-xs text-text-secondary">Authentication</span>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as 'ssh-agent' | 'key-file')}
                className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 text-sm outline-none focus:border-text-tertiary"
              >
                <option value="ssh-agent">SSH Agent</option>
                <option value="key-file">Private Key File</option>
              </select>
            </label>
            {authType === 'key-file' && (
              <label className="block">
                <span className="text-xs text-text-secondary">Private key path</span>
                <input
                  required
                  value={keyPath}
                  onChange={(e) => setKeyPath(e.target.value)}
                  className="mt-1 w-full rounded-panel border border-divider bg-bg px-2.5 py-1.5 font-mono text-xs outline-none focus:border-text-tertiary"
                  placeholder="~/.ssh/id_ed25519"
                />
              </label>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Adding…' : 'Add Server'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
