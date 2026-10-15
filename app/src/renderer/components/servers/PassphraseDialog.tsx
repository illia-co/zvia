import { useEffect, useState } from 'react'
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
import { useServerStore } from '@renderer/state/serverStore'

export function PassphraseDialog() {
  const passphrasePrompt = useServerStore((s) => s.passphrasePrompt)
  const respondToPassphrase = useServerStore((s) => s.respondToPassphrase)
  const cancelPassphrase = useServerStore((s) => s.cancelPassphrase)
  const [passphrase, setPassphrase] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (passphrasePrompt) {
      setPassphrase('')
      setIsSubmitting(false)
    }
  }, [passphrasePrompt])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!passphrase) return
    setIsSubmitting(true)
    try {
      await respondToPassphrase(passphrase)
    } finally {
      // Ephemeral only: drop the in-memory copy immediately after send.
      setPassphrase('')
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={passphrasePrompt !== null} onOpenChange={() => undefined}>
      <DialogContent>
        <form onSubmit={(e) => void handleSubmit(e)}>
          <DialogHeader>
            <DialogTitle>Private key needs a passphrase</DialogTitle>
            <DialogDescription>
              Enter the passphrase to unlock the key for this session only.
              It is never stored.
            </DialogDescription>
          </DialogHeader>

          {passphrasePrompt && (
            <div className="space-y-2 font-mono text-xs text-text-secondary">
              <p>{passphrasePrompt.keyLabel}</p>
              <p className="text-text-tertiary">{passphrasePrompt.hostname}</p>
            </div>
          )}

          <Field label="Passphrase" className="mt-3">
            <Input
              type="password"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="mt-1 w-full text-sm"
              placeholder="Key passphrase"
              autoComplete="off"
              autoFocus
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => void cancelPassphrase()}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!passphrase || isSubmitting}>
              {isSubmitting ? 'Unlocking…' : 'Unlock'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
