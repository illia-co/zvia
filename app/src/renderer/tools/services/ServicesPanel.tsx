import { useEffect, useMemo, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { SystemdAction, SystemdUnit } from '@shared/systemd'
import { getProtectedSystemdUnitActionBlock } from '@shared/systemd'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { elevationCommand, parseRelayError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useNavigationStore, useToolIntent } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { ServiceDetailView } from './ServiceDetailView'
import { ServicesTable } from './ServicesTable'
import { useServices } from './useServices'

type ServiceFilter = 'all' | 'running' | 'stopped' | 'failed' | 'enabled' | 'disabled'

const FILTERS: { id: ServiceFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'stopped', label: 'Stopped' },
  { id: 'failed', label: 'Failed' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'disabled', label: 'Disabled' }
]

const CONFIRMED_ACTIONS: SystemdAction[] = ['stop', 'disable']

const ACTION_LABELS: Record<SystemdAction, string> = {
  start: 'Start',
  stop: 'Stop',
  restart: 'Restart',
  reload: 'Reload',
  enable: 'Enable',
  disable: 'Disable'
}

function matchesFilter(unit: SystemdUnit, filter: ServiceFilter): boolean {
  switch (filter) {
    case 'running':
      return unit.activeState === 'active'
    case 'stopped':
      return unit.activeState === 'inactive'
    case 'failed':
      return unit.activeState === 'failed'
    case 'enabled':
      return unit.unitFileState === 'enabled'
    case 'disabled':
      return unit.unitFileState === 'disabled'
    default:
      return true
  }
}

export function ServicesPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const openTool = useWorkspaceStore((state) => state.openTool)
  const intent = useToolIntent('services')

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<ServiceFilter>('all')
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<{ unit: string; action: SystemdAction } | null>(
    null
  )
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<RelayErrorPayload | null>(null)
  const [detailRefreshToken, setDetailRefreshToken] = useState(0)

  const isConnected = connectionState === 'connected'
  const { units, available, loading, error, clearError, reload } = useServices({
    serverId,
    isConnected,
    polling: selectedUnit === null
  })

  useEffect(() => {
    setSelectedUnit(null)
    setActionError(null)
  }, [serverId])

  useEffect(() => {
    if (!intent) return
    setSelectedUnit(intent.unit)
  }, [intent])

  const visibleUnits = useMemo(() => {
    const query = search.trim().toLowerCase()
    return units.filter((unit) => {
      if (!matchesFilter(unit, filter)) return false
      if (!query) return true
      return (
        unit.unit.toLowerCase().includes(query) ||
        unit.description.toLowerCase().includes(query)
      )
    })
  }, [filter, search, units])

  const failedCount = useMemo(
    () => units.filter((unit) => unit.activeState === 'failed').length,
    [units]
  )

  const runAction = async (unit: string, action: SystemdAction): Promise<void> => {
    setActionLoading(true)
    setActionError(null)
    try {
      await window.relay.services.action({ serverId, unit, action })
      setDetailRefreshToken((token) => token + 1)
      await reload()
    } catch (err) {
      setActionError(parseRelayError(err))
    } finally {
      setActionLoading(false)
    }
  }

  const requestAction = (unit: string, action: SystemdAction): void => {
    const blockReason = getProtectedSystemdUnitActionBlock(unit, action)
    if (blockReason) {
      setActionError({ code: 'VALIDATION_ERROR', message: blockReason })
      return
    }
    if (CONFIRMED_ACTIONS.includes(action)) {
      setPendingAction({ unit, action })
      return
    }
    void runAction(unit, action)
  }

  const confirmPendingAction = async (): Promise<void> => {
    if (!pendingAction) return
    const { unit, action } = pendingAction
    setPendingAction(null)
    await runAction(unit, action)
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to manage systemd services.
          </p>
        </div>
      </div>
    )
  }

  if (available === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <p className="text-xs text-text-secondary">Checking for systemd…</p>
      </div>
    )
  }

  if (!available) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-text">systemd not available</p>
          <p className="mt-2 text-xs text-text-secondary">
            This server does not expose systemctl, so services cannot be managed here. Use the
            Terminal for the init system this host uses.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => openTool(serverId, 'terminal')}
          >
            Open Terminal
          </Button>
        </div>
      </div>
    )
  }

  const elevation = actionError ? elevationCommand(actionError) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedUnit ? (
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelectedUnit(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">{selectedUnit}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services"
            className="min-w-[140px] flex-1 rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none focus:border-text-tertiary"
          />
          <div className="flex items-center gap-1">
            {FILTERS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFilter(option.id)}
                className={cn(
                  'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                  filter === option.id
                    ? 'bg-bg-secondary text-text'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
            Refresh
          </Button>
        </div>
      )}

      {!selectedUnit && failedCount > 0 && (
        <button
          type="button"
          onClick={() => setFilter('failed')}
          className="border-b border-divider px-3 py-1.5 text-left text-xs text-status-error hover:bg-bg-secondary"
        >
          {failedCount} failed {failedCount === 1 ? 'unit' : 'units'}
        </button>
      )}

      {(error || actionError) && (
        <div className="border-b border-divider p-3">
          {elevation && actionError ? (
            <ElevationRequired serverId={serverId} command={elevation} />
          ) : (
            <ErrorSurface
              error={actionError ?? error ?? ''}
              onDismiss={() => {
                setActionError(null)
                clearError()
              }}
            />
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {selectedUnit ? (
          <ServiceDetailView
            serverId={serverId}
            unit={selectedUnit}
            actionLoading={actionLoading}
            onAction={requestAction}
            refreshToken={detailRefreshToken}
          />
        ) : (
          <ServicesTable
            units={visibleUnits}
            loading={loading}
            actionLoading={actionLoading}
            onSelect={(unit) => setSelectedUnit(unit.unit)}
            onAction={(unit, action) => requestAction(unit.unit, action)}
            onViewLogs={(unit) => openWithIntent(serverId, { tool: 'logs', unit: unit.unit })}
          />
        )}
      </div>

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction ? ACTION_LABELS[pendingAction.action] : ''} service
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.action === 'stop' ? 'Stop' : 'Disable'}{' '}
              <span className="font-mono">{pendingAction?.unit}</span>?{' '}
              {pendingAction?.action === 'stop'
                ? 'Anything depending on this unit will lose it immediately.'
                : 'It will no longer start on boot.'}
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-text-tertiary">Runs as root on the remote server.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => void confirmPendingAction()}
            >
              {pendingAction ? ACTION_LABELS[pendingAction.action] : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
