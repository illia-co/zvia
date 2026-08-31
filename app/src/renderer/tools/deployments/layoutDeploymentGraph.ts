import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/react'
import type { TopologyEdgeData, TopologyNodeData } from './deploymentGraph'

export const TOPOLOGY_NODE_WIDTH = 180
export const TOPOLOGY_NODE_HEIGHT = 56

const DAGRE_OPTIONS = {
  rankdir: 'TB' as const,
  nodesep: 48,
  ranksep: 64
}

export function layoutDeploymentGraph(
  nodes: Node<TopologyNodeData>[],
  edges: Edge<TopologyEdgeData>[]
): Node<TopologyNodeData>[] {
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph(DAGRE_OPTIONS)

  for (const node of nodes) {
    graph.setNode(node.id, { width: TOPOLOGY_NODE_WIDTH, height: TOPOLOGY_NODE_HEIGHT })
  }

  for (const edge of edges) {
    graph.setEdge(edge.source, edge.target)
  }

  dagre.layout(graph)

  return nodes.map((node) => {
    const positioned = graph.node(node.id)
    return {
      ...node,
      position: {
        x: positioned.x - TOPOLOGY_NODE_WIDTH / 2,
        y: positioned.y - TOPOLOGY_NODE_HEIGHT / 2
      }
    }
  })
}
