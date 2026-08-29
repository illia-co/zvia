import type { FirewallRule, PortProtocol } from '@shared/ports'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

export type PendingFirewallChange =
  | { kind: 'allow'; port: number; protocol: PortProtocol }
  | { kind: 'deny'; port: number; protocol: PortProtocol }
  | { kind: 'delete'; rule: FirewallRule }

interface FirewallRuleDialogProps {
  change: PendingFirewallChange | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function describe(change: PendingFirewallChange): {
  title: string
  command: string
  risk: string
  destructive: boolean
} {
  if (change.kind === 'delete') {
    return {
      title: 'Delete firewall rule',
      command: `ufw --force delete ${change.rule.id}`,
      risk: `Traffic currently matched by "${change.rule.raw}" will fall back to the default policy.`,
      destructive: true
    }
  }

  const target = `${change.port}/${change.protocol}`
  if (change.kind === 'allow') {
    return {
      title: 'Allow incoming traffic',
      command: `ufw allow ${target}`,
      risk: `Anything that can reach this server will be able to connect to ${target}.`,
      destructive: false
    }
  }

  return {
    title: 'Block incoming traffic',
    command: `ufw deny ${target}`,
    risk: `Clients that currently depend on ${target} will stop being able to connect.`,
    destructive: true
  }
}

export function FirewallRuleDialog({
  change,
  busy,
  onCancel,
  onConfirm
}: FirewallRuleDialogProps) {
  const details = change ? describe(change) : null

  return (
    <Dialog open={change !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{details?.title}</DialogTitle>
          <DialogDescription>{details?.risk}</DialogDescription>
        </DialogHeader>

        {details && (
          <>
            <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
              {details.command}
            </pre>
            <p className="mt-2 text-[10px] uppercase tracking-wider text-text-tertiary">
              Runs as root on the remote server
            </p>
          </>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={details?.destructive ? 'destructive' : 'default'}
            size="sm"
            disabled={busy}
            onClick={onConfirm}
          >
            {change?.kind === 'delete' ? 'Delete rule' : 'Apply'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
