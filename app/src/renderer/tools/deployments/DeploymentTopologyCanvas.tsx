import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Deployment, Relationship, TopologyEntity, TopologySnapshot } from '@shared/topology'
import { Button } from '@renderer/components/ui/button'
import { useThemeStore } from '@renderer/state/themeStore'
import { cn } from '@renderer/lib/utils'
import { buildDeploymentGraph, type TopologyEdgeData, type TopologyNodeData } from './deploymentGraph'
import { layoutDeploymentGraph } from './layoutDeploymentGraph'
import { TopologyNode } from './TopologyNode'
import './topology-canvas.css'

const nodeTypes = {
  topologyNode: TopologyNode
}

function confidenceEdgeClass(confidence: Relationship['confidence']): string {
  switch (confidence) {
    case 'likely':
      return 'edge-confidence-likely'
    case 'unknown':
      return 'edge-confidence-unknown'
    case 'conflicting':
      return 'edge-confidence-conflicting'
    default:
      return 'edge-confidence-confirmed'
  }
}

interface DeploymentTopologyCanvasProps {
  deployment: Deployment
  snapshot: TopologySnapshot
  selectedEntityId: string | null
  selectedRelationshipId: string | null
  onSelectEntity: (entity: TopologyEntity | null) => void
  onSelectRelationship: (relationship: Relationship | null) => void
  className?: string
}

function CanvasControls() {
  const { fitView } = useReactFlow()

  return (
    <div className="absolute right-2 top-2 z-10">
      <Button
        size="sm"
        variant="ghost"
        className="h-7 px-2 text-[11px]"
        onClick={() => void fitView({ padding: 0.2 })}
      >
        Fit view
      </Button>
    </div>
  )
}

function DeploymentTopologyCanvasInner({
  deployment,
  snapshot,
  selectedEntityId,
  selectedRelationshipId,
  onSelectEntity,
  onSelectRelationship,
  className
}: DeploymentTopologyCanvasProps) {
  const themePreference = useThemeStore((state) => state.preference)
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const update = () => setIsDark(document.documentElement.classList.contains('dark'))
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [themePreference])

  const { nodes, edges } = useMemo(() => {
    const graph = buildDeploymentGraph(deployment, snapshot)
    const positionedNodes = layoutDeploymentGraph(graph.nodes, graph.edges).map((node) => ({
      ...node,
      selected: node.id === selectedEntityId
    }))
    const styledEdges = graph.edges.map((edge) => ({
      ...edge,
      selected: edge.id === selectedRelationshipId,
      className: cn(edge.className, confidenceEdgeClass(edge.data?.confidence ?? 'confirmed'))
    }))
    return { nodes: positionedNodes, edges: styledEdges }
  }, [deployment, snapshot, selectedEntityId, selectedRelationshipId])

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node<TopologyNodeData>) => {
      onSelectRelationship(null)
      onSelectEntity(node.data.entity)
    },
    [onSelectEntity, onSelectRelationship]
  )

  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge<TopologyEdgeData>) => {
      onSelectEntity(null)
      const relationship = edge.data?.relationship
      onSelectRelationship(relationship ?? null)
    },
    [onSelectEntity, onSelectRelationship]
  )

  const onPaneClick = useCallback(() => {
    onSelectEntity(null)
    onSelectRelationship(null)
  }, [onSelectEntity, onSelectRelationship])

  return (
    <div
      className={cn(
        'deployment-topology-canvas relative h-full w-full overflow-hidden rounded-panel border border-divider bg-bg',
        className
      )}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        colorMode={isDark ? 'dark' : 'light'}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
      >
        <CanvasControls />
      </ReactFlow>
    </div>
  )
}

export function DeploymentTopologyCanvas(props: DeploymentTopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <DeploymentTopologyCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
