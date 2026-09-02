import type { ServerId } from '@shared/server'
import { WorkflowProgress, type WorkflowProgressProps } from '@renderer/components/WorkflowProgress'

const WORKFLOW_STEPS = [
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
] as const

function stepStateClass(state: string | undefined): string {
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

const SUBSCRIPTIONS: WorkflowProgressProps['subscriptions'] = {
  onStep: (l) => window.zvia.ssl.onWorkflowStep(l),
  onOutput: (l) => window.zvia.ssl.onWorkflowOutput(l),
  onDone: (l) => window.zvia.ssl.onWorkflowDone(l)
}

interface EnableHttpsProgressProps {
  serverId: ServerId
  streamId: string
  onDone: () => void
  onCancel: () => void
}

export function EnableHttpsProgress({ serverId, streamId, onDone, onCancel }: EnableHttpsProgressProps) {
  return (
    <WorkflowProgress
      serverId={serverId}
      streamId={streamId}
      title="Enabling HTTPS"
      subscriptions={SUBSCRIPTIONS}
      steps={WORKFLOW_STEPS}
      onDone={onDone}
      onCancel={onCancel}
      successMessage="HTTPS is enabled."
      failureMessage="HTTPS enablement failed."
      stepStateClass={stepStateClass}
    />
  )
}
