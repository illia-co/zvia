/**
 * Lane assignment for the git history graph.
 * Pure function over `git log` order (newest first) using parent hashes,
 * so the renderer can draw an SVG lane graph instead of ascii art.
 */

export interface GraphCommit {
  hash: string
  /** Parent hashes. Missing (legacy payloads) is treated as no parents. */
  parents?: string[]
}

export interface GraphLink {
  /** Lane the commit node sits in. */
  from: number
  /** Lane the line joins. */
  to: number
  /**
   * `mid` joins the target lane at this row's node level (merge into a
   * lane that passes through). `bottom` curves into the bottom edge of the
   * target lane (new side branch continuing downward).
   */
  toEdge: 'mid' | 'bottom'
}

export interface GitGraphRow {
  hash: string
  nodeLane: number
  /** Max lane count across all rows; every row is padded to this width. */
  laneCount: number
  /** Line enters from the top edge per lane. */
  up: boolean[]
  /** Line leaves through the bottom edge per lane. */
  down: boolean[]
  links: GraphLink[]
}

export function layoutCommitGraph(commits: GraphCommit[]): GitGraphRow[] {
  const lanes: (string | null)[] = []
  const rows: GitGraphRow[] = []
  const outgoingPerRow: (string | null)[][] = []
  const incomingPerRow: (string | null)[][] = []

  const firstFreeLane = (): number => {
    const index = lanes.indexOf(null)
    return index === -1 ? lanes.length : index
  }

  for (const commit of commits) {
    let lane = lanes.indexOf(commit.hash)
    if (lane === -1) lane = firstFreeLane()
    // Snapshot before placing: a branch tip starting a fresh lane has no
    // line coming from above, while a tracked commit keeps its incoming line.
    incomingPerRow.push([...lanes])
    lanes[lane] = commit.hash

    const links: GraphLink[] = []
    const addLink = (from: number, to: number, toEdge: GraphLink['toEdge']): void => {
      if (from === to) return
      if (links.some((link) => link.from === from && link.to === to)) return
      links.push({ from, to, toEdge })
    }

    const [firstParent, ...restParents] = commit.parents ?? []
    if (firstParent == null || firstParent === '') {
      lanes[lane] = null
    } else {
      const existing = lanes.indexOf(firstParent)
      if (existing === -1) {
        lanes[lane] = firstParent
      } else {
        lanes[lane] = null
        addLink(lane, existing, 'mid')
      }
    }

    for (const parent of restParents) {
      if (!parent) continue
      const existing = lanes.indexOf(parent)
      if (existing === -1) {
        const fresh = firstFreeLane()
        lanes[fresh] = parent
        addLink(lane, fresh, 'bottom')
      } else {
        addLink(lane, existing, 'mid')
      }
    }

    while (lanes.length > 0 && lanes[lanes.length - 1] == null) lanes.pop()
    outgoingPerRow.push([...lanes])
    rows.push({ hash: commit.hash, nodeLane: lane, laneCount: 0, up: [], down: [], links })
  }

  const laneCount = Math.max(1, ...rows.map((row, index) => Math.max(row.nodeLane + 1, outgoingPerRow[index].length, incomingPerRow[index].length)))
  rows.forEach((row, index) => {
    row.laneCount = laneCount
    row.up = Array.from({ length: laneCount }, (_, c) => (incomingPerRow[index][c] ?? null) != null)
    row.down = Array.from({ length: laneCount }, (_, c) => (outgoingPerRow[index][c] ?? null) != null)
  })
  return rows
}
