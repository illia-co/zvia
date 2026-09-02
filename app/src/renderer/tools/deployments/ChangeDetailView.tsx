import { useMemo } from 'react'
import type {
  Deployment,
  HealthStatus,
  TopologyChange,
  TopologyEntity,
  TopologySnapshot
} from '@shared/topology'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { entityKindLabel, entityStatusDotClass, healthChipClass } from './topologyPresentation'
import { getEntityDependencies } from './deploymentGraph'
import { inspectorActions } from './entityInspectorActions'
import { InspectorField, InspectorPanel, InspectorSection } from './InspectorPanel'

const CHANGE_LABELS: Record<TopologyChange['kind'], string> = {
  entity_added: 'Added',
  entity_removed: 'Removed',
  entity_modified: 'Changed',
  relationship_added: 'Linked',
  relationship_removed: 'Unlinked'
}

const RELATIONSHIP_TYPE_LABELS: Record<string, string> = {
  serves: 'serves',
  terminates_tls: 'terminates TLS',
  listens_on: 'listens on',
  proxies_to: 'proxies to',
  serves_static: 'serves static',
  bound_to: 'bound to',
  managed_by: 'managed by',
  published_by: 'published by',
  member_of: 'member of'
}

function isRelationshipChange(change: TopologyChange): boolean {
  return change.kind === 'relationship_added' || change.kind === 'relationship_removed'
}

/** Reconstruct the entity a change is about, favouring the live snapshot so the
 *  inspector can resolve neighbours and tool links, and falling back to the
 *  before/after state for removed entities. */
function entityForChange(
  change: TopologyChange,
  snapshot: TopologySnapshot | null
): TopologyEntity | null {
  if (isRelationshipChange(change)) return null
  if (snapshot?.entities[change.entityId]) return snapshot.entities[change.entityId]
  const state = change.kind === 'entity_removed' ? change.before : change.after
  if (!state || !change.kindLabel) return null
  return {
    id: change.entityId,
    kind: change.kindLabel,
    label: change.label ?? change.entityId,
    status: state.status,
    sourceRef: state.sourceRef
  }
}

function SourceRefDiff({
  before,
  after
}: {
  before?: Record<string, string | number | boolean | null>
  after?: Record<string, string | number | boolean | null>
}) {
  const keys = Array.from(
    new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])
  ).sort()

  if (keys.length === 0) return null

  return (
    <InspectorSection title="Configuration change">
      <dl>
        {keys.map((key) => {
          const beforeValue = before?.[key]
          const afterValue = after?.[key]
          const changed = beforeValue !== afterValue
          const beforeText = beforeValue === undefined ? '—' : String(beforeValue)
          const afterText = afterValue === undefined ? '—' : String(afterValue)
          return (
            <div
              key={key}
              className={cn(
                'flex items-baseline gap-2 border-b border-divider py-2 pr-2',
                changed && 'bg-bg-tertiary'
              )}
            >
              <dt className="w-24 shrink-0 truncate font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                {key}
              </dt>
              <dd className="min-w-0 flex-1 font-mono text-xs text-text-secondary">
                {beforeText}
                <span className="px-1.5 text-text-tertiary">→</span>
                <span className={changed ? 'text-text' : undefined}>{afterText}</span>
              </dd>
            </div>
          )
        })}
      </dl>
    </InspectorSection>
  )
}

function AffectedEntity({ entity }: { entity: TopologyEntity }) {
  const corrupted = entity.status === 'degraded' || entity.status === 'failed'
  return (
    <li className="flex items-center gap-2 py-0.5">
      <span className={cn('size-1.5 shrink-0 rounded-full', entityStatusDotClass(entity.status))} />
      <span className="truncate font-mono text-xs text-text-secondary">{entity.label}</span>
      {corrupted && (
        <span
          className={cn(
            'ml-auto shrink-0 text-[10px] uppercase tracking-wide',
            entity.status === 'failed' ? 'text-status-error' : 'text-status-warning'
          )}
        >
          {entity.status}
        </span>
      )}
    </li>
  )
}

interface ChangeDetailViewProps {
  change: TopologyChange
  snapshot: TopologySnapshot | null
  deployment: Deployment
  serverId: ServerId
  onClose: () => void
}

