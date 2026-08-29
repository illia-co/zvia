import { useState } from 'react'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

interface TestRenewalDialogProps {
  open: boolean
  certName: string
  actionLoading: boolean
  onClose: () => void
  onConfirm: () => Promise<string | null>
}

export function TestRenewalDialog({
  open,
  certName,
  actionLoading,
  onClose,
  onConfirm
}: TestRenewalDialogProps) {
  const [result, setResult] = useState<string | null>(null)

  const handleConfirm = async (): Promise<void> => {
    const output = await onConfirm()
    if (output) setResult(output)
  }

  const handleClose = (): void => {
    setResult(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test renewal</DialogTitle>
          <DialogDescription>
            Runs <span className="font-mono">certbot renew --cert-name {certName} --dry-run</span>{' '}
            on the server. No certificate is changed.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <pre className="max-h-64 overflow-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] leading-relaxed text-text-secondary">
            {result}
          </pre>
        ) : (
          <p className="text-xs text-text-secondary">
            The dry-run exercises the same renewal path Certbot will use in production, including
            nginx hooks when configured.
          </p>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Close
          </Button>
          {!result && (
            <Button size="sm" disabled={actionLoading} onClick={() => void handleConfirm()}>
              Run dry-run
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
