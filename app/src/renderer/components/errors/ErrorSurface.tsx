import { useState } from 'react'
import type { ZviaErrorPayload } from '@shared/errors'
import { humanizeError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

interface ErrorSurfaceProps {
  error: ZviaErrorPayload | string
  className?: string
  onRetry?: () => void
  onDismiss?: () => void
  secondaryAction?: { label: string; onClick: () => void }
}

export function ErrorSurface({
  error,
  className,
  onRetry,
  onDismiss,
  secondaryAction
}: ErrorSurfaceProps) {
  const [showDetails, setShowDetails] = useState(false)
  const payload: ZviaErrorPayload =
    typeof error === 'string' ? { code: 'INTERNAL_ERROR', message: error } : error
  const message = humanizeError(payload)

  return (
    <div className={cn('rounded-panel bg-bg-secondary p-4', className)}>
      <p className="text-sm text-text">{message}</p>
      {payload.details && (
        <div className="mt-2">
          <button
            type="button"
            className="text-xs text-text-secondary underline-offset-2 hover:text-text hover:underline"
            onClick={() => setShowDetails((value) => !value)}
          >
            {showDetails ? 'Hide details' : 'Show details'}
          </button>
          {showDetails && (
            <pre className="mt-2 overflow-x-auto rounded-sm bg-bg p-2 font-mono text-[10px] text-text-secondary">
              {payload.details}
            </pre>
          )}
        </div>
      )}
      {(onRetry || onDismiss || secondaryAction) && (
        <div className="mt-3 flex gap-2">
          {onRetry && (
            <Button size="sm" onClick={onRetry}>
              Retry
            </Button>
          )}
          {secondaryAction && (
            <Button size="sm" variant="ghost" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
