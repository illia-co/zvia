import { useEffect, useMemo, useState } from 'react'
import { describeCronEditability, type CronJob, type CronTarget } from '@shared/cron'
import type { ZviaErrorPayload } from '@shared/errors'
import { BackButton } from '@renderer/components/ui/back-button'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ElevationRequired } from '@renderer/components/errors/ElevationRequired'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { elevationCommand, parseZviaError } from '@renderer/lib/errors'
import { useRequiredServerContext } from '@renderer/state/ServerContext'
import { useWorkspaceStore } from '@renderer/state/workspaceStore'
import { CronEditorDialog } from './CronEditorDialog'
import { CronJobDetailView } from './CronJobDetailView'
import { CRON_SOURCE_LABELS, CronTable } from './CronTable'
import { CrontabSourceDialog } from './CrontabSourceDialog'
import { useCron } from './useCron'

export function CronPanel() {
  const { serverId, connectionState } = useRequiredServerContext()
  const openTool = useWorkspaceStore((state) => state.openTool)

  const [search, setSearch] = useState('')
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [sourceOpen, setSourceOpen] = useState(false)
  const [editorJob, setEditorJob] = useState<CronJob | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CronJob | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [actionError, setActionError] = useState<ZviaErrorPayload | null>(null)

  const isConnected = connectionState === 'connected'
  const { listing, loaded, loading, error, clearError, reload } = useCron({
    serverId,
    isConnected
  })

  useEffect(() => {
    setSelectedJobId(null)
    setActionError(null)
  }, [serverId])

  const selectedJob = useMemo(
    () => listing.jobs.find((job) => job.id === selectedJobId) ?? null,
    [listing.jobs, selectedJobId]
  )

  useEffect(() => {
    if (selectedJobId && loaded && !selectedJob) {
      setSelectedJobId(null)
    }
  }, [loaded, selectedJob, selectedJobId])

  const editableTargets = useMemo<CronTarget[]>(() => {
    const targets: CronTarget[] = []
    if (listing.canEditUser) targets.push('user')
    if (listing.canEditRoot) targets.push('root')
    return targets
  }, [listing.canEditRoot, listing.canEditUser])

  const noEditableTargetsReason = loaded ? describeCronEditability(listing) : null

  const visibleJobs = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return listing.jobs
    return listing.jobs.filter((job) =>
      [job.schedule, job.description, job.command, job.user ?? '', CRON_SOURCE_LABELS[job.source]]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [listing.jobs, search])

  const submitJob = async (values: {
    target: CronTarget
    schedule: string
    command: string
  }): Promise<void> => {
    setSubmitting(true)
    setActionError(null)
    try {
      if (editorJob?.target) {
        await window.zvia.cron.updateJob({
          serverId,
          target: editorJob.target,
          jobId: editorJob.id,
          schedule: values.schedule,
          command: values.command
        })
      } else {
        await window.zvia.cron.createJob({
          serverId,
          target: values.target,
          schedule: values.schedule,
          command: values.command
        })
      }
      setEditorOpen(false)
      setEditorJob(null)
      await reload()
    } catch (err) {
      setActionError(parseZviaError(err))
    } finally {
      setSubmitting(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    const target = pendingDelete?.target
    if (!pendingDelete || !target) return
    setSubmitting(true)
    setActionError(null)
    try {
      await window.zvia.cron.deleteJob({ serverId, target, jobId: pendingDelete.id })
      setPendingDelete(null)
      setSelectedJobId(null)
      await reload()
    } catch (err) {
      setActionError(parseZviaError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <p className="text-sm text-text">Not connected</p>
          <p className="mt-2 text-xs text-text-secondary">
            Connect to this server to inspect scheduled jobs.
          </p>
        </div>
      </div>
    )
  }

  if (loaded && !listing.crontabAvailable && listing.jobs.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div className="max-w-sm">
          <p className="text-sm text-text">No cron on this server</p>
          <p className="mt-2 text-xs text-text-secondary">
            The crontab command is not available and no system cron files were found.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="mt-4"
            onClick={() => openTool(serverId, 'terminal')}
          >
            Open Terminal
          </Button>
        </div>
      </div>
    )
  }

  const elevation = actionError ? elevationCommand(actionError) : null

  return (
    <div className="flex h-full min-h-0 flex-col">
      {selectedJob ? (
        <div className="flex items-center gap-2 border-b border-divider px-3 py-2">
          <BackButton onClick={() => setSelectedJobId(null)} />
          <span className="truncate font-mono text-xs text-text-secondary">
            {selectedJob.command}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2 border-b border-divider px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search cron jobs"
            className="min-w-[140px] flex-1 rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none focus:border-text-tertiary"
          />
          {/* The title sits on the wrapper because a disabled button swallows hover. */}
          <span title={noEditableTargetsReason ?? undefined} className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={editableTargets.length === 0}
              onClick={() => {
                setEditorJob(null)
                setEditorOpen(true)
              }}
            >
              New Job
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={editableTargets.length === 0}
              onClick={() => setSourceOpen(true)}
            >
              View Source
            </Button>
          </span>
          <Button variant="ghost" size="sm" onClick={() => void reload()} disabled={loading}>
            Refresh
          </Button>
        </div>
      )}

      {!selectedJob && noEditableTargetsReason && (
        <p className="border-b border-divider px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
          {noEditableTargetsReason}
        </p>
      )}

      {(error || actionError) && (
        <div className="border-b border-divider p-3">
          {elevation && actionError ? (
            <ElevationRequired serverId={serverId} command={elevation} />
          ) : (
            <ErrorSurface
              error={actionError ?? error ?? ''}
              onDismiss={() => {
                setActionError(null)
                clearError()
              }}
            />
          )}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {selectedJob ? (
          <CronJobDetailView
            serverId={serverId}
            job={selectedJob}
            onEdit={(job) => {
              setEditorJob(job)
              setEditorOpen(true)
            }}
            onDelete={(job) => setPendingDelete(job)}
          />
        ) : (
          <CronTable
            jobs={visibleJobs}
            loading={loading && !loaded}
            onSelect={(job) => setSelectedJobId(job.id)}
          />
        )}
      </div>

      <CronEditorDialog
        open={editorOpen}
        job={editorJob}
        targets={editableTargets}
        submitting={submitting}
        onClose={() => {
          setEditorOpen(false)
          setEditorJob(null)
        }}
        onSubmit={(values) => void submitJob(values)}
      />

      <CrontabSourceDialog
        open={sourceOpen}
        serverId={serverId}
        targets={editableTargets}
        onClose={() => setSourceOpen(false)}
      />

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete cron job</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono">{pendingDelete?.schedule}</span>{' '}
              <span className="font-mono">{pendingDelete?.command}</span> from{' '}
              {pendingDelete ? CRON_SOURCE_LABELS[pendingDelete.source] : ''}? This cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {pendingDelete?.target === 'root' && (
            <p className="text-xs text-text-tertiary">Runs as root on the remote server.</p>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={submitting}
              onClick={() => void confirmDelete()}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
