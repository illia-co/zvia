import { useCallback, useEffect, useState } from 'react'
import type { NginxAction } from '@shared/nginx'
import type { SslOverview } from '@shared/ssl'
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
import { usePanelId } from '@renderer/state/PanelContext'
import { usePanelStateStore } from '@renderer/state/panelStateStore'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useNavigationStore, useToolIntent } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { NginxConfigTab } from './NginxConfigTab'
import { NginxLogsView } from './NginxLogsView'
import { NginxNotInstalled } from './NginxNotInstalled'
import { NginxOverviewTab } from './NginxOverviewTab'
import { useNginx } from './useNginx'

type NginxTab = 'overview' | 'config' | 'logs'

const TABS: { id: NginxTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'config', label: 'Config' },
  { id: 'logs', label: 'Logs' }
]

function stateDotClass(activeState: string | null): string {
  if (activeState === 'active') return 'bg-status-healthy'
  if (activeState === 'activating' || activeState === 'reloading') return 'bg-status-warning'
  if (activeState === 'failed') return 'bg-status-error'
  return 'bg-text-tertiary'
}

export function NginxPanel() {
  const { serverId, server, connectionState } = useRequiredServerContext()
  const isConnected = connectionState === 'connected'
  const panelId = usePanelId()
  const registerPanelDirty = usePanelStateStore((state) => state.registerPanelDirty)
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  const intent = useToolIntent('nginx')

  const [activeTab, setActiveTab] = useState<NginxTab>('overview')
  const [pendingAction, setPendingAction] = useState<Exclude<NginxAction, 'reload'> | null>(null)
  const [configPathIntent, setConfigPathIntent] = useState<string | undefined>(undefined)
  const [sslOverview, setSslOverview] = useState<SslOverview | null>(null)
  const nginx = useNginx({ serverId, isConnected })

  const handleDirtyChange = useCallback(
    (dirty: boolean) => {
      registerPanelDirty(panelId, dirty ? { kind: 'files' } : null)
    },
    [panelId, registerPanelDirty]
  )

  useEffect(() => () => registerPanelDirty(panelId, null), [panelId, registerPanelDirty])

  useEffect(() => {
    if (!intent?.configPath) return
    setActiveTab('config')
    setConfigPathIntent(intent.configPath)
  }, [intent])

  useEffect(() => {
    if (!isConnected) {
      setSslOverview(null)
      return
    }
    void window.relay.ssl.overview({ serverId }).then(setSslOverview).catch(() => setSslOverview(null))
  }, [isConnected, serverId])

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to {server.name} to manage nginx.
          </p>
        </div>
      </div>
    )
  }

  const status = nginx.status

  const errorSurface = nginx.elevation ? (
    <div className="border-b border-divider p-3">
      <ElevationRequired serverId={serverId} command={nginx.elevation} />
    </div>
  ) : nginx.error ? (
    <div className="border-b border-divider p-3">
      <ErrorSurface
        error={nginx.error}
        onRetry={() => void nginx.refresh()}
        onDismiss={nginx.clearError}
      />
    </div>
  ) : null

  if (!status) {
    return (
      <div className="flex h-full flex-col">
        {errorSurface ?? (
          <p className="p-6 text-center text-xs text-text-secondary">Detecting nginx…</p>
        )}
      </div>
    )
  }

  if (!status.installed) {
    return <NginxNotInstalled serverId={serverId} />
  }

  const isActive = status.activeState === 'active'

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-divider px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('size-1.5 rounded-full', stateDotClass(status.activeState))} aria-hidden />
          <span className="text-xs font-medium text-text">nginx</span>
          {status.version && (
            <span className="font-mono text-[11px] text-text-secondary">{status.version}</span>
          )}
          <span className="text-[11px] text-text-secondary">
            {status.activeState ?? 'unknown'}
            {status.subState ? ` · ${status.subState}` : ''}
          </span>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            disabled={nginx.actionLoading}
            onClick={() => void nginx.validate()}
          >
            Test configuration
          </Button>
          <Button
            size="sm"
            disabled={nginx.actionLoading || !status.canReload || !isActive}
            onClick={() => void nginx.runAction('reload')}
          >
            Reload
          </Button>
          {isActive ? (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={nginx.actionLoading}
                onClick={() => setPendingAction('restart')}
              >
                Restart
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={nginx.actionLoading}
                onClick={() => setPendingAction('stop')}
              >
                Stop
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={nginx.actionLoading}
              onClick={() => void nginx.runAction('start')}
            >
              Start
            </Button>
          )}
        </div>
      </div>

      {!status.canReload && (
        <p className="border-b border-divider px-3 py-1.5 text-[11px] text-text-secondary">
          The configuration changed since the last successful test. Run Test configuration to enable
          Reload.
        </p>
      )}

      {errorSurface}

      <div className="flex items-center gap-1 border-b border-divider px-2 py-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
              activeTab === tab.id
                ? 'bg-bg-secondary text-text'
                : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
            )}
          >
            {tab.label}
          </button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          className="ml-auto"
          disabled={nginx.loading}
          onClick={() => void nginx.refresh()}
        >
          Refresh
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === 'overview' && (
          <NginxOverviewTab
            serverId={serverId}
            status={status}
            sslOverview={sslOverview}
            onOpenService={() =>
              openWithIntent(serverId, {
                tool: 'services',
                unit: 'nginx.service',
                view: 'detail'
              })
            }
          />
        )}
        {activeTab === 'config' && (
          <NginxConfigTab
            serverId={serverId}
            initialPath={configPathIntent}
            onSaved={() => void nginx.refresh()}
            onDirtyChange={handleDirtyChange}
          />
        )}
        {activeTab === 'logs' && <NginxLogsView serverId={serverId} />}
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction === 'stop' ? 'Stop nginx' : 'Restart nginx'}
            </DialogTitle>
            <DialogDescription>
              {pendingAction === 'stop'
                ? 'Every site served by this nginx will stop responding until it is started again.'
                : 'Restarting drops in-flight connections. Reload applies config changes without downtime.'}
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-sm bg-bg-secondary p-2 font-mono text-[10px] text-text-secondary">
            systemctl {pendingAction} nginx
          </pre>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-text-tertiary">
            Runs as root on the remote server
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={nginx.actionLoading}
              onClick={() => {
                const action = pendingAction
                setPendingAction(null)
                if (action) void nginx.runAction(action)
              }}
            >
              {pendingAction === 'stop' ? 'Stop' : 'Restart'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
