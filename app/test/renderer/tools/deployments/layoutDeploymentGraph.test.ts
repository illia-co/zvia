import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/react'
import type { TopologyEdgeData, TopologyNodeData } from '@renderer/tools/deployments/deploymentGraph'
import { layoutDeploymentGraph } from '@renderer/tools/deployments/layoutDeploymentGraph'

function node(id: string): Node<TopologyNodeData> {
  return {
    id,
    type: 'topologyNode',
    position: { x: 0, y: 0 },
    data: {
      entity: {
        id,
        kind: 'domain',
        label: id,
        status: 'healthy'
      },
      kindLabel: 'Domain',
      isEntrypoint: id === 'a'
    }
  }
}

function edge(source: string, target: string): Edge<TopologyEdgeData> {
  return {
    id: `${source}-${target}`,
    source,
    target,
    type: 'smoothstep',
    data: {
      relationship: {
        id: `${source}-${target}`,
        from: { kind: 'domain', id: source },
        to: { kind: 'domain', id: target },
        type: 'proxies_to',
        confidence: 'confirmed',
        evidence: []
      },
      confidence: 'confirmed'
    }
  }
}

describe('layoutDeploymentGraph', () => {
  it('assigns x/y positions to every node', () => {
    const nodes = [node('a'), node('b'), node('c')]
    const edges = [edge('a', 'b'), edge('b', 'c')]
    const positioned = layoutDeploymentGraph(nodes, edges)
    const byId = Object.fromEntries(positioned.map((positionedNode) => [positionedNode.id, positionedNode]))

    for (const positionedNode of positioned) {
      expect(Number.isFinite(positionedNode.position.x)).toBe(true)
      expect(Number.isFinite(positionedNode.position.y)).toBe(true)
    }

    expect(byId.a!.position.y).toBeLessThan(byId.b!.position.y)
    expect(byId.b!.position.y).toBeLessThan(byId.c!.position.y)
  })

  it('places rank-0 nodes on the same horizontal line without overlap', () => {
    const nodes = [node('a'), node('b')]
    const edges: Edge<TopologyEdgeData>[] = []
    const positioned = layoutDeploymentGraph(nodes, edges)

    expect(positioned[0]?.position.y).toBe(positioned[1]?.position.y)
    expect(positioned[0]?.position.x).not.toBe(positioned[1]?.position.x)
  })
})
