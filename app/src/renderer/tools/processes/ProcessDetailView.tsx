import { useCallback, useEffect, useState } from 'react'
import type { ProcessDetail } from '@shared/processes'
import type { ProcessSignal } from '@shared/processes'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { describeToolError } from '@renderer/lib/toolErrors'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import {
  formatCpuPercent,
  formatMemoryPercent,
  formatRss,
  formatRuntime,
  processDisplayName
} from './processLabels'

interface ProcessDetailViewProps {
  serverId: ServerId
  pid: number
  actionLoading: boolean
  refreshToken: number
  onSignalRequest: (pid: number, name: string, signal: ProcessSignal) => void
  loadDetail: (pid: number) => Promise<ProcessDetail>
}

interface PropertyRowProps {
  label: string
  value: string
  mono?: boolean
}

function PropertyRow({ label, value, mono }: PropertyRowProps) {
  return (
    <div className="flex gap-3 border-b border-divider py-1.5 last:border-b-0">
      <span className="w-32 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span className={cn('min-w-0 break-words text-xs text-text-secondary', mono && 'font-mono')}>
        {value || '—'}
      </span>
    </div>
  )
}

export function ProcessDetailView({
  serverId,
  pid,
  actionLoading,
  refreshToken,
  onSignalRequest,
  loadDetail
}: ProcessDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const openTool = useWorkspaceStore((state) => state.openTool)
  const [detail, setDetail] = useState<ProcessDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await loadDetail(pid))
      setError(null)
    } catch (err) {
      const described = describeToolError(err)
      setError(described.message)
    } finally {
      setLoading(false)
    }
  }, [loadDetail, pid])

  useEffect(() => {
    void fetchDetail()
  }, [fetchDetail, refreshToken])

  if (loading && !detail) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading process…</p>
  }

  if (error && !detail) {
    return (
      <div className="p-4">
        <ErrorSurface error={error} onRetry={() => void fetchDetail()} />
      </div>
    )
  }

  if (!detail) {
    return <p className="p-6 text-center text-xs text-text-secondary">Process not found.</p>
  }

  const displayName = processDisplayName(detail)

  return (
    <div className="h-full overflow-auto p-4">
      {error && (
        <div className="mb-4">
          <ErrorSurface error={error} onRetry={() => void fetchDetail()} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="mb-5">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              detail.state === 'running' ? 'bg-status-success' : 'bg-text-tertiary'
            )}
          />
          <h2 className="truncate font-mono text-sm text-text">{displayName}</h2>
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          PID {detail.pid} · {detail.user} · {detail.state}
        </p>
      </div>

      <div className="mb-5 rounded-panel bg-bg-secondary p-3">
        <PropertyRow label="Command" value={detail.cmdline} mono />
        <PropertyRow label="Executable" value={detail.exe ?? '—'} mono />
        <PropertyRow label="Working dir" value={detail.cwd ?? '—'} mono />
        <PropertyRow label="Parent PID" value={String(detail.ppid)} mono />
        <PropertyRow label="UID" value={String(detail.uid)} mono />
        <PropertyRow label="CPU" value={formatCpuPercent(detail.cpuPercent)} />
        <PropertyRow label="Memory" value={`${formatMemoryPercent(detail.memoryPercent)} · ${formatRss(detail.rssBytes)}`} />
        <PropertyRow label="Runtime" value={formatRuntime(detail.elapsedSeconds)} />
        <PropertyRow label="Status" value={detail.stat} mono />
        <PropertyRow label="systemd unit" value={detail.unit ?? '—'} mono />
        {detail.unitActiveState && (
          <PropertyRow label="Unit state" value={detail.unitActiveState} />
        )}
        <PropertyRow
          label="Container"
          value={
            detail.containerName ??
            (detail.containerId ? detail.containerId.slice(0, 12) : '—')
          }
          mono
        />
      </div>

      {detail.listeningPorts.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 text-[10px] uppercase tracking-wider text-text-tertiary">
            Listening ports
          </p>
          <ul className="space-y-1">
            {detail.listeningPorts.map((port) => (
              <li
                key={`${port.protocol}:${port.address}:${port.port}`}
                className="flex items-center justify-between border-b border-divider py-2"
              >
                <span className="font-mono text-xs text-text-secondary">
                  {port.protocol.toUpperCase()} {port.address}:{port.port}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    openWithIntent(serverId, { tool: 'ports', port: port.port })
                  }
                >
                  Open in Ports
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.protected && (
        <p className="mb-5 rounded-panel bg-bg-secondary p-3 text-xs leading-relaxed text-text-secondary">
          {detail.protectedReason ?? 'This process is protected and cannot be signaled.'}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" onClick={() => openTool(serverId, 'terminal')}>
          Open Terminal
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            openWithIntent(serverId, {
              tool: 'logs',
              pid: detail.pid,
              ...(detail.unit ? { unit: detail.unit } : {})
            })
          }
        >
          View Logs
        </Button>
        {detail.unit && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              openWithIntent(serverId, {
                tool: 'services',
                unit: detail.unit as string,
                view: 'detail'
              })
            }
          >
            Open Service
          </Button>
        )}
        {detail.listeningPorts.length > 0 && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              openWithIntent(serverId, { tool: 'ports', port: detail.listeningPorts[0].port })
            }
          >
            Open Ports
          </Button>
        )}
        {detail.containerId && (
          <Button size="sm" variant="ghost" onClick={() => openTool(serverId, 'docker')}>
            Open in Docker
          </Button>
        )}
        {!detail.protected && (
          <>
            <Button
              size="sm"
              disabled={actionLoading}
              onClick={() => onSignalRequest(detail.pid, displayName, 'terminate')}
            >
              Terminate
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={actionLoading}
              onClick={() => onSignalRequest(detail.pid, displayName, 'kill')}
            >
              Force Kill
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => void fetchDetail()} disabled={loading}>
          Refresh
        </Button>
      </div>
    </div>
  )
}
