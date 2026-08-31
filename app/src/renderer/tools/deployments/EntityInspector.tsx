import type { TopologyEntity, TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import {
  entityKindLabel,
  entityStatusDotClass,
  getEntityDependencies,
  getEntityRelationships
} from './deploymentGraph'
import { inspectorActions } from './entityInspectorActions'
import { InspectorField, InspectorPanel, InspectorSection } from './InspectorPanel'

interface EntityInspectorProps {
  entity: TopologyEntity
  snapshot: TopologySnapshot
  deploymentEntityIds: string[] | Set<string>
  serverId: ServerId
  onClose: () => void
  onSelectRelationship?: (relationshipId: string) => void
}

function confidenceLabel(confidence: string): string {
  return confidence.charAt(0).toUpperCase() + confidence.slice(1)
}

export function EntityInspector({
  entity,
  snapshot,
  deploymentEntityIds,
  serverId,
  onClose,
  onSelectRelationship
}: EntityInspectorProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const scope =
    deploymentEntityIds instanceof Set ? deploymentEntityIds : new Set(deploymentEntityIds)
  const relationships = getEntityRelationships(entity.id, snapshot, scope)
  const outgoing = relationships.filter((view) => view.direction === 'outgoing')
  const incoming = relationships.filter((view) => view.direction === 'incoming')
  const dependencies = getEntityDependencies(entity.id, snapshot, scope)
  const actions = inspectorActions(entity)

  return (
    <InspectorPanel
      eyebrow="Entity"
      title={entity.label}
      subtitle={entityKindLabel(entity.kind)}
      onClose={onClose}
      headerExtra={
        <div className="mt-2 flex items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', entityStatusDotClass(entity.status))} />
          <span className="text-xs capitalize text-text-secondary">{entity.status}</span>
        </div>
      }
    >
      <dl>
        <InspectorField label="Type" value={entityKindLabel(entity.kind)} />
        <InspectorField label="Status" value={entity.status} />
        <InspectorField label="ID" value={entity.id} mono />
      </dl>

      {outgoing.length > 0 && (
        <InspectorSection title="Outgoing connections">
          <ul className="space-y-2">
            {outgoing.map((view) => (
              <li key={view.relationship.id}>
                <button
                  type="button"
                  className="w-full rounded-panel border border-divider bg-bg-secondary p-2 text-left transition-colors duration-default hover:border-text-tertiary"
                  onClick={() => onSelectRelationship?.(view.relationship.id)}
                >
                  <p className="font-mono text-xs text-text">{view.peer.label}</p>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {view.relationship.label ?? view.relationship.type} ·{' '}
                    {confidenceLabel(view.relationship.confidence)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}

      {incoming.length > 0 && (
        <InspectorSection title="Incoming connections">
          <ul className="space-y-2">
            {incoming.map((view) => (
              <li key={view.relationship.id}>
                <button
                  type="button"
                  className="w-full rounded-panel border border-divider bg-bg-secondary p-2 text-left transition-colors duration-default hover:border-text-tertiary"
                  onClick={() => onSelectRelationship?.(view.relationship.id)}
                >
                  <p className="font-mono text-xs text-text">{view.peer.label}</p>
                  <p className="mt-1 text-[11px] text-text-secondary">
                    {view.relationship.label ?? view.relationship.type} ·{' '}
                    {confidenceLabel(view.relationship.confidence)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </InspectorSection>
      )}

      {dependencies.size > 0 && (
        <InspectorSection title="Dependencies">
          <div className="space-y-3">
            {[...dependencies.entries()].map(([kind, peers]) => (
              <div key={kind}>
                <p className="mb-1 text-[10px] uppercase tracking-wider text-text-tertiary">
                  {entityKindLabel(kind)}
                </p>
                <ul className="space-y-1">
                  {peers.map((peer) => (
                    <li key={peer.id} className="font-mono text-xs text-text-secondary">
                      {peer.label}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </InspectorSection>
      )}

      {relationships.length === 0 && (
        <InspectorSection title="Connections">
          <p className="text-xs text-text-secondary">No relationships discovered for this entity.</p>
        </InspectorSection>
      )}

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-divider pt-4">
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
      )}
    </InspectorPanel>
  )
}
