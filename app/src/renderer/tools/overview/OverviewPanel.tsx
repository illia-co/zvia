import type { ReactNode } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { getConnectionLabel, useServerStore } from '@renderer/state/serverStore'
import { StatusDot } from '@renderer/components/ui/status-dot'
import { Button } from '@renderer/components/ui/button'
import { useStatsSubscription } from '@renderer/hooks/useStatsSubscription'
import {
  formatBytes,
  formatPercent,
  formatRate,
  formatUptime
} from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

function MetricRow({
  label,
  value,
  detail,
  muted = false
}: {
  label: string
  value: string
  detail?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={cn('text-xs', muted ? 'text-text-tertiary' : 'text-text-secondary')}>
        {label}
      </span>
      <div className="text-right">
        <span
          className={cn(
            'font-mono text-sm tabular-nums',
            muted ? 'text-text-tertiary' : 'text-text'
          )}
        >
          {value}
        </span>
        {detail ? (
          <p className={cn('mt-0.5 font-mono text-[11px]', muted ? 'text-text-tertiary' : 'text-text-secondary')}>
            {detail}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
        {title}
      </h2>
      <div className="divide-y divide-divider">{children}</div>
    </section>
  )
}

export function OverviewPanel() {
  const { server, serverId, connectionState } = useRequiredServerContext()
  const connect = useServerStore((s) => s.connect)
  const isConnected = connectionState === 'connected'
  const { info, stats } = useStatsSubscription({
    serverId,
    mode: 'overview',
    enabled: isConnected
  })

  const muted = !isConnected
  const rootFilesystem =
    stats?.filesystems.find((filesystem) => filesystem.mount === '/') ??
    stats?.filesystems[0]

  const networkRx = stats?.network.reduce((sum, item) => sum + (item.rxBytesPerSec ?? 0), 0) ?? 0
  const networkTx = stats?.network.reduce((sum, item) => sum + (item.txBytesPerSec ?? 0), 0) ?? 0

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      <div className="mx-auto max-w-xl">
        <header className="border-b border-divider pb-5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            {server.name}
          </p>
          <p className="mt-1 font-mono text-sm text-text">
            {server.username}@{info?.hostname ?? server.hostname}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-text-secondary">
            <StatusDot state={connectionState} />
            {getConnectionLabel(connectionState)}
          </p>
        </header>

        <div className="mt-6 space-y-8">
          <Section title="System">
            <MetricRow
              label="Distribution"
              value={info ? `${info.osName}${info.osVersion ? ` ${info.osVersion}` : ''}` : '—'}
              muted={muted}
            />
            <MetricRow label="Architecture" value={info?.architecture ?? '—'} muted={muted} />
            <MetricRow
              label="Uptime"
              value={info ? formatUptime(info.uptimeSeconds) : '—'}
              muted={muted}
            />
          </Section>

          <Section title="Resources">
            <MetricRow
              label="CPU"
              value={formatPercent(stats?.cpu.totalUsagePercent ?? null)}
              detail={
                stats
                  ? `Load ${stats.cpu.loadAverage.map((value) => value.toFixed(2)).join(' · ')}`
                  : undefined
              }
              muted={muted}
            />
            <MetricRow
              label="Memory"
              value={stats ? formatPercent(stats.memory.usagePercent) : '—'}
              detail={
                stats
                  ? `${formatBytes(stats.memory.usedBytes)} / ${formatBytes(stats.memory.totalBytes)}`
                  : undefined
              }
              muted={muted}
            />
            <MetricRow
              label="Disk"
              value={rootFilesystem ? formatPercent(rootFilesystem.usagePercent) : '—'}
              detail={
                rootFilesystem
                  ? `${formatBytes(rootFilesystem.usedBytes)} / ${formatBytes(rootFilesystem.totalBytes)} · ${rootFilesystem.mount}`
                  : undefined
              }
              muted={muted}
            />
            <MetricRow
              label="Network"
              value={isConnected ? `${formatRate(networkRx)} ↓` : '—'}
              detail={isConnected ? `${formatRate(networkTx)} ↑` : undefined}
              muted={muted}
            />
          </Section>
        </div>

        {!isConnected && (
          <div className="mt-8 border-t border-divider pt-6 text-center">
            <p className="text-xs text-text-secondary">
              Connect to view live metrics for this server.
            </p>
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
        )}
      </div>
    </div>
  )
}
