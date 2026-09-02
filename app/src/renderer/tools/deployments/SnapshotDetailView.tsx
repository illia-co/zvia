import { useMemo, useState } from 'react'
import type { TopologyChange, TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import type { Deployment, DeploymentComponentStatus } from '@shared/topology'
import { cn } from '@renderer/lib/utils'
import { BackButton } from '@renderer/components/ui/back-button'
import {
  deploymentHealthDotClass,
  entityKindLabel,
  entityStatusDotClass,
  healthChipClass,
  DEPLOYMENT_COMPONENT_LABELS
} from './topologyPresentation'
import { LAYER_ORDER, KIND_TO_LAYER, sortChangesWithinLayer } from './changeGroups'
import { ChangeDetailView } from './ChangeDetailView'

interface SnapshotDetailViewProps {
  deployment: Deployment
  changes: TopologyChange[]
  fromLabel: string
  toLabel: string
  snapshot: TopologySnapshot | null
  serverId: ServerId
  onBack: () => void
  loading?: boolean
}

interface ChangeRowProps {
  change: TopologyChange
  onSelect: () => void
}

const CHANGE_LABELS: Record<TopologyChange['kind'], string> = {
  entity_added: 'Added',
  entity_removed: 'Removed',
  entity_modified: 'Changed',
  relationship_added: 'Linked',
  relationship_removed: 'Unlinked'
}

function changeKindLabel(change: TopologyChange): string {
  return change.kindLabel ? entityKindLabel(change.kindLabel) : 'Entity'
}

function ChangeRow({ change, onSelect }: ChangeRowProps) {
  const kindLabel = changeKindLabel(change)
  const beforeStatus = change.before?.status
  const afterStatus = change.after?.status
  const statusChanged = Boolean(beforeStatus && afterStatus && beforeStatus !== afterStatus)

  return (
    <tr
      className="group cursor-pointer border-t border-divider transition-colors duration-default hover:bg-bg-secondary"
      onClick={onSelect}
    >
      <td className="px-3 py-2 text-center">
        <span
          className={cn(
            'inline-flex rounded-sm px-1.5 py-0.5 text-[9px] font-medium uppercase leading-none tracking-wide',
            change.kind === 'entity_removed' || change.kind === 'relationship_removed'
              ? 'bg-status-error/15 text-status-error'
              : 'bg-bg-secondary text-text-secondary'
          )}
        >
          {CHANGE_LABELS[change.kind]}
        </span>
      </td>
      <td className="px-2 py-2">
        <span className="block truncate font-mono text-xs text-text group-hover:underline">
          {change.label ?? change.entityId}
        </span>
      </td>
      <td className="px-2 py-2 text-[10px] uppercase tracking-wide text-text-tertiary">
        {kindLabel}
      </td>
      <td className="px-2 py-2">
        {statusChanged && beforeStatus && afterStatus ? (
          <span className="flex items-center gap-1.5 text-[10px]">
            <span className={cn('size-1.5 shrink-0 rounded-full', entityStatusDotClass(beforeStatus))} />
            <span className="text-text-secondary">{beforeStatus}</span>
            <span className="text-text-tertiary">→</span>
            <span className={cn('rounded-sm px-1 py-px', healthChipClass(afterStatus))}>
              {afterStatus}
            </span>
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-right text-text-tertiary">→</td>
    </tr>
  )
}

interface LayerSectionProps {
  layerKey: keyof DeploymentComponentStatus
  changes: TopologyChange[]
  onChangeSelect: (change: TopologyChange) => void
  first?: boolean
}

function LayerSection({ layerKey, changes, onChangeSelect, first = false }: LayerSectionProps) {
  return (
    <>
      <tr>
        <th
          colSpan={5}
          className={cn(
            'bg-bg-secondary px-4 pb-2 text-left text-[10px] font-medium uppercase tracking-wider text-text-tertiary',
            first ? 'pt-2' : 'pt-5'
          )}
        >
          {DEPLOYMENT_COMPONENT_LABELS[layerKey]}
        </th>
      </tr>
      {changes.map((change) => (
        <ChangeRow
          key={`${change.kind}:${change.entityId}`}
          change={change}
          onSelect={() => onChangeSelect(change)}
        />
      ))}
    </>
  )
}

function ChangesByLayer({
  changes,
  onChangeSelect
}: {
  changes: TopologyChange[]
  onChangeSelect: (change: TopologyChange) => void
}) {
  const layers = useMemo(() => {
    const layerMap = new Map<keyof DeploymentComponentStatus, TopologyChange[]>()
    for (const change of changes) {
      const layer = change.kindLabel ? KIND_TO_LAYER[change.kindLabel] : undefined
      const key = layer ?? 'backend'
      layerMap.get(key)?.push(change) ?? layerMap.set(key, [change])
    }

    const result: Array<{ key: keyof DeploymentComponentStatus; changes: TopologyChange[] }> = []
    for (const key of LAYER_ORDER) {
      const layerChanges = layerMap.get(key)
      if (layerChanges && layerChanges.length > 0) {
        result.push({ key, changes: sortChangesWithinLayer(layerChanges) })
      }
    }
    return result
  }, [changes])

  return (
    <table className="w-full table-fixed text-left text-xs">
      <colgroup>
        <col style={{ width: '4.5rem' }} />
        <col />
        <col style={{ width: '5.5rem' }} />
        <col style={{ width: '9.5rem' }} />
        <col style={{ width: '2.5rem' }} />
      </colgroup>
      <tbody>
        {layers.map((layer, index) => (
          <LayerSection
            key={layer.key}
            layerKey={layer.key}
            changes={layer.changes}
            onChangeSelect={onChangeSelect}
            first={index === 0}
          />
        ))}
      </tbody>
    </table>
  )
}

export function SnapshotDetailView({
  deployment,
  changes,
  fromLabel,
  toLabel,
  snapshot,
  serverId,
  onBack,
  loading = false
}: SnapshotDetailViewProps) {
  const [selectedChange, setSelectedChange] = useState<TopologyChange | null>(null)

  const changeList = loading ? (
    <p className="p-6 text-center text-xs text-text-secondary">Comparing snapshots…</p>
  ) : changes.length === 0 ? (
    <p className="p-6 text-center text-xs text-text-secondary">
      No changes between these snapshots.
    </p>
  ) : (
    <ChangesByLayer changes={changes} onChangeSelect={setSelectedChange} />
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <BackButton onClick={onBack} />
        <span className={cn('size-2 shrink-0 rounded-full', deploymentHealthDotClass(deployment.health))} />
        <span className="truncate font-mono text-xs font-medium text-text">{deployment.name}</span>
        <span className="text-text-tertiary">·</span>
        <span className="truncate text-xs text-text-secondary">
          {fromLabel} → {toLabel}
        </span>
        <span className="ml-auto shrink-0 rounded-sm bg-bg-tertiary px-1.5 py-0.5 text-[9px] text-text-secondary">
          {changes.length} {changes.length === 1 ? 'change' : 'changes'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto">{changeList}</div>

        {selectedChange && (
          <div className="flex w-96 shrink-0 flex-col border-l border-divider">
            <ChangeDetailView
              change={selectedChange}
              snapshot={snapshot}
              deployment={deployment}
              serverId={serverId}
              onClose={() => setSelectedChange(null)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
