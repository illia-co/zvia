import type { PortListener } from '@shared/ports'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { PendingFirewallChange } from './FirewallRuleDialog'
import {
  exposureLabel,
  isNoteworthy,
  listenerKey,
  ownerLabel,
  verdictLabel
} from './portLabels'

interface PortsTableProps {
  listeners: PortListener[]
  loading: boolean
  firewallEditable: boolean
  /** Null until the snapshot loads. Rules are never offered for this port. */
  sshPort: number | null
  actionLoading: boolean
  onSelect: (listener: PortListener) => void
  onRequestChange: (change: PendingFirewallChange) => void
}

interface PortRowProps {
  listener: PortListener
  canEdit: boolean
  actionLoading: boolean
  onSelect: (listener: PortListener) => void
  onRequestChange: (change: PendingFirewallChange) => void
}

function PortRow({ listener, canEdit, actionLoading, onSelect, onRequestChange }: PortRowProps) {
  return (
    <tr
      className="group cursor-pointer border-t border-divider hover:bg-bg-secondary"
      onClick={() => onSelect(listener)}
    >
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'size-1.5 rounded-full',
              isNoteworthy(listener) ? 'bg-status-warning' : 'bg-text-tertiary'
            )}
            aria-hidden
          />
          <span className="font-mono font-medium text-text group-hover:underline">
            {listener.port}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
            {listener.protocol}
          </span>
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-text-secondary">{listener.address}</td>
      <td className="px-3 py-2 text-text-secondary">{exposureLabel(listener.exposure)}</td>
      <td className="px-3 py-2 text-text-secondary">
        <span className="font-mono">{listener.process || '—'}</span>
        {listener.pid !== null && (
          <span className="ml-1.5 text-[10px] text-text-tertiary">pid {listener.pid}</span>
        )}
      </td>
      <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-text-secondary">
        {ownerLabel(listener)}
      </td>
      <td className="px-3 py-2 text-text-secondary">{verdictLabel(listener.firewall)}</td>
      <td className="px-3 py-2" onClick={(event) => event.stopPropagation()}>
        {canEdit && (
          <div className="flex flex-wrap justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() =>
                onRequestChange({
                  kind: 'allow',
                  port: listener.port,
                  protocol: listener.protocol
                })
              }
            >
              Allow
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={actionLoading}
              onClick={() =>
                onRequestChange({
                  kind: 'deny',
                  port: listener.port,
                  protocol: listener.protocol
                })
              }
            >
              Block
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}

export function PortsTable({
  listeners,
  loading,
  firewallEditable,
  sshPort,
  actionLoading,
  onSelect,
  onRequestChange
}: PortsTableProps) {
  if (loading && listeners.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">Reading listening ports…</p>
  }

  if (listeners.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">No listening ports found.</p>
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          <th className="px-3 py-2 font-medium">Port</th>
          <th className="px-3 py-2 font-medium">Bind address</th>
          <th className="px-3 py-2 font-medium">Exposure</th>
          <th className="px-3 py-2 font-medium">Process</th>
          <th className="px-3 py-2 font-medium">Owner</th>
          <th className="px-3 py-2 font-medium">Firewall</th>
          <th className="px-3 py-2 font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {listeners.map((listener) => {
          const isSshPort = listener.protocol === 'tcp' && listener.port === sshPort
          return (
            <PortRow
              key={listenerKey(listener)}
              listener={listener}
              canEdit={firewallEditable && !isSshPort}
              actionLoading={actionLoading}
              onSelect={onSelect}
              onRequestChange={onRequestChange}
            />
          )
        })}
      </tbody>
    </table>
  )
}
