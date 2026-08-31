import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@renderer/lib/utils'
import { entityStatusBorderClass, entityStatusDotClass, type TopologyNodeData } from './deploymentGraph'

function TopologyNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as TopologyNodeData
  const { entity, kindLabel, isEntrypoint, isShared } = nodeData

  return (
    <>
      <Handle type="target" position={Position.Top} className="!border-0 !bg-transparent !opacity-0" />
      <div
        className={cn(
          'flex h-14 w-[180px] flex-col justify-center rounded-panel border bg-bg-secondary px-3',
          entityStatusBorderClass(entity.status, { selected, isEntrypoint }),
          isShared && 'border-dashed'
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('size-2 shrink-0 rounded-full', entityStatusDotClass(entity.status))} />
          <span className="truncate font-mono text-xs text-text">{entity.label}</span>
        </div>
        <p className="mt-1 text-[10px] uppercase tracking-wider text-text-tertiary">
          {kindLabel}
          {isShared ? ' · Shared' : ''}
        </p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!border-0 !bg-transparent !opacity-0" />
    </>
  )
}

export const TopologyNode = memo(TopologyNodeComponent)
