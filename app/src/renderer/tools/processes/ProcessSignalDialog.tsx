import type { ProcessSignal } from '@shared/processes'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ServerScopeNotice } from '@renderer/components/ServerScopeNotice'

export interface PendingProcessSignal {
  pid: number
  name: string
  signal: ProcessSignal
}

interface ProcessSignalDialogProps {
  pending: PendingProcessSignal | null
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}

function describe(pending: PendingProcessSignal): {
  title: string
  command: string
  risk: string
  destructive: boolean
  confirmLabel: string
} {
  if (pending.signal === 'kill') {
    return {
      title: 'Force kill process',
      command: `kill -KILL ${pending.pid}`,
      risk: `${pending.name} (PID ${pending.pid}) will be terminated immediately without cleanup.`,
      destructive: true,
      confirmLabel: 'Force Kill'
    }
  }

  return {
    title: 'Terminate process',
    command: `kill -TERM ${pending.pid}`,
    risk: `${pending.name} (PID ${pending.pid}) will be asked to shut down gracefully.`,
    destructive: false,
    confirmLabel: 'Terminate'
  }
}

export function ProcessSignalDialog({
  pending,
  busy,
  onCancel,
  onConfirm
}: ProcessSignalDialogProps) {
  const details = pending ? describe(pending) : null

  return (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{details?.title}</DialogTitle>
          <DialogDescription>{details?.risk}</DialogDescription>
        </DialogHeader>

        {details && (
          <>
            <ServerScopeNotice />
            <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
              {details.command}
            </pre>
            <p className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Runs on the remote server
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
            onClick={() => void onConfirm()}
          >
            {details?.confirmLabel ?? 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
