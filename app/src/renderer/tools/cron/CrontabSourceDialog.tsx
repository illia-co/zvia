import { useCallback, useEffect, useState } from 'react'
import type { CronTarget } from '@shared/cron'
import type { RelayErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseRelayError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'

interface CrontabSourceDialogProps {
  open: boolean
  serverId: ServerId
  /** Crontabs Relay can read on this server, in the order they are offered. */
  targets: CronTarget[]
  onClose: () => void
}

const TARGET_LABELS: Record<CronTarget, string> = {
  user: 'User crontab',
  root: 'Root crontab'
}

/** Shows a crontab exactly as cron stores it, comments and blank lines included. */
export function CrontabSourceDialog({
  open,
  serverId,
  targets,
  onClose
}: CrontabSourceDialogProps) {
  const [target, setTarget] = useState<CronTarget>(targets[0] ?? 'user')
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<RelayErrorPayload | null>(null)

  useEffect(() => {
    if (!open) return
    setTarget(targets[0] ?? 'user')
  }, [open, targets])

  const load = useCallback(async () => {
    setContent(null)
    setError(null)
    try {
      const source = await window.relay.cron.getSource({ serverId, target })
      setContent(source.content)
    } catch (err) {
      setError(parseRelayError(err))
    }
  }, [serverId, target])

  useEffect(() => {
    if (!open) return
    void load()
  }, [load, open])

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crontab source</DialogTitle>
          <DialogDescription>
            The raw crontab as cron stores it. Editing happens through the job list.
          </DialogDescription>
        </DialogHeader>

        {targets.length > 1 && (
          <div className="flex items-center gap-1">
            {targets.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTarget(option)}
                className={cn(
                  'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                  target === option
                    ? 'bg-bg-secondary text-text'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
                )}
              >
                {TARGET_LABELS[option]}
              </button>
            ))}
          </div>
        )}

        {error ? (
          <ErrorSurface error={error} onRetry={() => void load()} />
        ) : content === null ? (
          <p className="text-xs text-text-secondary">Reading crontab…</p>
        ) : content.trim() === '' ? (
          <p className="text-xs text-text-secondary">
            {TARGET_LABELS[target]} is empty on this server.
          </p>
        ) : (
          <pre className="max-h-80 overflow-auto rounded-sm bg-bg-secondary p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
            {content}
          </pre>
        )}

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
