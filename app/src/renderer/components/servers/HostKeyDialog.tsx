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

export function HostKeyDialog() {
  const hostKeyPrompt = useServerStore((s) => s.hostKeyPrompt)
  const respondToHostKey = useServerStore((s) => s.respondToHostKey)

  return (
    <Dialog open={hostKeyPrompt !== null} onOpenChange={() => undefined}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {hostKeyPrompt?.isChanged ? 'Host key changed' : 'Unknown host key'}
          </DialogTitle>
          <DialogDescription>
            Verify the fingerprint before accepting. Reject if you do not recognize this host.
          </DialogDescription>
        </DialogHeader>

        {hostKeyPrompt && (
          <div className="space-y-2 font-mono text-xs text-text-secondary">
            <p>
              {hostKeyPrompt.hostname}:{hostKeyPrompt.port}
            </p>
            <p className="text-text">{hostKeyPrompt.fingerprint}</p>
            <p className="text-text-tertiary">{hostKeyPrompt.keyType}</p>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => void respondToHostKey('reject')}
          >
            Reject
          </Button>
          <Button onClick={() => void respondToHostKey('accept')}>Accept</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
