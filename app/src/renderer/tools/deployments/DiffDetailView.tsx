import { useEffect } from 'react'
import type { TopologyChange, Deployment, TopologySnapshot } from '@shared/topology'
import type { ServerId } from '@shared/server'
import type { UseSnapshotsResult } from './useSnapshots'
import { SnapshotDetailView } from './SnapshotDetailView'

export type DiffRequest =
  | { type: 'live'; baselineId: string }
  | { type: 'snapshots'; fromId: string; toId: string }

interface DiffDetailViewProps {
  snapshots: UseSnapshotsResult
  deployment: Deployment
  snapshot: TopologySnapshot | null
  serverId: ServerId
  request: DiffRequest
  onBack: () => void
}

function formatTimestamp(iso: string): string {
  return iso ? new Date(iso).toLocaleString() : 'Snapshot'
}

export function DiffDetailView({
  snapshots,
  deployment,
  snapshot,
  serverId,
  request,
  onBack
}: DiffDetailViewProps) {
  const { liveDiffResult, diffResult, loading, compareWithCurrent, compareSnapshots } = snapshots

  useEffect(() => {
    if (request.type === 'live') {
      void compareWithCurrent(request.baselineId, deployment.id)
    } else {
      void compareSnapshots(request.fromId, request.toId, deployment.id)
    }
  }, [request, deployment.id, compareWithCurrent, compareSnapshots])

  let changes: TopologyChange[] = []
  let fromLabel: string
  let toLabel: string

  if (request.type === 'live') {
    const matching =
      liveDiffResult && liveDiffResult.baselineId === request.baselineId
        ? liveDiffResult
        : null
    changes = matching?.changes ?? []
    fromLabel = formatTimestamp(matching?.baselineScannedAt ?? request.baselineId)
    toLabel = 'Current (live)'
  } else {
    const matching =
      diffResult && diffResult.fromId === request.fromId && diffResult.toId === request.toId
        ? diffResult
        : null
    changes = matching?.changes ?? []
    fromLabel = formatTimestamp(matching?.fromScannedAt ?? request.fromId)
    toLabel = formatTimestamp(matching?.toScannedAt ?? request.toId)
  }

  return (
    <SnapshotDetailView
      deployment={deployment}
      changes={changes}
      fromLabel={fromLabel}
      toLabel={toLabel}
      snapshot={snapshot}
      serverId={serverId}
      onBack={onBack}
      loading={loading}
    />
  )
}
