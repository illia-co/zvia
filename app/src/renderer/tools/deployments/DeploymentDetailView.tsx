import { useEffect, useMemo, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import type { Deployment, Relationship, TopologyEntity, TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import { BackButton } from '@renderer/components/ui/back-button'
import { cn } from '@renderer/lib/utils'
import { DeploymentTopologyCanvas } from './DeploymentTopologyCanvas'
import { deploymentHealthDotClass } from './deploymentGraph'
import { EntityInspector } from './EntityInspector'
import { EvidenceInspector } from './EvidenceInspector'

interface DeploymentDetailViewProps {
  deployment: Deployment
  snapshot: TopologySnapshot
  serverId: ServerId
  initialEntityId?: string
  onBack: () => void
}

export function DeploymentDetailView({
  deployment,
  snapshot,
  serverId,
  initialEntityId,
  onBack
}: DeploymentDetailViewProps) {
  const [selectedRelationship, setSelectedRelationship] = useState<Relationship | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<TopologyEntity | null>(null)
  const [inspectorLayout, setInspectorLayout] = useState<Record<string, number>>({
    canvas: 65,
    inspector: 35
  })

  const deploymentEntityIds = useMemo(
    () => new Set(deployment.entityIds),
    [deployment.entityIds]
  )
  const hasSelection = selectedRelationship !== null || selectedEntity !== null

  useEffect(() => {
    if (!initialEntityId) return
    const entity = snapshot.entities[initialEntityId]
    if (entity && deployment.entityIds.includes(entity.id)) {
      setSelectedEntity(entity)
      setSelectedRelationship(null)
    }
  }, [deployment.entityIds, initialEntityId, snapshot.entities])

  const clearSelection = (): void => {
    setSelectedEntity(null)
    setSelectedRelationship(null)
  }

  const handleSelectRelationship = (relationshipId: string): void => {
    const relationship =
      snapshot.relationships.find((entry) => entry.id === relationshipId) ?? null
    setSelectedRelationship(relationship)
    setSelectedEntity(null)
  }

  const canvas = (
    <DeploymentTopologyCanvas
      deployment={deployment}
      snapshot={snapshot}
      selectedEntityId={selectedEntity?.id ?? null}
      selectedRelationshipId={selectedRelationship?.id ?? null}
      onSelectEntity={setSelectedEntity}
      onSelectRelationship={setSelectedRelationship}
      className="h-full w-full"
    />
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <BackButton onClick={onBack} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'size-2 shrink-0 rounded-full',
                deploymentHealthDotClass(deployment.health)
              )}
            />
            <span className="truncate font-mono text-xs text-text">{deployment.name}</span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        {hasSelection ? (
          <Group
            id="deployment-inspector-split"
            orientation="horizontal"
            defaultLayout={inspectorLayout}
            onLayoutChanged={setInspectorLayout}
            className="h-full min-h-0 flex-1"
          >
            <Panel id="deployment-canvas" minSize="40%" className="min-h-0 min-w-0">
              <div className="h-full p-3">{canvas}</div>
            </Panel>
            <Separator className="bg-divider" />
            <Panel
              id="deployment-inspector"
              minSize={288}
              defaultSize="35%"
              className="min-h-0 min-w-72"
            >
              {selectedRelationship ? (
                <EvidenceInspector
                  relationship={selectedRelationship}
                  snapshot={snapshot}
                  serverId={serverId}
                  onClose={clearSelection}
                />
              ) : selectedEntity ? (
                <EntityInspector
                  entity={selectedEntity}
                  snapshot={snapshot}
                  deploymentEntityIds={deploymentEntityIds}
                  serverId={serverId}
                  onClose={clearSelection}
                  onSelectRelationship={handleSelectRelationship}
                />
              ) : null}
            </Panel>
          </Group>
        ) : (
          <div className="min-h-0 min-w-0 flex-1 p-3">{canvas}</div>
        )}
      </div>
    </div>
  )
}
