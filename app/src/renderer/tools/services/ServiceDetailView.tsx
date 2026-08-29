import { useCallback, useEffect, useState } from 'react'
import type { RelayErrorPayload } from '@shared/errors'
import type { ServerId } from '@shared/server'
import type { SystemdAction, SystemdUnitDetail, SystemdUnitFile } from '@shared/systemd'
import { Button } from '@renderer/components/ui/button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseRelayError } from '@renderer/lib/errors'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { startupLabel, unitStateDotClass } from './ServicesTable'

const LOG_LINES = 200

interface ServiceDetailViewProps {
  serverId: ServerId
  unit: string
  actionLoading: boolean
  onAction: (unit: string, action: SystemdAction) => void
  refreshToken: number
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

export function ServiceDetailView({
  serverId,
  unit,
  actionLoading,
  onAction,
  refreshToken
}: ServiceDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const [detail, setDetail] = useState<SystemdUnitDetail | null>(null)
  const [detailError, setDetailError] = useState<RelayErrorPayload | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [logsError, setLogsError] = useState<RelayErrorPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [unitFileOpen, setUnitFileOpen] = useState(false)
  const [unitFile, setUnitFile] = useState<SystemdUnitFile | null>(null)
  const [unitFileError, setUnitFileError] = useState<RelayErrorPayload | null>(null)

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      setDetail(await window.relay.services.getUnit({ serverId, unit }))
      setDetailError(null)
    } catch (err) {
      setDetailError(parseRelayError(err))
    } finally {
      setLoading(false)
    }
  }, [serverId, unit])

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await window.relay.services.getUnitLogs({ serverId, unit, lines: LOG_LINES }))
      setLogsError(null)
    } catch (err) {
      setLogsError(parseRelayError(err))
    }
  }, [serverId, unit])

  const loadUnitFile = useCallback(async () => {
    try {
      setUnitFile(await window.relay.services.getUnitFile({ serverId, unit }))
      setUnitFileError(null)
    } catch (err) {
      setUnitFileError(parseRelayError(err))
    }
  }, [serverId, unit])

  useEffect(() => {
    void loadDetail()
    void loadLogs()
  }, [loadDetail, loadLogs, refreshToken])

  useEffect(() => {
    setUnitFileOpen(false)
    setUnitFile(null)
    setUnitFileError(null)
  }, [unit])

  useEffect(() => {
    if (!unitFileOpen) return
    void loadUnitFile()
  }, [loadUnitFile, refreshToken, unitFileOpen])

  const refresh = (): void => {
    void loadDetail()
    void loadLogs()
    if (unitFileOpen) void loadUnitFile()
  }

  const isRunning = detail?.activeState === 'active'
  const isEnabled = detail?.unitFileState === 'enabled'

  return (
    <div>
      <div className="border-b border-divider px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 shrink-0 rounded-full',
              unitStateDotClass(detail?.activeState ?? '')
            )}
            aria-hidden
          />
          <h3 className="truncate font-mono text-sm text-text">{unit}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {isRunning ? (
            <>
              <Button size="sm" disabled={actionLoading} onClick={() => onAction(unit, 'restart')}>
                Restart
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction(unit, 'reload')}
              >
                Reload
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={actionLoading}
                onClick={() => onAction(unit, 'stop')}
              >
                Stop
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={actionLoading} onClick={() => onAction(unit, 'start')}>
              Start
            </Button>
          )}
          {isEnabled ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction(unit, 'disable')}
            >
              Disable
            </Button>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() => onAction(unit, 'enable')}
            >
              Enable
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openWithIntent(serverId, { tool: 'logs', unit })}
          >
            Open in Logs
          </Button>
        </div>
      </div>

      {detailError && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={detailError} onRetry={() => void loadDetail()} />
        </div>
      )}

      <div className="px-4 py-3">
        <PropertyRow label="Description" value={detail?.description ?? ''} />
        <PropertyRow
          label="State"
          value={detail ? `${detail.activeState} (${detail.subState})` : ''}
        />
        <PropertyRow label="Load" value={detail?.loadState ?? ''} />
        <PropertyRow label="Startup" value={startupLabel(detail?.unitFileState ?? '')} />
        <PropertyRow
          label="Main PID"
          value={detail && detail.mainPid > 0 ? String(detail.mainPid) : '—'}
          mono
        />
        <PropertyRow label="Active since" value={detail?.activeEnterTimestamp ?? ''} />
        <PropertyRow label="Unit file" value={detail?.fragmentPath ?? ''} mono />
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between border-b border-divider pb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Unit file contents
          </span>
          <div className="flex items-center gap-1">
            {detail?.fragmentPath && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  openWithIntent(serverId, {
                    tool: 'files',
                    path: detail.fragmentPath
                  })
                }
              >
                Open in Files
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setUnitFileOpen((open) => !open)}>
              {unitFileOpen ? 'Hide' : 'Show'}
            </Button>
          </div>
        </div>

        {unitFileOpen &&
          (unitFileError ? (
            <div className="pt-3">
              <ErrorSurface error={unitFileError} onRetry={() => void loadUnitFile()} />
            </div>
          ) : unitFile === null ? (
            <p className="pt-3 text-xs text-text-secondary">Reading unit file…</p>
          ) : unitFile.content.trim() === '' ? (
            <p className="pt-3 text-xs text-text-secondary">
              systemd reported no unit file for this unit.
            </p>
          ) : (
            <>
              <pre className="mt-3 max-h-80 overflow-auto rounded-sm bg-bg-secondary p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
                {unitFile.content}
              </pre>
              <p className="mt-1.5 text-[10px] text-text-tertiary">
                Read-only. Includes drop-ins. Edit it in the Files tool.
              </p>
            </>
          ))}
      </div>

      <div className="px-4 pb-4">
        <div className="flex items-center justify-between border-b border-divider pb-1.5">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            Recent logs
          </span>
          <span className="text-[10px] text-text-tertiary">last {LOG_LINES} lines</span>
        </div>
        {logsError ? (
          <div className="pt-3">
            <ErrorSurface error={logsError} onRetry={() => void loadLogs()} />
          </div>
        ) : logs.length === 0 ? (
          <p className="pt-3 text-xs text-text-secondary">No journal entries for this unit.</p>
        ) : (
          <pre className="mt-3 max-h-80 overflow-auto rounded-sm bg-bg-secondary p-3 font-mono text-[10px] leading-relaxed text-text-secondary">
            {logs.join('\n')}
          </pre>
        )}
      </div>
    </div>
  )
}
