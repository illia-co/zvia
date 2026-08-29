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
import { cn } from '@renderer/lib/utils'
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

function SegmentedControl<T extends string>({
  options,
  value,
  onChange
}: {
  options: { id: T; label: string }[]
  value: T
  onChange: (next: T) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
            value === option.id
              ? 'bg-bg-secondary text-text'
              : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

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
            <input
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
              className="w-24 rounded-panel border border-divider bg-bg px-2 py-1 font-mono text-xs text-text outline-none focus:border-text-tertiary"
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
