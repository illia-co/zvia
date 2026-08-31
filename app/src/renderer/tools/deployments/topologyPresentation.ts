import type {
  Deployment,
  DeploymentComponentStatus,
  HealthStatus,
  TopologyEntity
} from '@shared/topology'

const KIND_LABELS: Record<TopologyEntity['kind'], string> = {
  deployment: 'Deployment',
  domain: 'Domain',
  nginx_site: 'Nginx',
  ssl_certificate: 'SSL',
  port: 'Port',
  process: 'Process',
  systemd_unit: 'Service',
  docker_container: 'Container',
  docker_compose_service: 'Compose',
  file_path: 'Files',
  database: 'Database',
  runtime: 'Runtime'
}

export function entityKindLabel(kind: TopologyEntity['kind']): string {
  return KIND_LABELS[kind] ?? kind
}

export function deploymentHealthDotClass(health: Deployment['health']): string {
  return entityStatusDotClass(health)
}

export const DEPLOYMENT_COMPONENT_LABELS: Record<keyof DeploymentComponentStatus, string> = {
  ssl: 'SSL',
  nginx: 'Nginx',
  backend: 'Backend',
  service: 'Service',
  files: 'Files',
  container: 'Container'
}

export interface DeploymentComponentEntry {
  key: keyof DeploymentComponentStatus
  label: string
  status: HealthStatus
}

export function listDeploymentComponents(
  componentStatus: DeploymentComponentStatus
): DeploymentComponentEntry[] {
  return (Object.keys(DEPLOYMENT_COMPONENT_LABELS) as Array<keyof DeploymentComponentStatus>)
    .filter((key) => componentStatus[key] !== undefined)
    .map((key) => ({
      key,
      label: DEPLOYMENT_COMPONENT_LABELS[key],
      status: componentStatus[key]!
    }))
}

export function listDeploymentComponentIssues(
  componentStatus: DeploymentComponentStatus
): DeploymentComponentEntry[] {
  return listDeploymentComponents(componentStatus).filter(
    (component) => component.status === 'degraded' || component.status === 'failed'
  )
}

export function formatComponentIssueMessage(issue: DeploymentComponentEntry): string {
  if (issue.status === 'failed') {
    return `${issue.label} failed`
  }
  return `${issue.label} degraded`
}

export function formatDeploymentIssueSummary(issues: DeploymentComponentEntry[]): string {
  return issues.map(formatComponentIssueMessage).join(' · ')
}

export function deploymentHealthLabel(health: HealthStatus): string {
  switch (health) {
    case 'healthy':
      return 'Healthy'
    case 'degraded':
      return 'Degraded'
    case 'failed':
      return 'Failed'
    case 'discovering':
      return 'Discovering'
    default:
      return 'Unknown'
  }
}

export function healthChipClass(health: HealthStatus): string {
  switch (health) {
    case 'healthy':
      return 'bg-status-healthy/15 text-status-healthy'
    case 'degraded':
      return 'bg-status-warning/15 text-status-warning'
    case 'failed':
      return 'bg-status-error/15 text-status-error'
    case 'discovering':
      return 'bg-bg-secondary text-text-secondary'
    default:
      return 'bg-bg-secondary text-text-tertiary'
  }
}

export function componentChipClass(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'bg-bg-secondary text-text-secondary'
    case 'degraded':
      return 'bg-status-warning/15 text-status-warning'
    case 'failed':
      return 'bg-status-error/15 text-status-error'
    case 'discovering':
      return 'bg-bg-secondary text-text-tertiary'
    default:
      return 'bg-bg-secondary text-text-tertiary'
  }
}

export function entityStatusDotClass(status: TopologyEntity['status']): string {
  switch (status) {
    case 'healthy':
      return 'bg-status-healthy'
    case 'degraded':
      return 'bg-status-warning'
    case 'failed':
      return 'bg-status-error'
    case 'discovering':
      return 'bg-text-secondary'
    default:
      return 'bg-text-tertiary'
  }
}

export function entityStatusBorderClass(
  status: TopologyEntity['status'],
  options: { selected?: boolean; isEntrypoint?: boolean } = {}
): string {
  const { selected = false, isEntrypoint = false } = options

  switch (status) {
    case 'failed':
      return selected ? 'border-status-error' : 'border-status-error/60'
    case 'degraded':
      return selected ? 'border-status-warning' : 'border-status-warning/60'
    default:
      if (selected) return 'border-text-tertiary'
      if (isEntrypoint) return 'border-text-tertiary/60'
      return 'border-divider'
  }
}
