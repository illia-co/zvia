import { useEffect, useState } from 'react'
import type { FirewallRuleAction, PortProtocol } from '@shared/ports'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { SegmentedControl } from '@renderer/components/ui/segmented-control'
import type { PendingFirewallChange } from './FirewallRuleDialog'
import { parseFirewallPortForm } from './firewallForm'

interface FirewallPortDialogProps {
  open: boolean
  sshPort: number
  onCancel: () => void
  onSubmit: (change: PendingFirewallChange) => void
}

const PROTOCOLS: PortProtocol[] = ['tcp', 'udp']

const ACTIONS: { id: FirewallRuleAction; label: string }[] = [
  { id: 'allow', label: 'Open' },
  { id: 'deny', label: 'Close' }
]

/**
 * Collects an arbitrary port to open or close. Confirmation, the exact command
 * and the risk wording all stay in FirewallRuleDialog, which every firewall
 * change in the tool goes through.
 */
export function FirewallPortDialog({
  open,
  sshPort,
  onCancel,
  onSubmit
}: FirewallPortDialogProps) {
  const [port, setPort] = useState('')
  const [protocol, setProtocol] = useState<PortProtocol>('tcp')
  const [action, setAction] = useState<FirewallRuleAction>('allow')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setPort('')
    setProtocol('tcp')
    setAction('allow')
    setError(null)
  }, [open])

  const submit = (): void => {
    const result = parseFirewallPortForm({ port, protocol, action }, sshPort)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSubmit({ kind: result.action, port: result.port, protocol: result.protocol })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Open or close a port</DialogTitle>
          <DialogDescription>
            Adds a ufw rule for any port, whether or not something is listening on it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
              Port
            </span>
            <Input
              autoFocus
              inputMode="numeric"
              value={port}
              onChange={(event) => {
                setPort(event.target.value)
                setError(null)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit()
              }}
              placeholder="8080"
              className="w-24 font-mono"
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
              Protocol
            </span>
            <SegmentedControl
              options={PROTOCOLS.map((value) => ({ id: value, label: value }))}
              value={protocol}
              onChange={(next) => {
                setProtocol(next)
                setError(null)
              }}
            />
          </div>

          <div className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
              Action
            </span>
            <SegmentedControl options={ACTIONS} value={action} onChange={setAction} />
          </div>
        </div>

        {error && <p className="text-xs leading-relaxed text-status-error">{error}</p>}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
