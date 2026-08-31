import { useEffect, useMemo, useState } from 'react'
import type { Deployment } from '@shared/topology'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useToolIntent } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { DeploymentDetailView } from './DeploymentDetailView'
import { DeploymentsTable } from './DeploymentsTable'
import { useDeployments } from './useDeployments'

type FilterMode = 'all' | 'degraded'

export function DeploymentsPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const isConnected = connectionState === 'connected'
  const intent = useToolIntent('deployments')

  const [filter, setFilter] = useState<FilterMode>('all')
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)

  const deploymentsState = useDeployments({
    serverId,
    isConnected,
    paused: selectedDeployment !== null
  })

  useEffect(() => {
    setSelectedDeployment(null)
  }, [serverId])

  useEffect(() => {
    if (!deploymentsState.snapshot) return

    if (intent?.deploymentId) {
      const match = deploymentsState.snapshot.deployments.find(
        (deployment) => deployment.id === intent.deploymentId
      )
      if (match) setSelectedDeployment(match)
      return
    }

    if (intent?.entityId) {
      const match = deploymentsState.snapshot.deployments.find((deployment) =>
        deployment.entityIds.includes(intent.entityId!)
      )
      if (match) setSelectedDeployment(match)
    }
  }, [intent, deploymentsState.snapshot])

  const visibleDeployments = useMemo(() => {
    const all = deploymentsState.snapshot?.deployments ?? []
    if (filter === 'degraded') {
      return all.filter(
        (deployment) => deployment.health === 'degraded' || deployment.health === 'failed'
      )
    }
    return all
  }, [deploymentsState.snapshot, filter])

  const busy = deploymentsState.loading || deploymentsState.scanning

  const resolvedDeployment =
    selectedDeployment && deploymentsState.snapshot
      ? (deploymentsState.snapshot.deployments.find(
          (deployment) => deployment.id === selectedDeployment.id
        ) ?? selectedDeployment)
      : selectedDeployment

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to discover application deployments.
          </p>
        </div>
      </div>
    )
  }

  if (resolvedDeployment && deploymentsState.snapshot) {
    return (
      <DeploymentDetailView
        deployment={resolvedDeployment}
        snapshot={deploymentsState.snapshot}
        serverId={serverId}
        initialEntityId={intent?.entityId}
        onBack={() => setSelectedDeployment(null)}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-divider px-3 py-2">
        <div>
          <p className="text-sm text-text">Deployments</p>
          {busy && deploymentsState.scanPhase ? (
            <p className="text-[11px] text-text-secondary">{deploymentsState.scanPhase}</p>
          ) : deploymentsState.snapshot ? (
            <p className="text-[11px] text-text-secondary">
              Scanned {new Date(deploymentsState.snapshot.scannedAt).toLocaleString()} ·{' '}
              {deploymentsState.snapshot.deployments.length} discovered
            </p>
          ) : null}
        </div>
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => void deploymentsState.scan()}
        >
          {deploymentsState.scanning ? 'Scanning…' : 'Refresh'}
        </Button>
      </div>

      <div className="flex items-center gap-1 border-b border-divider px-3 py-2">
        {(['all', 'degraded'] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            className={cn(
              'rounded px-2 py-1 text-[11px] capitalize',
              filter === mode ? 'bg-bg-secondary text-text' : 'text-text-secondary hover:text-text'
            )}
            onClick={() => setFilter(mode)}
          >
            {mode}
          </button>
        ))}
      </div>

      {deploymentsState.error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={deploymentsState.error} />
        </div>
      )}

      {busy && !deploymentsState.snapshot && (
        <div className="flex flex-1 items-center justify-center p-8 text-center">
          <div className="text-xs text-text-secondary">
            <p>{deploymentsState.scanning ? 'Scanning' : 'Loading'} {server.name}…</p>
            <p className="mt-2">
              {deploymentsState.scanPhase ??
                'Discovering nginx, ports, services, and containers'}
            </p>
          </div>
        </div>
      )}

      {deploymentsState.snapshot && deploymentsState.snapshot.warnings.length > 0 && (
        <div className="border-b border-divider px-3 py-2 text-xs text-text-secondary">
          {deploymentsState.snapshot.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}

      {deploymentsState.snapshot && (
        <div className="min-h-0 flex-1 overflow-auto">
          <DeploymentsTable
            deployments={visibleDeployments}
            insights={deploymentsState.snapshot.insights}
            loading={busy}
            onSelect={setSelectedDeployment}
          />
        </div>
      )}
    </div>
  )
}
