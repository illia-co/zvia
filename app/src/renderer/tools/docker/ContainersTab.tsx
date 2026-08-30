import { useCallback, useEffect, useRef, useState } from 'react'
import { parsePublishedHostPorts, type DockerContainer } from '@shared/docker'
import type { ServerId } from '@shared/server'
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
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { parseZviaError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { ContainerInspectView } from './ContainerInspectView'
import { ContainerLogsView } from './ContainerLogsView'
import { ContainerTerminalView } from './ContainerTerminalView'

interface ContainersTabProps {
  serverId: ServerId
  isConnected: boolean
}

type ContainerView = 'list' | 'logs' | 'inspect' | 'terminal'

interface PendingAction {
  type: 'remove'
  container: DockerContainer
}

function containerStateColor(state: string): string {
  const normalized = state.toLowerCase()
  if (normalized === 'running') return 'bg-status-healthy'
  if (normalized === 'paused' || normalized === 'restarting') return 'bg-status-warning'
  if (normalized === 'exited' || normalized === 'dead') return 'bg-text-tertiary'
  return 'bg-status-error'
}

export function ContainersTab({ serverId, isConnected }: ContainersTabProps) {
  const [containers, setContainers] = useState<DockerContainer[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(true)
  const [selectedContainer, setSelectedContainer] = useState<DockerContainer | null>(null)
  const [view, setView] = useState<ContainerView>('list')
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const refreshTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  const loadContainers = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.zvia.docker.listContainers({ serverId, all: showAll })
      setContainers(result)
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId, showAll])

  useEffect(() => {
    void loadContainers()
  }, [loadContainers])

  useEffect(() => {
    if (!isConnected || view !== 'list') {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
      return
    }

    refreshTimer.current = setInterval(() => {
      void loadContainers()
    }, 5000)

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current)
        refreshTimer.current = null
      }
    }
  }, [isConnected, view, loadContainers])

  const runAction = async (
    container: DockerContainer,
    action: 'start' | 'stop' | 'restart'
  ): Promise<void> => {
    setActionLoading(true)
    setError(null)
    try {
      const request = { serverId, containerId: container.id }
      if (action === 'start') await window.zvia.docker.startContainer(request)
      if (action === 'stop') await window.zvia.docker.stopContainer(request)
      if (action === 'restart') await window.zvia.docker.restartContainer(request)
      await loadContainers()
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setActionLoading(false)
    }
  }

  const confirmRemove = async (): Promise<void> => {
    if (!pendingAction) return
    setActionLoading(true)
    setError(null)
    try {
      await window.zvia.docker.removeContainer({
        serverId,
        containerId: pendingAction.container.id,
        force: true
      })
      setPendingAction(null)
      if (selectedContainer?.id === pendingAction.container.id) {
        setSelectedContainer(null)
        setView('list')
      }
      await loadContainers()
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setActionLoading(false)
    }
  }

  const openDetail = (container: DockerContainer, nextView: Exclude<ContainerView, 'list'>) => {
    setSelectedContainer(container)
    setView(nextView)
  }

  if (view !== 'list' && selectedContainer) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setView('list')} />
          <span className="truncate font-mono text-xs text-text-secondary">
            {selectedContainer.name}
          </span>
        </div>
        <div className="min-h-0 flex-1">
          {view === 'logs' && (
            <ContainerLogsView serverId={serverId} container={selectedContainer} />
          )}
          {view === 'inspect' && (
            <ContainerInspectView serverId={serverId} container={selectedContainer} />
          )}
          {view === 'terminal' && (
            <ContainerTerminalView serverId={serverId} container={selectedContainer} />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-divider px-3 py-2">
        <div className="flex items-center gap-1">
          {(
            [
              { id: false, label: 'Running' },
              { id: true, label: 'All' }
            ] as const
          ).map((filter) => (
            <button
              key={String(filter.id)}
              type="button"
              onClick={() => setShowAll(filter.id)}
              className={cn(
                'rounded-panel px-2.5 py-1 text-xs transition-colors duration-default',
                showAll === filter.id
                  ? 'bg-bg-secondary text-text'
                  : 'text-text-secondary hover:bg-bg-secondary hover:text-text'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => void loadContainers()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && containers.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading containers…</p>
        ) : containers.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">No containers found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Image</th>
                <th className="px-3 py-2 font-medium">Ports</th>
                <th className="px-3 py-2 font-medium">Uptime</th>
                <th className="px-3 py-2 font-medium">CPU</th>
                <th className="px-3 py-2 font-medium">Memory</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {containers.map((container) => {
                const isRunning = container.state.toLowerCase() === 'running'
                const hostPorts = parsePublishedHostPorts(container.ports)
                return (
                  <tr key={container.id} className="border-t border-divider">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn('size-1.5 rounded-full', containerStateColor(container.state))}
                          aria-hidden
                        />
                        <span className="font-medium text-text">{container.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{container.status}</td>
                    <td className="max-w-[10rem] truncate px-3 py-2 font-mono text-text-secondary">
                      {container.image}
                    </td>
                    <td
                      className="max-w-[8rem] px-3 py-2 font-mono text-text-secondary"
                      title={container.ports}
                    >
                      {hostPorts.length > 0 ? (
                        <div className="flex flex-wrap gap-x-1.5">
                          {hostPorts.map((port) => (
                            <button
                              key={port}
                              type="button"
                              onClick={() => openWithIntent(serverId, { tool: 'ports', port })}
                              className="underline decoration-divider underline-offset-2 transition-colors duration-default hover:text-text"
                            >
                              {port}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="block truncate">{container.ports}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text-secondary">{container.uptime}</td>
                    <td className="px-3 py-2 font-mono text-text-secondary">
                      {container.cpuPercent}
                    </td>
                    <td className="px-3 py-2 font-mono text-text-secondary">
                      <div>{container.memoryUsage}</div>
                      <div className="text-[10px] text-text-tertiary">{container.memoryPercent}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {!isRunning && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={actionLoading}
                            onClick={() => void runAction(container, 'start')}
                          >
                            Start
                          </Button>
                        )}
                        {isRunning && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionLoading}
                              onClick={() => void runAction(container, 'stop')}
                            >
                              Stop
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={actionLoading}
                              onClick={() => void runAction(container, 'restart')}
                            >
                              Restart
                            </Button>
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(container, 'logs')}
                        >
                          Logs
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(container, 'inspect')}
                        >
                          Inspect
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetail(container, 'terminal')}
                        >
                          Terminal
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-status-error hover:text-status-error"
                          disabled={actionLoading}
                          onClick={() => setPendingAction({ type: 'remove', container })}
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={pendingAction !== null} onOpenChange={(open) => !open && setPendingAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove container</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono">{pendingAction?.container.name}</span>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => void confirmRemove()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
