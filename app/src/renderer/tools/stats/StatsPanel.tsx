import type { ReactNode } from 'react'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useServerStore } from '@renderer/state/serverStore'
import { Button } from '@renderer/components/ui/button'
import { useStatsSubscription } from '@renderer/hooks/useStatsSubscription'
import {
  formatBytes,
  formatLoad,
  formatPercent,
  formatRate
} from '@renderer/lib/format'
import { cn } from '@renderer/lib/utils'

function Section({
  title,
  children,
  muted = false
}: {
  title: string
  children: ReactNode
  muted?: boolean
}) {
  return (
    <section className={cn(muted && 'opacity-50')}>
      <h2 className="mb-3 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
        {title}
      </h2>
      {children}
    </section>
  )
}

function StatTable({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-divider rounded-panel border border-divider">{children}</div>
}

function StatRow({
  label,
  value,
  subvalue
}: {
  label: string
  value: string
  subvalue?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3 py-2.5">
      <span className="truncate text-xs text-text-secondary">{label}</span>
      <div className="shrink-0 text-right">
        <span className="font-mono text-sm tabular-nums text-text">{value}</span>
        {subvalue ? (
          <p className="mt-0.5 font-mono text-[11px] text-text-secondary">{subvalue}</p>
        ) : null}
      </div>
    </div>
  )
}

export function StatsPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const connect = useServerStore((s) => s.connect)
  const isConnected = connectionState === 'connected'
  const { stats } = useStatsSubscription({
    serverId,
    mode: 'stats',
    enabled: isConnected
  })

  const muted = !isConnected

  return (
    <div className="h-full min-h-0 overflow-y-auto p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <Section title="CPU" muted={muted}>
          <StatTable>
            <StatRow
              label="Total usage"
              value={formatPercent(stats?.cpu.totalUsagePercent ?? null)}
              subvalue={
                stats
                  ? `${stats.cpu.coreCount} core${stats.cpu.coreCount === 1 ? '' : 's'}`
                  : undefined
              }
            />
            <StatRow
              label="Load average"
              value={
                stats
                  ? `${formatLoad(stats.cpu.loadAverage[0])} · ${formatLoad(stats.cpu.loadAverage[1])} · ${formatLoad(stats.cpu.loadAverage[2])}`
                  : '—'
              }
              subvalue="1m · 5m · 15m"
            />
          </StatTable>

          {stats && stats.cpu.cores.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-[11px] text-text-tertiary">Per core</p>
              <StatTable>
                {stats.cpu.cores.map((core) => (
                  <StatRow
                    key={core.coreIndex}
                    label={`Core ${core.coreIndex}`}
                    value={formatPercent(core.usagePercent)}
                  />
                ))}
              </StatTable>
            </div>
          ) : null}
        </Section>

        <Section title="Memory" muted={muted}>
          <StatTable>
            <StatRow
              label="Memory"
              value={stats ? formatPercent(stats.memory.usagePercent) : '—'}
              subvalue={
                stats
                  ? `${formatBytes(stats.memory.usedBytes)} used · ${formatBytes(stats.memory.availableBytes)} available · ${formatBytes(stats.memory.totalBytes)} total`
                  : undefined
              }
            />
            <StatRow
              label="Swap"
              value={stats ? formatPercent(stats.memory.swapUsagePercent) : '—'}
              subvalue={
                stats
                  ? `${formatBytes(stats.memory.swapUsedBytes)} / ${formatBytes(stats.memory.swapTotalBytes)}`
                  : undefined
              }
            />
          </StatTable>
        </Section>

        <Section title="Filesystems" muted={muted}>
          {stats && stats.filesystems.length > 0 ? (
            <StatTable>
              {stats.filesystems.map((filesystem) => (
                <StatRow
                  key={`${filesystem.device}:${filesystem.mount}`}
                  label={filesystem.mount}
                  value={formatPercent(filesystem.usagePercent)}
                  subvalue={`${formatBytes(filesystem.usedBytes)} / ${formatBytes(filesystem.totalBytes)} · ${filesystem.device}`}
                />
              ))}
            </StatTable>
          ) : (
            <p className="text-xs text-text-secondary">No filesystem data</p>
          )}
        </Section>

        <Section title="Network" muted={muted}>
          {stats && stats.network.length > 0 ? (
            <StatTable>
              {stats.network.map((iface) => (
                <StatRow
                  key={iface.name}
                  label={iface.name}
                  value={`${formatRate(iface.rxBytesPerSec)} ↓`}
                  subvalue={`${formatRate(iface.txBytesPerSec)} ↑`}
                />
              ))}
            </StatTable>
          ) : (
            <p className="text-xs text-text-secondary">No network interfaces</p>
          )}
        </Section>

        {!isConnected && (
          <div className="border-t border-divider pt-6 text-center">
            <p className="text-xs text-text-secondary">
              Connect to stream live statistics for this server.
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
