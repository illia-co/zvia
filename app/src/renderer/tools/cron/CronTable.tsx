import type { CronJob, CronSource } from '@shared/cron'
import { Button } from '@renderer/components/ui/button'

export const CRON_SOURCE_LABELS: Record<CronSource, string> = {
  'user-crontab': 'User crontab',
  'root-crontab': 'Root crontab',
  'system-crontab': '/etc/crontab',
  'cron.d': '/etc/cron.d',
  periodic: 'run-parts'
}

interface CronTableProps {
  jobs: CronJob[]
  loading: boolean
  onSelect: (job: CronJob) => void
}

export function CronTable({ jobs, loading, onSelect }: CronTableProps) {
  if (loading && jobs.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">Loading cron jobs…</p>
  }

  if (jobs.length === 0) {
    return <p className="p-6 text-center text-xs text-text-secondary">No cron jobs found.</p>
  }

  return (
    <table className="w-full text-left text-xs">
      <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
        <tr>
          <th className="px-3 py-2 font-medium">Schedule</th>
          <th className="px-3 py-2 font-medium">Command</th>
          <th className="px-3 py-2 font-medium">User</th>
          <th className="px-3 py-2 font-medium">Source</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium" />
        </tr>
      </thead>
      <tbody>
        {jobs.map((job) => (
          <tr key={job.id} className="border-t border-divider align-top">
            <td className="px-3 py-2">
              <div className="font-mono text-text">{job.schedule}</div>
              {job.description !== job.schedule && (
                <div className="text-[10px] text-text-tertiary">{job.description}</div>
              )}
            </td>
            <td className="max-w-[24rem] px-3 py-2">
              <button
                type="button"
                onClick={() => onSelect(job)}
                className="block w-full truncate text-left font-mono text-text-secondary hover:text-text hover:underline"
              >
                {job.command}
              </button>
            </td>
            <td className="px-3 py-2 text-text-secondary">{job.user ?? '—'}</td>
            <td className="px-3 py-2 text-text-secondary">{CRON_SOURCE_LABELS[job.source]}</td>
            <td className="px-3 py-2">
              {!job.valid ? (
                <span className="text-status-error">Invalid schedule</span>
              ) : job.target ? (
                <span className="text-text-secondary">Editable</span>
              ) : (
                <span className="text-text-tertiary">Read-only</span>
              )}
            </td>
            <td className="px-3 py-2">
              <Button size="sm" variant="ghost" onClick={() => onSelect(job)}>
                Details
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
