import { useEffect, useMemo, useRef, useState } from 'react'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

interface StepEventAlt {
  stepId: string
  state: string
  message?: string
}

interface OutputEvent {
  bytes: Uint8Array
}

interface DoneEvent {
  success: boolean
  output?: string
}

interface WorkflowProgressSubscriptions {
  onStep(listener: (event: StepEventAlt & { serverId: ServerId; streamId: string }) => void): () => void
  onOutput(listener: (event: OutputEvent & { serverId: ServerId; streamId: string }) => void): () => void
  onDone(listener: (event: DoneEvent & { serverId: ServerId; streamId: string }) => void): () => void
}

interface WorkflowStep {
  id: string
  label: string
}

export interface WorkflowProgressProps {
  serverId: ServerId
  streamId: string
  title: string
  subscriptions: WorkflowProgressSubscriptions
  steps: readonly WorkflowStep[]
  onDone: () => void
  onCancel?: () => void
  successMessage: string
  failureMessage: string
  stepStateClass(state: string | undefined): string
}

export function WorkflowProgress({
  serverId,
  streamId,
  title,
  subscriptions,
  steps: workflowSteps,
  onDone,
  onCancel,
  successMessage,
  failureMessage,
  stepStateClass
}: WorkflowProgressProps) {
  const [steps, setSteps] = useState<Record<string, { state: string; message?: string }>>({})
  const [output, setOutput] = useState('')
  const [showOutput, setShowOutput] = useState(false)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const unsubStep = subscriptions.onStep((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      setSteps((current) => ({
        ...current,
        [event.stepId]: { state: event.state, message: event.message }
      }))
    })

    const unsubOutput = subscriptions.onOutput((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      const text = new TextDecoder().decode(event.bytes)
      setOutput((current) => current + text)
    })

    const unsubDone = subscriptions.onDone((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      setFinished(true)
      setFailed(!event.success)
      if (event.output) {
        setOutput((current) => (current ? `${current}\n${event.output}` : event.output ?? ''))
      }
    })

    return () => {
      unsubStep()
      unsubOutput()
      unsubDone()
    }
  }, [serverId, streamId, subscriptions])

  useEffect(() => {
    if (showOutput && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, showOutput])

  const activeStep = useMemo(() => {
    for (const step of workflowSteps) {
      const state = steps[step.id]?.state
      if (!state || state === 'pending' || state === 'running') return step.id
    }
    return null
  }, [steps, workflowSteps])

  const canCancel = Boolean(onCancel) && !finished

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <p className="text-xs font-medium text-text">{title}</p>
        {canCancel && !cancelling && onCancel && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCancelling(true)
              onCancel()
            }}
          >
            Cancel
          </Button>
        )}
        {cancelling && !finished && (
          <span className="text-xs text-text-secondary">Cancelling…</span>
        )}
        {finished && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Close
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <ul className="space-y-2">
          {workflowSteps.map((step) => {
            const entry = steps[step.id]
            const state = entry?.state ?? (activeStep === step.id ? 'running' : 'pending')
            return (
              <li key={step.id} className="border-b border-divider pb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs', stepStateClass(state))}>{step.label}</span>
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                    {state}
                  </span>
                </div>
                {entry?.message && (
                  <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
                    {entry.message}
                  </p>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          className="mt-4 text-xs text-text-secondary hover:text-text"
          onClick={() => setShowOutput((value) => !value)}
        >
          {showOutput ? 'Hide output' : 'Show output'}
        </button>

        {showOutput && (
          <pre
            ref={outputRef}
            className="mt-2 max-h-48 overflow-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] leading-relaxed text-text-secondary"
          >
            {output || 'Waiting for command output…'}
          </pre>
        )}

        {finished && (
          <p
            className={cn(
              'mt-4 text-xs',
              failed ? 'text-status-error' : 'text-status-healthy'
            )}
          >
            {failed ? failureMessage : successMessage}
          </p>
        )}
      </div>
    </div>
  )
}
