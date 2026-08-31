import type { Relationship, TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { cn } from '@renderer/lib/utils'
import { InspectorField, InspectorPanel, InspectorSection } from './InspectorPanel'
import { inspectorActions } from './entityInspectorActions'

interface RelationshipEvidenceProps {
  evidence: Relationship['evidence']
}

export function RelationshipEvidence({ evidence }: RelationshipEvidenceProps) {
  if (evidence.length === 0) {
    return <p className="text-xs text-text-secondary">No evidence captured for this relationship.</p>
  }

  return (
    <ul className="space-y-3">
      {evidence.map((item, index) => (
        <li key={`${item.source}-${index}`} className="rounded-panel bg-bg-secondary p-3">
          <p className="text-[10px] uppercase tracking-wider text-text-tertiary">{item.source}</p>
          <p className="mt-1 text-xs text-text">{item.detail}</p>
          {item.raw && (
            <pre className="mt-2 overflow-x-auto rounded bg-bg-primary p-2 font-mono text-[11px] text-text-secondary">
              {item.raw}
            </pre>
          )}
          {item.location && (
            <p className="mt-2 text-[11px] text-text-tertiary">Observed in {item.location}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

function confidenceClass(confidence: Relationship['confidence']): string {
  switch (confidence) {
    case 'confirmed':
      return 'text-status-healthy'
    case 'likely':
      return 'text-text-secondary'
    case 'conflicting':
      return 'text-status-warning'
    default:
      return 'text-text-tertiary'
  }
}

function relationshipTypeLabel(relationship: Relationship): string {
  return relationship.label ?? relationship.type.replaceAll('_', ' ')
}

interface EvidenceInspectorProps {
  relationship: Relationship
  snapshot: TopologySnapshot
  serverId: ServerId
  onClose: () => void
}

export function EvidenceInspector({
  relationship,
  snapshot,
  serverId,
  onClose
}: EvidenceInspectorProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const fromEntity = snapshot.entities[relationship.from.id]
  const toEntity = snapshot.entities[relationship.to.id]
  const fromLabel = fromEntity?.label ?? relationship.from.id
  const toLabel = toEntity?.label ?? relationship.to.id
  const fromActions = fromEntity ? inspectorActions(fromEntity) : []
  const toActions = toEntity ? inspectorActions(toEntity) : []

  return (
    <InspectorPanel
      eyebrow="Why?"
      title={`${fromLabel} → ${toLabel}`}
      subtitle={relationshipTypeLabel(relationship)}
      onClose={onClose}
      headerExtra={
        <p className={cn('mt-2 text-xs capitalize', confidenceClass(relationship.confidence))}>
          {relationship.confidence}
        </p>
      }
    >
      <InspectorSection title="Relationship">
        <InspectorField label="From" value={fromLabel} mono />
        <InspectorField label="To" value={toLabel} mono />
        <InspectorField label="Type" value={relationshipTypeLabel(relationship)} />
        <InspectorField label="Confidence" value={relationship.confidence} />
      </InspectorSection>

      <InspectorSection title="Evidence">
        <RelationshipEvidence evidence={relationship.evidence} />
      </InspectorSection>

      {(fromActions.length > 0 || toActions.length > 0) && (
        <InspectorSection title="Jump to">
          <div className="flex flex-wrap gap-2">
            {fromActions.map((action) => (
              <Button
                key={`from-${action.label}`}
                size="sm"
                variant="ghost"
                onClick={() => openWithIntent(serverId, action.intent)}
              >
                {fromLabel}: {action.label}
              </Button>
            ))}
            {toActions.map((action) => (
              <Button
                key={`to-${action.label}`}
                size="sm"
                variant="ghost"
                onClick={() => openWithIntent(serverId, action.intent)}
              >
                {toLabel}: {action.label}
              </Button>
            ))}
          </div>
        </InspectorSection>
      )}
    </InspectorPanel>
  )
}
