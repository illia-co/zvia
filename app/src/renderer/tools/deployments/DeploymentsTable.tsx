import type { Deployment, DeploymentComponentStatus, HealthStatus, TopologyInsight } from '@shared/topology'
import { cn } from '@renderer/lib/utils'
import {
  componentChipClass,
  deploymentHealthDotClass,
  deploymentHealthLabel,
  formatDeploymentIssueSummary,
  listDeploymentComponentIssues,
  listDeploymentComponents
} from './deploymentGraph'

interface DeploymentsTableProps {
  deployments: Deployment[]
  insights: TopologyInsight[]
  loading: boolean
  onSelect: (deployment: Deployment) => void
}

const CHIP_BASE =
  'inline-flex w-fit items-center rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wide'

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-3.5 shrink-0', className)}
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 1.1 10.9 10H1.1L6 1.1zm0 2.4L3.4 9h5.2L6 3.5z" />
      <path d="M5.4 5.2h1.2v2.4H5.4V5.2zm0 3.6h1.2V9.6H5.4V8.8z" />
    </svg>
  )
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-3.5 shrink-0', className)}
      viewBox="0 0 12 12"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M6 1a5 5 0 1 0 0 10A5 5 0 0 0 6 1zm0 1.2A3.8 3.8 0 1 1 6 9.8 3.8 3.8 0 0 1 6 2.2z"
        clipRule="evenodd"
      />
      <path d="M5.4 4.2h1.2v3.6H5.4V4.2zm0 4.8h1.2V9.6H5.4V9z" />
    </svg>
  )
}

function DeploymentStatusCell({
  health,
  componentStatus
}: {
  health: HealthStatus
  componentStatus: DeploymentComponentStatus
}) {
  const issues = listDeploymentComponentIssues(componentStatus)
  const issueSummary =
    issues.length > 0 ? formatDeploymentIssueSummary(issues) : deploymentHealthLabel(health)

  if (health === 'healthy') {
    return (
      <div className="flex items-center gap-2">
        <span
          className={cn('size-1.5 shrink-0 rounded-full', deploymentHealthDotClass(health))}
          aria-hidden
        />
        <span className="text-text-secondary">Healthy</span>
      </div>
    )
  }

  if (health === 'discovering') {
    return <span className="text-text-secondary">Discovering…</span>
  }

  if (health === 'unknown') {
    return <span className="text-text-tertiary">Unknown</span>
  }

  if (health === 'failed') {
    return (
      <div className="flex items-start gap-2">
        <ErrorIcon className="mt-px text-status-error" />
        <span className="leading-snug text-status-error">{issueSummary}</span>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <WarningIcon className="mt-px text-status-warning" />
      <span className="leading-snug text-status-warning">{issueSummary}</span>
    </div>
  )
}

function ComponentChip({ label, status }: { label: string; status: HealthStatus }) {
  return (
    <span className={cn(CHIP_BASE, 'gap-1', componentChipClass(status))}>
      <span
        className={cn('size-1.5 shrink-0 rounded-full', deploymentHealthDotClass(status))}
        aria-hidden
      />
      {label}
    </span>
  )
}

interface DeploymentRowProps {
  deployment: Deployment
  insights: TopologyInsight[]
  onSelect: (deployment: Deployment) => void
}

function DeploymentRow({ deployment, insights, onSelect }: DeploymentRowProps) {
  const relatedInsights = insights.filter((insight) =>
    insight.deploymentIds.includes(deployment.id)
  )
  const components = listDeploymentComponents(deployment.componentStatus)

  return (
    <tr
      className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
      onClick={() => onSelect(deployment)}
    >
      <td className="px-5 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              deploymentHealthDotClass(deployment.health)
            )}
            aria-hidden
          />
          <span className="truncate font-mono font-medium text-text group-hover:underline">
            {deployment.name}
          </span>
        </div>
        {relatedInsights.length > 0 && (
          <p className="mt-1 truncate text-[10px] text-text-secondary">
            {relatedInsights[0]?.label}
            {relatedInsights.length > 1 && ` (+${relatedInsights.length - 1})`}
          </p>
        )}
      </td>
      <td className="px-5 py-2">
        <DeploymentStatusCell
          health={deployment.health}
          componentStatus={deployment.componentStatus}
        />
      </td>
      <td className="px-5 py-2">
        {components.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {components.map((component) => (
              <ComponentChip key={component.key} label={component.label} status={component.status} />
            ))}
          </div>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
    </tr>
  )
}

export function DeploymentsTable({
  deployments,
  insights,
  loading,
  onSelect
}: DeploymentsTableProps) {
  if (loading && deployments.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-text-secondary">
        Discovering nginx, ports, services, and containers…
      </p>
    )
  }

  if (deployments.length === 0) {
    return (
      <p className="p-6 text-center text-xs text-text-secondary">
        No deployments match this filter.
      </p>
    )
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          <th className="px-5 py-2 font-medium">Domain</th>
          <th className="px-5 py-2 font-medium">Status</th>
          <th className="px-5 py-2 font-medium">Components</th>
        </tr>
      </thead>
      <tbody>
        {deployments.map((deployment) => (
          <DeploymentRow
            key={deployment.id}
            deployment={deployment}
            insights={insights}
            onSelect={onSelect}
          />
        ))}
      </tbody>
    </table>
  )
}
