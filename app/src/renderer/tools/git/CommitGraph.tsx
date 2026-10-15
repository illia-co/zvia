import type { GitGraphRow } from './gitGraph'

const LANE_WIDTH = 16
export const GRAPH_ROW_HEIGHT = 48
const NODE_RADIUS = 4.5
const LINE_WIDTH = 2

const LANE_COLORS = [
  'var(--color-graph-1)',
  'var(--color-graph-2)',
  'var(--color-graph-3)',
  'var(--color-graph-4)',
  'var(--color-graph-5)',
  'var(--color-graph-6)'
]

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length]
}

interface CommitGraphProps {
  rows: GitGraphRow[]
  /** Row indexes with a filled node (e.g. the checked-out HEAD commit). */
  highlights?: Set<number>
}

/**
 * Single continuous SVG rail for the history lane graph. One svg spans all
 * rows so lane lines never gap at row boundaries; rows are fixed-height
 * (`GRAPH_ROW_HEIGHT`) to keep nodes aligned with their commits.
 * Lanes are colored per index, like GitLens.
 */
export function CommitGraph({ rows, highlights }: CommitGraphProps) {
  if (rows.length === 0) return null
  const laneCount = rows[0].laneCount
  const height = rows.length * GRAPH_ROW_HEIGHT
  const x = (lane: number): number => lane * LANE_WIDTH + LANE_WIDTH / 2
  const mid = (index: number): number => index * GRAPH_ROW_HEIGHT + GRAPH_ROW_HEIGHT / 2
  const bottom = (index: number): number => (index + 1) * GRAPH_ROW_HEIGHT

  return (
    <svg
      width={laneCount * LANE_WIDTH}
      height={height}
      className="shrink-0 self-stretch"
      aria-hidden
    >
      {rows.map((row, index) => (
        <g key={row.hash}>
          {row.up.map(
            (visible, lane) =>
              visible && (
                <line
                  key={`up-${lane}`}
                  x1={x(lane)}
                  y1={index * GRAPH_ROW_HEIGHT}
                  x2={x(lane)}
                  y2={mid(index)}
                  stroke={laneColor(lane)}
                  strokeWidth={LINE_WIDTH}
                />
              )
          )}
          {row.down.map(
            (visible, lane) =>
              visible && (
                <line
                  key={`down-${lane}`}
                  x1={x(lane)}
                  y1={mid(index)}
                  x2={x(lane)}
                  y2={bottom(index)}
                  stroke={laneColor(lane)}
                  strokeWidth={LINE_WIDTH}
                />
              )
          )}
          {row.links.map((link, linkIndex) =>
            link.toEdge === 'bottom' ? (
              <path
                key={`link-${linkIndex}`}
                d={`M ${x(link.from)} ${mid(index)} Q ${x(link.from)} ${bottom(index)} ${x(link.to)} ${bottom(index)}`}
                fill="none"
                stroke={laneColor(link.from)}
                strokeWidth={LINE_WIDTH}
              />
            ) : (
              <line
                key={`link-${linkIndex}`}
                x1={x(link.from)}
                y1={mid(index)}
                x2={x(link.to)}
                y2={mid(index)}
                stroke={laneColor(link.from)}
                strokeWidth={LINE_WIDTH}
              />
            )
          )}
          <circle
            cx={x(row.nodeLane)}
            cy={mid(index)}
            r={NODE_RADIUS}
            fill={highlights?.has(index) ? laneColor(row.nodeLane) : 'var(--color-bg)'}
            stroke={laneColor(row.nodeLane)}
            strokeWidth={LINE_WIDTH}
          />
        </g>
      ))}
    </svg>
  )
}
