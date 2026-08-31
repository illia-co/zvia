import { useServerContext } from '@renderer/state/ServerContext'
import { useServerStore } from '@renderer/state/serverStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { Button } from '@renderer/components/ui/button'
import { StatusDot } from '@renderer/components/ui/status-dot'
import { TabStrip } from './TabStrip'
import { PanelLayout } from './PanelLayout'

const modKey = window.zvia.platform === 'darwin' ? '⌘' : 'Ctrl+'

export function Workspace() {
  const { server, serverId, connectionState } = useServerContext()
  const connect = useServerStore((s) => s.connect)
  const workspace = useWorkspaceStore((s) => (serverId ? s.getWorkspace(serverId) : null))
  const isConnected = connectionState === 'connected'
  const hasOpenPanels = Boolean(workspace?.root)

  const emptyState = !server || !serverId || !hasOpenPanels

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg">
      <TabStrip />

      <div className="min-h-0 flex-1 overflow-hidden p-3">
        {emptyState ? (
          <div className="flex h-full flex-col items-center justify-center">
            {!server || !serverId ? (
              <div className="max-w-sm text-center">
                <span
                  className="zvia-mark mx-auto mb-4 block size-10 text-text-tertiary"
                  aria-hidden
                />
                <p className="text-sm text-text">Select a server</p>
                <p className="mt-2 text-xs text-text-secondary">
                  Add or select a server from the left sidebar.
                </p>
              </div>
            ) : !isConnected ? (
              <div className="w-full max-w-md rounded-panel border border-divider bg-bg-secondary p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-text">{server.name}</p>
                    <p className="mt-0.5 font-mono text-xs text-text-secondary">
                      {server.username}@{server.hostname}
                      {server.port !== 22 ? `:${server.port}` : ''}
                    </p>
                  </div>
                  <StatusDot state={connectionState} />
                </div>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => void connect(serverId)}
                  disabled={connectionState === 'connecting' || connectionState === 'reconnecting'}
                >
                  {connectionState === 'connecting' || connectionState === 'reconnecting'
                    ? 'Connecting…'
                    : 'Connect'}
                </Button>
              </div>
            ) : (
              <div className="max-w-sm text-center">
                <span
                  className="zvia-mark mx-auto mb-4 block size-10 text-text-tertiary"
                  aria-hidden
                />
                <p className="text-sm text-text">
                  <span className="font-medium">{server.name}</span>
                  {' — '}
                  Select a tool from the sidebar, or press {modKey}1 for Deployments.
                </p>
                <p className="mt-2 text-xs text-text-secondary">
                  Deployments maps how this server runs your apps. Use Terminal or another tool from the sidebar when you need it.
                </p>
              </div>
            )}
          </div>
        ) : workspace?.root ? (
          <PanelLayout
            serverId={serverId}
            node={workspace.root}
            focusedPanelId={workspace.focusedPanelId}
            tabOrder={workspace.tabOrder}
          />
        ) : null}
      </div>
    </section>
  )
}
