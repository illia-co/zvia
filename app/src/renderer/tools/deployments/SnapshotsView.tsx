import { useEffect, useState } from 'react'
import type { DeploymentsDeploymentHistoryEntry } from '@shared/ipc'
import type { Deployment } from '@shared/topology'
import { Button } from '@renderer/components/ui/button'
import { BackButton } from '@renderer/components/ui/back-button'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { cn } from '@renderer/lib/utils'
import type { UseSnapshotsResult } from './useSnapshots'
import { deploymentHealthDotClass } from './deploymentGraph'

interface SnapshotsViewProps {
  snapshots: UseSnapshotsResult
  deployment: Deployment
  onBack: () => void
  onCompareSnapshots: (fromId: string, toId: string) => void
  onCompareToCurrent: (snapshotId: string) => void
}

/** Sentinel value for the "To" select that means the live/current state. */
const CURRENT_STATE_VALUE = '__current__'

const TAGGED_WARNING_THRESHOLD = 20

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString()
}

function defaultTagName(iso: string): string {
  const d = new Date(iso)
  const month = d.toLocaleString('default', { month: 'short' })
  const day = d.getDate()
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  return `Snapshot — ${month} ${day}, ${hours}:${minutes}`
}

function SnapshotOptionLabel({ entry }: { entry: DeploymentsDeploymentHistoryEntry }) {
  return (
    <span>
      {formatTimestamp(entry.scannedAt)}
      {entry.tags.length > 0 && (
        <span className="text-text-tertiary"> ({entry.tags.join(', ')})</span>
      )}
    </span>
  )
}

