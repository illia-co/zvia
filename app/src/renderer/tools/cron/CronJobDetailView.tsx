import { cronJobFilePath, type CronJob } from '@shared/cron'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useNavigationStore } from '@renderer/state/navigationStore'
import { CRON_SOURCE_LABELS } from './CronTable'

interface CronJobDetailViewProps {
  serverId: ServerId
  job: CronJob
  onEdit: (job: CronJob) => void
  onDelete: (job: CronJob) => void
}

interface DetailRowProps {
  label: string
  value: string
  mono?: boolean
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  return (
    <div className="flex gap-3 border-b border-divider py-1.5 last:border-b-0">
      <span className="w-32 shrink-0 text-[10px] uppercase tracking-wider text-text-tertiary">
        {label}
      </span>
      <span className={cn('min-w-0 break-words text-xs text-text-secondary', mono && 'font-mono')}>
        {value || '—'}
      </span>
    </div>
  )
}

export function CronJobDetailView({ serverId, job, onEdit, onDelete }: CronJobDetailViewProps) {
  const openWithIntent = useNavigationStore((state) => state.openWithIntent)
  const filePath = cronJobFilePath(job)

  return (
    <div>
      <div className="border-b border-divider px-4 py-3">
        <div className="font-mono text-sm text-text">{job.schedule}</div>
        <div className="mt-0.5 text-xs text-text-secondary">{job.description}</div>

        <div className="mt-3 flex flex-wrap gap-1">
          <Button
            size="sm"
            onClick={() => openWithIntent(serverId, { tool: 'terminal', command: job.command })}
          >
            Run Now
          </Button>
          {job.target && (
            <>
              <Button size="sm" variant="ghost" onClick={() => onEdit(job)}>
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-status-error hover:text-status-error"
                onClick={() => onDelete(job)}
              >
                Delete
              </Button>
            </>
          )}
          {filePath && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => openWithIntent(serverId, { tool: 'files', path: filePath })}
            >
              Open in Files
            </Button>
          )}
        </div>

        <p className="mt-3 text-[10px] text-text-tertiary">
          Run Now opens a Terminal session and runs the command there. Opening a job never runs
          it.
        </p>
      </div>

      <div className="px-4 py-3">
        <DetailRow label="Command" value={job.command} mono />
        <DetailRow label="User" value={job.user ?? ''} />
        <DetailRow label="Source" value={CRON_SOURCE_LABELS[job.source]} />
        <DetailRow
          label="Path"
          value={job.sourcePath.startsWith('/') ? job.sourcePath : ''}
          mono
        />
        <DetailRow label="Line" value={job.source === 'periodic' ? '—' : String(job.lineNumber)} />
        <DetailRow label="Raw" value={job.raw} mono />
      </div>

      {!job.target && (
        <div className="px-4 pb-4">
          <div className="rounded-panel bg-bg-secondary p-3">
            <p className="text-xs text-text">Read-only in this version</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">
              {job.source === 'periodic'
                ? 'run-parts scripts are managed as files.'
                : 'Relay edits user and root crontabs only.'}{' '}
              {filePath ? (
                <>
                  Use Open in Files to edit{' '}
                  <span className="font-mono text-text-secondary">{filePath}</span>.
                </>
              ) : (
                'This job has no file Relay can open.'
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
