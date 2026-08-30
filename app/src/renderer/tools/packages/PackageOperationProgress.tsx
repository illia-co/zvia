import { useEffect, useMemo, useRef, useState } from 'react'
import type { ServerId } from '@shared/server'
import type { PackageOperationStepId, PackageWorkflowStepState } from '@shared/packages'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'

const INSTALL_STEPS: { id: PackageOperationStepId; label: string }[] = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'resolve-dependencies', label: 'Resolve dependencies' },
  { id: 'download', label: 'Download packages' },
  { id: 'install', label: 'Install packages' },
  { id: 'verify', label: 'Verify installation' }
]

const REMOVE_STEPS: { id: PackageOperationStepId; label: string }[] = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'remove', label: 'Remove package' }
]

const UPGRADE_STEPS: { id: PackageOperationStepId; label: string }[] = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'upgrade', label: 'Upgrade packages' },
  { id: 'verify', label: 'Verify installation' }
]

function stepStateClass(state: PackageWorkflowStepState | undefined): string {
  switch (state) {
    case 'done':
      return 'text-status-healthy'
    case 'failed':
      return 'text-status-error'
    case 'running':
      return 'text-text'
    default:
      return 'text-text-tertiary'
  }
}

interface PackageOperationProgressProps {
  serverId: ServerId
  streamId: string
  title: string
  steps: PackageOperationStepId[]
  onDone: () => void
  onCancel: () => void
}

export function PackageOperationProgress({
  serverId,
  streamId,
  title,
  steps: stepIds,
  onDone,
  onCancel
}: PackageOperationProgressProps) {
  const [steps, setSteps] = useState<
    Record<string, { state: PackageWorkflowStepState; message?: string }>
  >({})
  const [output, setOutput] = useState('')
  const [showOutput, setShowOutput] = useState(false)
  const [finished, setFinished] = useState(false)
  const [failed, setFailed] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const outputRef = useRef<HTMLPreElement>(null)

  const workflowSteps = useMemo(() => {
    const all = [...INSTALL_STEPS, ...REMOVE_STEPS, ...UPGRADE_STEPS]
    return stepIds.map((id) => all.find((step) => step.id === id) ?? { id, label: id })
  }, [stepIds])

  useEffect(() => {
    const unsubStep = window.zvia.packages.onOperationStep((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      setSteps((current) => ({
        ...current,
        [event.stepId]: { state: event.state, message: event.message }
      }))
    })

    const unsubOutput = window.zvia.packages.onOperationOutput((event) => {
      if (event.serverId !== serverId || event.streamId !== streamId) return
      const text = new TextDecoder().decode(event.bytes)
      setOutput((current) => current + text)
    })

    const unsubDone = window.zvia.packages.onOperationDone((event) => {
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
    for (const step of workflowSteps) {
      const state = steps[step.id]?.state
      if (!state || state === 'pending' || state === 'running') return step.id
    }
    return null
  }, [steps, workflowSteps])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <p className="text-xs font-medium text-text">{title}</p>
        {!finished && !cancelling && (
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
            {failed ? 'Package operation failed.' : 'Package operation completed.'}
          </p>
        )}
      </div>
    </div>
  )
}

export function operationStepsForKind(
  kind: 'install' | 'remove' | 'upgrade' | 'upgrade-all'
): PackageOperationStepId[] {
  switch (kind) {
    case 'install':
      return INSTALL_STEPS.map((step) => step.id)
    case 'remove':
      return REMOVE_STEPS.map((step) => step.id)
    case 'upgrade':
      return UPGRADE_STEPS.map((step) => step.id)
    case 'upgrade-all':
      return ['detect-manager', 'upgrade']
  }
}
