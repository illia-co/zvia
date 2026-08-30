import type { FirewallRule, PortProtocol } from '@shared/ports'
import { getFirewallDeleteRuleWarning, getFirewallDenyWarning } from '@shared/ports'
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
  sshPort: number
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function describe(
  change: PendingFirewallChange,
  sshPort: number
): {
  title: string
  command: string
  risk: string
  destructive: boolean
  elevated: boolean
} {
  if (change.kind === 'delete') {
    const deleteWarning = getFirewallDeleteRuleWarning(change.rule, sshPort)
    return {
      title: 'Delete firewall rule',
      command: `ufw --force delete ${change.rule.id}`,
      risk:
        deleteWarning ??
        `Traffic currently matched by "${change.rule.raw}" will fall back to the default policy.`,
      destructive: true,
      elevated: deleteWarning !== null
    }
  }

  const target = `${change.port}/${change.protocol}`
  if (change.kind === 'allow') {
    return {
      title: 'Allow incoming traffic',
      command: `ufw allow ${target}`,
      risk: `Anything that can reach this server will be able to connect to ${target}.`,
      destructive: false,
      elevated: false
    }
  }

  return {
    title: 'Block incoming traffic',
    command: `ufw deny ${target}`,
    risk: getFirewallDenyWarning(change.port, change.protocol),
    destructive: true,
    elevated: true
  }
}

export function FirewallRuleDialog({
  change,
  sshPort,
  busy,
  onCancel,
  onConfirm
}: FirewallRuleDialogProps) {
  const details = change ? describe(change, sshPort) : null

  return (
    <Dialog open={change !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{details?.title}</DialogTitle>
          <DialogDescription>{details?.risk}</DialogDescription>
        </DialogHeader>

        {details && (
          <>
            {details.elevated && (
              <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-text">
                Double-check that you can still reach this server after this change. Relay cannot
                undo a firewall lockout from here.
              </div>
            )}
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
