import { useEffect, useMemo, useState } from 'react'
import type { PortListener } from '@shared/ports'
import { describeFirewallEditability } from '@shared/ports'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useNavigationStore, useToolIntent } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { FirewallPortDialog } from './FirewallPortDialog'
import { FirewallRuleDialog, type PendingFirewallChange } from './FirewallRuleDialog'
import { PortDetailView } from './PortDetailView'
import { PortsTable } from './PortsTable'
import { backendLabel, firewallStatusLabel, listenerKey } from './portLabels'
import { usePorts } from './usePorts'

type ExposureFilter = 'all' | 'external' | 'localhost'

const FILTERS: { id: ExposureFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'external', label: 'External' },
  { id: 'localhost', label: 'Localhost' }
]

export function PortsPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const isConnected = connectionState === 'connected'
  const intent = useToolIntent('ports')
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  const [selected, setSelected] = useState<PortListener | null>(null)
  const [filter, setFilter] = useState<ExposureFilter>('all')
  const [search, setSearch] = useState('')
  const [pendingChange, setPendingChange] = useState<PendingFirewallChange | null>(null)
  const [portDialogOpen, setPortDialogOpen] = useState(false)

  const ports = usePorts({ serverId, isConnected, paused: selected !== null })

  useEffect(() => {
    setSelected(null)
    setSearch('')
    setFilter('all')
  }, [serverId])

  useEffect(() => {
    if (!intent?.port || !ports.snapshot) return
    const match = ports.snapshot.listeners.find((listener) => listener.port === intent.port)
    if (match) setSelected(match)
  }, [intent, ports.snapshot])

  const listeners = useMemo(() => {
    const all = ports.snapshot?.listeners ?? []
    const query = search.trim().toLowerCase()
    return all.filter((listener) => {
      if (filter === 'localhost' && listener.exposure !== 'localhost') return false
      if (filter === 'external' && listener.exposure === 'localhost') return false
      if (!query) return true
      return (
        String(listener.port).includes(query) ||
        listener.process.toLowerCase().includes(query) ||
        (listener.unit ?? '').toLowerCase().includes(query) ||
        (listener.containerName ?? '').toLowerCase().includes(query)
      )
    })
  }, [filter, ports.snapshot, search])

  const confirmChange = async (): Promise<void> => {
    if (!pendingChange) return
    if (pendingChange.kind === 'delete') {
      await ports.deleteFirewallRule(pendingChange.rule.id)
    } else {
      await ports.setFirewallRule(
        pendingChange.kind,
        pendingChange.port,
        pendingChange.protocol
      )
    }
    setPendingChange(null)
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to inspect listening ports.
          </p>
        </div>
      </div>
    )
  }

  const errorSurface = ports.elevation ? (
    <div className="border-b border-divider p-3">
      <ElevationRequired serverId={serverId} command={ports.elevation} />
    </div>
  ) : ports.error ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface
        error={ports.error}
        onRetry={() => void ports.refresh()}
        onDismiss={ports.clearError}
      />
    </div>
  ) : null

  const snapshot = ports.snapshot
  const firewallEditability = snapshot
    ? describeFirewallEditability(snapshot.firewall)
    : { editable: false, reason: null }

  const selectedListener =
    selected && snapshot
      ? (snapshot.listeners.find((listener) => listenerKey(listener) === listenerKey(selected)) ??
        selected)
      : selected

  if (selectedListener && snapshot) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelected(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">
            {selectedListener.protocol}/{selectedListener.port}
          </span>
        </div>

        {errorSurface}

        <div className="min-h-0 flex-1">
          <PortDetailView
            serverId={serverId}
            listener={selectedListener}
            snapshot={snapshot}
            firewallUnavailableReason={firewallEditability.reason}
            actionLoading={ports.actionLoading}
            onRequestChange={setPendingChange}
          />
        </div>

        <FirewallRuleDialog
          change={pendingChange}
          sshPort={snapshot.sshPort}
          busy={ports.actionLoading}
          onCancel={() => setPendingChange(null)}
          onConfirm={() => void confirmChange()}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
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

        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search port, process or unit"
          className="ml-auto w-52 rounded-panel border border-divider bg-bg px-2 py-1 text-xs text-text outline-none focus:border-text-tertiary"
        />

        {/* The title sits on the wrapper because a disabled button swallows hover. */}
        <span title={firewallEditability.reason ?? undefined}>
          <Button
            size="sm"
            variant="ghost"
            disabled={!firewallEditability.editable}
            onClick={() => setPortDialogOpen(true)}
          >
            Open or Close Port…
          </Button>
        </span>

        <Button
          size="sm"
          variant="ghost"
          onClick={() => void ports.refresh()}
          disabled={ports.loading}
        >
          Refresh
        </Button>
      </div>

      {snapshot && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-divider px-3 py-2 text-[11px] text-text-secondary">
          <span>
            Firewall{' '}
            <span className="font-mono text-text">{backendLabel(snapshot.firewall.backend)}</span>
          </span>
          <span>
            Status{' '}
            <span className="font-mono text-text">
              {firewallStatusLabel(snapshot.firewall.status)}
            </span>
          </span>
          <span>
            Default in{' '}
            <span className="font-mono text-text">{snapshot.firewall.defaultIncoming}</span>
          </span>
          <span>
            SSH port <span className="font-mono text-text">{snapshot.sshPort}</span>
          </span>
          <span>
            Source <span className="font-mono text-text">{snapshot.source}</span>
          </span>
          {!snapshot.firewall.editable && snapshot.firewall.inspectCommand && (
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={() =>
                openWithIntent(serverId, {
                  tool: 'terminal',
                  prefill: snapshot.firewall.inspectCommand as string
                })
              }
            >
              Inspect in Terminal
            </Button>
          )}
        </div>
      )}

      {firewallEditability.reason && (
        <p className="border-b border-divider px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
          {firewallEditability.reason}
        </p>
      )}

      {errorSurface}

      <div className="min-h-0 flex-1 overflow-auto">
        <PortsTable
          listeners={listeners}
          loading={ports.loading}
          firewallEditable={firewallEditability.editable}
          sshPort={snapshot?.sshPort ?? null}
          actionLoading={ports.actionLoading}
          onSelect={setSelected}
          onRequestChange={setPendingChange}
        />
      </div>

      <FirewallPortDialog
        open={portDialogOpen}
        sshPort={snapshot?.sshPort ?? 22}
        onCancel={() => setPortDialogOpen(false)}
        onSubmit={(change) => {
          setPortDialogOpen(false)
          setPendingChange(change)
        }}
      />

      <FirewallRuleDialog
        change={pendingChange}
        sshPort={snapshot?.sshPort ?? 22}
        busy={ports.actionLoading}
        onCancel={() => setPendingChange(null)}
        onConfirm={() => void confirmChange()}
      />
    </div>
  )
}
