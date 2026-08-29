import { useEffect, useMemo, useRef, useState } from 'react'
import type { ServerId } from '@shared/server'
import type { SslWorkflowStepId, SslWorkflowStepState } from '@shared/ssl'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

const WORKFLOW_STEPS: { id: SslWorkflowStepId; label: string }[] = [
  { id: 'nginx-installed', label: 'nginx installed' },
  { id: 'nginx-running', label: 'nginx running' },
  { id: 'nginx-config-valid', label: 'nginx config valid' },
  { id: 'site-detected', label: 'Site detected' },
  { id: 'domain-configured', label: 'Domain configured' },
  { id: 'ports-reachable', label: 'Ports reachable' },
  { id: 'certbot-available', label: 'Certbot available' },
  { id: 'config-backed-up', label: 'Config backed up' },
  { id: 'certificate-issued', label: 'Certificate issued' },
  { id: 'certificate-verified', label: 'Certificate verified' },
  { id: 'nginx-revalidated', label: 'nginx revalidated' },
  { id: 'nginx-reloaded', label: 'nginx reloaded' },
  { id: 'https-responding', label: 'HTTPS responding' },
  { id: 'auto-renewal-detected', label: 'Auto-renewal detected' }
]

function stepStateClass(state: SslWorkflowStepState | undefined): string {
  switch (state) {
    case 'ok':
      return 'text-status-healthy'
    case 'warning':
      return 'text-status-warning'
    case 'failed':
      return 'text-status-error'
    case 'running':
      return 'text-text'
    case 'skipped':
      return 'text-text-tertiary'
    default:
      return 'text-text-tertiary'
  }
}

interface EnableHttpsProgressProps {
  serverId: ServerId
  streamId: string
  onDone: () => void
  onCancel: () => void
}

export function EnableHttpsProgress({
  serverId,
  streamId,
  onDone,
  onCancel
}: EnableHttpsProgressProps) {
  const [steps, setSteps] = useState<Record<string, { state: SslWorkflowStepState; message?: string }>>(
    {}
  )
  const [output, setOutput] = useState('')
  const [showOutput, setShowOutput] = useState(false)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  useEffect(() => {
    const unsubStep = window.relay.ssl.onWorkflowStep((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      setSteps((current) => ({
        ...current,
        [event.stepId]: { state: event.state, message: event.message }
      }))
    })

    const unsubOutput = window.relay.ssl.onWorkflowOutput((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      const text = new TextDecoder().decode(event.bytes)
      setOutput((current) => current + text)
    })

    const unsubDone = window.relay.ssl.onWorkflowDone((event) => {
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
  }, [serverId, streamId])

  useEffect(() => {
    if (showOutput && outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight
    }
  }, [output, showOutput])

  const activeStep = useMemo(() => {
    for (const step of WORKFLOW_STEPS) {
      const state = steps[step.id]?.state
      if (!state || state === 'pending' || state === 'running') return step.id
    }
    return null
  }, [steps])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <p className="text-xs font-medium text-text">Enabling HTTPS</p>
        {!finished && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        {finished && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            Close
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <ul className="space-y-2">
          {WORKFLOW_STEPS.map((step) => {
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
            {failed ? 'HTTPS enablement failed.' : 'HTTPS is enabled.'}
          </p>
        )}
      </div>
    </div>
  )
}
