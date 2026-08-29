import { useEffect, useMemo, useState } from 'react'
import type { CronJob, CronTarget } from '@shared/cron'
import { describeCron, validateCronExpression } from '@shared/cron'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

type SchedulePreset = 'minutes' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'reboot' | 'custom'

const PRESETS: { id: SchedulePreset; label: string }[] = [
  { id: 'minutes', label: 'Every N minutes' },
  { id: 'hourly', label: 'Hourly' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'reboot', label: 'At boot' },
  { id: 'custom', label: 'Custom expression' }
]

const WEEKDAYS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
]

const TARGET_LABELS: Record<CronTarget, string> = {
  user: 'User crontab',
  root: 'Root crontab'
}

interface BuilderState {
  preset: SchedulePreset
  interval: number
  minute: number
  hour: number
  weekday: number
  dayOfMonth: number
}

const DEFAULT_BUILDER: BuilderState = {
  preset: 'daily',
  interval: 5,
  minute: 0,
  hour: 3,
  weekday: 1,
  dayOfMonth: 1
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(Math.max(Math.trunc(value), min), max)
}

function buildExpression(state: BuilderState): string | null {
  switch (state.preset) {
    case 'minutes':
      return `*/${clamp(state.interval, 1, 59)} * * * *`
    case 'hourly':
      return `${clamp(state.minute, 0, 59)} * * * *`
    case 'daily':
      return `${clamp(state.minute, 0, 59)} ${clamp(state.hour, 0, 23)} * * *`
    case 'weekly':
      return `${clamp(state.minute, 0, 59)} ${clamp(state.hour, 0, 23)} * * ${clamp(state.weekday, 0, 6)}`
    case 'monthly':
      return `${clamp(state.minute, 0, 59)} ${clamp(state.hour, 0, 23)} ${clamp(state.dayOfMonth, 1, 31)} * *`
    case 'reboot':
      return '@reboot'
    default:
      return null
  }
}

interface CronEditorDialogProps {
  open: boolean
  job: CronJob | null
  targets: CronTarget[]
  submitting: boolean
  onClose: () => void
  onSubmit: (values: { target: CronTarget; schedule: string; command: string }) => void
}

const inputClass =
  'w-full rounded-panel border border-divider bg-bg px-2.5 py-1 text-xs text-text outline-none focus:border-text-tertiary'

export function CronEditorDialog({
  open,
  job,
  targets,
  submitting,
  onClose,
  onSubmit
}: CronEditorDialogProps) {
  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_BUILDER)
  const [raw, setRaw] = useState('0 3 * * *')
  const [command, setCommand] = useState('')
  const [target, setTarget] = useState<CronTarget>(targets[0] ?? 'user')

  useEffect(() => {
    if (!open) return
    setBuilder({ ...DEFAULT_BUILDER, preset: job ? 'custom' : 'daily' })
    setRaw(job?.schedule ?? '0 3 * * *')
    setCommand(job?.command ?? '')
    setTarget(job?.target ?? targets[0] ?? 'user')
  }, [job, open, targets])

  const validation = useMemo(() => validateCronExpression(raw), [raw])
  const description = useMemo(
    () => (validation.valid ? describeCron(raw) : null),
    [raw, validation.valid]
  )

  const updateBuilder = (patch: Partial<BuilderState>): void => {
    const next = { ...builder, ...patch }
    setBuilder(next)
    const expression = buildExpression(next)
    if (expression) setRaw(expression)
  }

  const canSubmit = validation.valid && command.trim().length > 0 && !submitting

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{job ? 'Edit cron job' : 'New cron job'}</DialogTitle>
          <DialogDescription>
            The raw expression is always what gets written to the crontab.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {targets.length > 1 && !job && (
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                Crontab
              </span>
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value as CronTarget)}
                className={`mt-1 ${inputClass}`}
              >
                {targets.map((option) => (
                  <option key={option} value={option}>
                    {TARGET_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Schedule
            </span>
            <select
              value={builder.preset}
              onChange={(event) =>
                updateBuilder({ preset: event.target.value as SchedulePreset })
              }
              className={`mt-1 ${inputClass}`}
            >
              {PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          {builder.preset === 'minutes' && (
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                Every (minutes)
              </span>
              <input
                type="number"
                min={1}
                max={59}
                value={builder.interval}
                onChange={(event) => updateBuilder({ interval: Number(event.target.value) })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          )}

          {builder.preset === 'hourly' && (
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                At minute
              </span>
              <input
                type="number"
                min={0}
                max={59}
                value={builder.minute}
                onChange={(event) => updateBuilder({ minute: Number(event.target.value) })}
                className={`mt-1 ${inputClass}`}
              />
            </label>
          )}

          {(builder.preset === 'daily' ||
            builder.preset === 'weekly' ||
            builder.preset === 'monthly') && (
            <div className="flex gap-2">
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  Hour
                </span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={builder.hour}
                  onChange={(event) => updateBuilder({ hour: Number(event.target.value) })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              <label className="flex-1">
                <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                  Minute
                </span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={builder.minute}
                  onChange={(event) => updateBuilder({ minute: Number(event.target.value) })}
                  className={`mt-1 ${inputClass}`}
                />
              </label>
              {builder.preset === 'weekly' && (
                <label className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                    Day
                  </span>
                  <select
                    value={builder.weekday}
                    onChange={(event) => updateBuilder({ weekday: Number(event.target.value) })}
                    className={`mt-1 ${inputClass}`}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>
                        {day.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {builder.preset === 'monthly' && (
                <label className="flex-1">
                  <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
                    Day of month
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={builder.dayOfMonth}
                    onChange={(event) => updateBuilder({ dayOfMonth: Number(event.target.value) })}
                    className={`mt-1 ${inputClass}`}
                  />
                </label>
              )}
            </div>
          )}

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Raw expression
            </span>
            <input
              type="text"
              value={raw}
              spellCheck={false}
              onChange={(event) => {
                setRaw(event.target.value)
                setBuilder((current) => ({ ...current, preset: 'custom' }))
              }}
              className={`mt-1 font-mono ${inputClass}`}
            />
          </label>

          <p className="text-xs text-text-secondary">
            {validation.valid ? (
              description
            ) : (
              <span className="text-status-error">{validation.error}</span>
            )}
          </p>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Command</span>
            <input
              type="text"
              value={command}
              spellCheck={false}
              placeholder="/usr/local/bin/backup.sh"
              onChange={(event) => setCommand(event.target.value)}
              className={`mt-1 font-mono ${inputClass}`}
            />
          </label>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ target, schedule: raw.trim(), command: command.trim() })
            }
          >
            {job ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
