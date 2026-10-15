import { describe, expect, it } from 'vitest'
import { layoutCommitGraph } from '@renderer/tools/git/gitGraph'

describe('layoutCommitGraph', () => {
  it('lays linear history on a single lane', () => {
    const rows = layoutCommitGraph([
      { hash: 'c1', parents: ['c2'] },
      { hash: 'c2', parents: ['c3'] },
      { hash: 'c3', parents: [] }
    ])
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.nodeLane)).toEqual([0, 0, 0])
    expect(rows.map((row) => row.laneCount)).toEqual([1, 1, 1])
    expect(rows[0].up).toEqual([false])
    expect(rows[0].down).toEqual([true])
    expect(rows[1].up).toEqual([true])
    expect(rows[1].down).toEqual([true])
    expect(rows[2].up).toEqual([true])
    expect(rows[2].down).toEqual([false])
    expect(rows.flatMap((row) => row.links)).toEqual([])
  })

  it('opens a second lane for a side branch and joins it at the merge', () => {
    const rows = layoutCommitGraph([
      { hash: 'm1', parents: ['c2', 'b1'] },
      { hash: 'c2', parents: ['c3'] },
      { hash: 'b1', parents: ['c3'] },
      { hash: 'c3', parents: [] }
    ])
    expect(rows.map((row) => row.laneCount)).toEqual([2, 2, 2, 2])
    // Merge row branches out to a new lane curving downward.
    expect(rows[0].links).toEqual([{ from: 0, to: 1, toEdge: 'bottom' }])
    // Main line stays on lane 0, side branch on lane 1.
    expect(rows[1].nodeLane).toBe(0)
    expect(rows[1].links).toEqual([])
    expect(rows[2].nodeLane).toBe(1)
    // Side branch joins back into lane 0 on its own row and ends there.
    expect(rows[2].links).toEqual([{ from: 1, to: 0, toEdge: 'mid' }])
    expect(rows[2].up).toEqual([true, true])
    expect(rows[2].down).toEqual([true, false])
    // Base commit ends the remaining lane.
    expect(rows[3].nodeLane).toBe(0)
    expect(rows[3].links).toEqual([])
    expect(rows[3].up).toEqual([true, false])
    expect(rows[3].down).toEqual([false, false])
  })

  it('handles a lone root commit', () => {
    const rows = layoutCommitGraph([{ hash: 'only', parents: [] }])
    expect(rows).toHaveLength(1)
    expect(rows[0].nodeLane).toBe(0)
    expect(rows[0].laneCount).toBe(1)
    expect(rows[0].up).toEqual([false])
    expect(rows[0].down).toEqual([false])
  })

  it('tolerates legacy entries without a parents field', () => {
    const rows = layoutCommitGraph([{ hash: 'a' }, { hash: 'b' }])
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.nodeLane)).toEqual([0, 0])
    expect(rows[0].down).toEqual([false])
    expect(rows[1].up).toEqual([false])
  })
})