function TagInputPopover({
  snapshotId,
  deploymentId,
  defaultName,
  onTag
}: {
  snapshotId: string
  deploymentId: string
  defaultName: string
  onTag: (snapshotId: string, deploymentId: string, tag: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(defaultName)

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== 'latest') {
      onTag(snapshotId, deploymentId, trimmed)
      setOpen(false)
      setValue(defaultName)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded px-1.5 py-0.5 text-xs text-text-secondary hover:bg-bg-secondary hover:text-text"
          onClick={() => setValue(defaultName)}
        >
          + Tag
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Tag name</p>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="e.g. stable, pre-deploy"
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit}>
              Tag
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function TagCurrentButton({ onTag }: { onTag: (tag: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')

  const handleSubmit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== 'latest') {
      onTag(trimmed)
      setOpen(false)
      setValue('')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setValue(defaultTagName(new Date().toISOString()))}
        >
          Tag current
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="end">
        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-text-tertiary">Tag current state</p>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
            placeholder="e.g. stable, pre-deploy"
            autoFocus
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!value.trim()} onClick={handleSubmit}>
              Tag
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function SnapshotRow({
  entry,
  deploymentId,
  onAddTag,
  onRemoveTag,
  onCompareToCurrent
}: {
  entry: DeploymentsDeploymentHistoryEntry
  deploymentId: string
  onAddTag: (snapshotId: string, deploymentId: string, tag: string) => void
  onRemoveTag: (tag: string) => void
  onCompareToCurrent: (snapshotId: string) => void
}) {
  return (
    <tr className="group border-t border-divider hover:bg-bg-secondary">
      <td className="whitespace-nowrap px-5 py-2">
        <span className="font-mono text-xs text-text">{formatTimestamp(entry.scannedAt)}</span>
      </td>
      <td className="px-5 py-2">
        <div className="flex flex-wrap items-center gap-1">
          {entry.tags.length === 0 && <span className="text-text-tertiary">—</span>}
          {entry.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-sm bg-status-healthy/15 px-1.5 py-0.5 text-xs text-status-healthy"
            >
              {tag}
              <button
                type="button"
                className="text-status-healthy/60 hover:text-status-healthy"
                onClick={() => onRemoveTag(tag)}
              >
                ×
              </button>
            </span>
          ))}
          <TagInputPopover
            snapshotId={entry.id}
            deploymentId={deploymentId}
            defaultName={defaultTagName(entry.scannedAt)}
            onTag={onAddTag}
          />
        </div>
      </td>
      <td className="px-5 py-2">
        <span
          className={cn(
            'text-xs',
            entry.changeCount > 0 ? 'text-text-secondary' : 'text-text-tertiary'
          )}
        >
          {entry.summary}
        </span>
      </td>
      <td className="px-5 py-2 text-right">
        <Button size="sm" variant="ghost" onClick={() => onCompareToCurrent(entry.id)}>
          Compare to current
        </Button>
      </td>
    </tr>
  )
}

export function SnapshotsView({
  snapshots,
  deployment,
  onBack,
  onCompareSnapshots,
  onCompareToCurrent
}: SnapshotsViewProps) {
  const {
    deploymentHistory,
    historyLoading,
    error,
    addDeploymentTag,
    removeDeploymentTag,
    tagCurrent,
    loadDeploymentHistory,
    refresh
  } = snapshots

  const deploymentId = deployment.id

  useEffect(() => {
    void loadDeploymentHistory(deploymentId)
  }, [deploymentId, loadDeploymentHistory])

  const [fromId, setFromId] = useState<string | null>(null)
  const [toId, setToId] = useState<string | null>(null)

  const defaultFromId = deploymentHistory[0]?.id ?? null
  const selectedFrom = fromId ?? defaultFromId
  const selectedTo = toId ?? CURRENT_STATE_VALUE
  const canCompare = Boolean(selectedFrom && selectedTo && selectedTo !== selectedFrom)

  const handleCompare = (): void => {
    if (!selectedFrom || !selectedTo) return
    if (selectedTo === CURRENT_STATE_VALUE) {
      onCompareToCurrent(selectedFrom)
    } else {
      onCompareSnapshots(selectedFrom, selectedTo)
    }
  }

  const taggedCount = deploymentHistory.filter((entry) => entry.tags.length > 0).length

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-divider px-3 py-2">
        <div className="flex items-center gap-2">
          <BackButton onClick={onBack} />
          <span
            className={cn('size-2 shrink-0 rounded-full', deploymentHealthDotClass(deployment.health))}
          />
          <span className="truncate font-mono text-xs font-medium text-text">
            {deployment.name}
          </span>
          <span className="text-text-tertiary">·</span>
          <span className="text-xs text-text-secondary">Snapshots</span>
        </div>
        <div className="flex items-center gap-2">
          <TagCurrentButton onTag={(tag) => void tagCurrent(deploymentId, tag)} />
          <Button size="sm" variant="ghost" onClick={() => void refresh()}>
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
        <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Compare</span>
        <Select value={selectedFrom ?? ''} onValueChange={setFromId}>
          <SelectTrigger className="w-auto min-w-[140px]">
            <SelectValue placeholder="From snapshot" />
          </SelectTrigger>
          <SelectContent>
            {deploymentHistory.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <SnapshotOptionLabel entry={entry} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-text-tertiary">vs</span>
        <Select value={selectedTo ?? ''} onValueChange={setToId}>
          <SelectTrigger className="w-auto min-w-[140px]">
            <SelectValue placeholder="To snapshot" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={CURRENT_STATE_VALUE}>Current state</SelectItem>
            {deploymentHistory.map((entry) => (
              <SelectItem key={entry.id} value={entry.id}>
                <SnapshotOptionLabel entry={entry} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" disabled={!canCompare} onClick={handleCompare}>
          Compare
        </Button>
      </div>

      {taggedCount > TAGGED_WARNING_THRESHOLD && (
        <div className="border-b border-divider px-3 py-1.5 text-[10px] text-text-secondary">
          You have {taggedCount} tagged snapshots. Consider removing old tags.
        </div>
      )}

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {historyLoading ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading snapshots…</p>
        ) : deploymentHistory.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">
            No snapshots with changes for {deployment.name} yet.
          </p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-5 py-2 font-medium">Timestamp</th>
                <th className="px-5 py-2 font-medium">Tags</th>
                <th className="px-5 py-2 font-medium">Changes</th>
                <th className="px-5 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {deploymentHistory.map((entry) => (
                <SnapshotRow
                  key={entry.id}
                  entry={entry}
                  deploymentId={deploymentId}
                  onAddTag={addDeploymentTag}
                  onRemoveTag={(tag) => void removeDeploymentTag(entry.id, deploymentId, tag)}
                  onCompareToCurrent={onCompareToCurrent}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