export function ChangeDetailView({
  change,
  snapshot,
  deployment,
  serverId,
  onClose
}: ChangeDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)

  const entity = useMemo(() => entityForChange(change, snapshot), [change, snapshot])
  const kindLabel = change.kindLabel ? entityKindLabel(change.kindLabel) : 'Entity'

  const beforeStatus: HealthStatus | undefined =
    change.kind === 'entity_removed' || change.kind === 'entity_modified'
      ? change.before?.status
      : undefined
  const afterStatus: HealthStatus | undefined =
    change.kind === 'entity_added' || change.kind === 'entity_modified'
      ? change.after?.status
      : undefined
  const statusChanged = Boolean(beforeStatus && afterStatus && beforeStatus !== afterStatus)

  const dependencies = useMemo(() => {
    if (!entity || !snapshot) return null
    return getEntityDependencies(entity.id, snapshot, new Set(deployment.entityIds))
  }, [entity, snapshot, deployment])

  const actions = entity ? inspectorActions(entity) : []

  const relationship = change.relationship
  const relationshipEvidence =
    isRelationshipChange(change) && snapshot
      ? snapshot.relationships.find((rel) => rel.id === change.entityId)
      : undefined

  const relationEndpoints = relationship
    ? [relationship.from, relationship.to]
        .map((ref) => snapshot?.entities[ref] ?? null)
        .filter((entry): entry is TopologyEntity => entry !== null)
    : []

  return (
    <InspectorPanel
      eyebrow="Change"
      title={change.label ?? change.entityId}
      subtitle={`${CHANGE_LABELS[change.kind]} · ${kindLabel}`}
      onClose={onClose}
      headerExtra={
        statusChanged && beforeStatus && afterStatus ? (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className={cn('size-1.5 shrink-0 rounded-full', entityStatusDotClass(beforeStatus))} />
            <span className="text-text-secondary">{beforeStatus}</span>
            <span className="text-text-tertiary">→</span>
            <span className={cn('rounded-sm px-1 py-px', healthChipClass(afterStatus))}>
              {afterStatus}
            </span>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className={cn('size-1.5 shrink-0 rounded-full', entityStatusDotClass(deployment.health))} />
            <span className="text-xs capitalize text-text-secondary">
              {deployment.name} · {deployment.health}
            </span>
          </div>
        )
      }
    >
      {entity && (
        <InspectorSection title="Entity">
          <InspectorField label="Type" value={kindLabel} />
          <InspectorField label="ID" value={change.entityId} mono />
        </InspectorSection>
      )}

      <SourceRefDiff before={change.before?.sourceRef} after={change.after?.sourceRef} />

      {relationship && (
        <InspectorSection title="Relationship">
          <InspectorField
            label="From"
            value={snapshot?.entities[relationship.from]?.label ?? relationship.from}
            mono
          />
          <InspectorField
            label="To"
            value={snapshot?.entities[relationship.to]?.label ?? relationship.to}
            mono
          />
          <InspectorField
            label="Type"
            value={RELATIONSHIP_TYPE_LABELS[relationship.type] ?? relationship.type}
          />
          {relationshipEvidence?.evidence.map((item, index) => (
            <div key={`${item.source}-${index}`} className="mt-2 rounded-panel bg-bg-secondary p-3">
              <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{item.source}</p>
              <p className="mt-1 text-xs text-text">{item.detail}</p>
              {item.location && (
                <p className="mt-1 font-mono text-[11px] text-text-tertiary">{item.location}</p>
              )}
              {item.raw && (
                <pre className="mt-2 overflow-x-auto rounded bg-bg-primary p-2 font-mono text-[11px] text-text-secondary">
                  {item.raw}
                </pre>
              )}
            </div>
          ))}
        </InspectorSection>
      )}

      {dependencies && dependencies.size > 0 && (
        <InspectorSection title="Affected">
          <div className="space-y-3">
            {[...dependencies.entries()].map(([kind, peers]) => (
              <div key={kind}>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                  {entityKindLabel(kind)}
                </p>
                <ul>
                  {peers.map((peer) => (
                    <AffectedEntity key={peer.id} entity={peer} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </InspectorSection>
      )}

      {relationship && relationEndpoints.length > 0 && (
        <InspectorSection title="Affected">
          <ul>
            {relationEndpoints.map((endpoint) => (
              <AffectedEntity key={endpoint.id} entity={endpoint} />
            ))}
          </ul>
        </InspectorSection>
      )}

      {entity && !dependencies && (
        <InspectorSection title="Affected">
          <p className="text-xs text-text-secondary">No related entities in this deployment.</p>
        </InspectorSection>
      )}

      {actions.length > 0 && (
        <InspectorSection title="Jump to">
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="ghost"
                onClick={() => openWithIntent(serverId, action.intent)}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </InspectorSection>
      )}
    </InspectorPanel>
  )
}
