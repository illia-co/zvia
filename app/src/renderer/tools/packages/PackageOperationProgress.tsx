import type { ServerId } from '@shared/server'
import type { PackageOperationStepId } from '@shared/packages'
import { WorkflowProgress, type WorkflowProgressProps } from '@renderer/components/WorkflowProgress'
const INSTALL_STEPS = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'resolve-dependencies', label: 'Resolve dependencies' },
  { id: 'download', label: 'Download packages' },
  { id: 'install', label: 'Install packages' },
  { id: 'verify', label: 'Verify installation' }
] as const

const REMOVE_STEPS = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'remove', label: 'Remove package' }
] as const

const UPGRADE_STEPS = [
  { id: 'detect-manager', label: 'Detect package manager' },
  { id: 'upgrade', label: 'Upgrade packages' },
  { id: 'verify', label: 'Verify installation' }
] as const

function stepStateClass(state: string | undefined): string {
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

const ALL_STEPS = [...INSTALL_STEPS, ...REMOVE_STEPS, ...UPGRADE_STEPS]

const SUBSCRIPTIONS: WorkflowProgressProps['subscriptions'] = {
  onStep: (l) => window.zvia.packages.onOperationStep(l),
  onOutput: (l) => window.zvia.packages.onOperationOutput(l),
  onDone: (l) => window.zvia.packages.onOperationDone(l)
}

export function PackageOperationProgress({
  serverId,
  streamId,
  title,
  steps: stepIds,
  onDone,
  onCancel
}: PackageOperationProgressProps) {
  const resolvedSteps = stepIds.map((id) => ALL_STEPS.find((s) => s.id === id) ?? { id, label: id })

  return (
    <WorkflowProgress
      serverId={serverId}
      streamId={streamId}
      title={title}
      subscriptions={SUBSCRIPTIONS}
      steps={resolvedSteps}
      onDone={onDone}
      onCancel={onCancel}
      successMessage="Package operation completed."
      failureMessage="Package operation failed."
      stepStateClass={stepStateClass}
    />
  )
}

export function operationStepsForKind(kind: 'install' | 'remove' | 'upgrade' | 'upgrade-all'): PackageOperationStepId[] {
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
