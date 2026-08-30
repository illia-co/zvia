/**
 * Pure cron parsing, validation, and description helpers.
 *
 * This module must stay free of Node and Electron imports so it can be used
 * from the main process, the preload bridge, and the renderer.
 */

export type CronSource =
  | 'user-crontab'
  | 'root-crontab'
  | 'system-crontab'
  | 'cron.d'
  | 'periodic'

/** Crontabs Zvia can install in v1. */
export type CronTarget = 'user' | 'root'

export interface CronJob {
  id: string
  /** The line exactly as it appears in the crontab. */
  raw: string
  /** The raw schedule expression, always preserved verbatim. */
  schedule: string
  command: string
  user?: string
  source: CronSource
  sourcePath: string
  lineNumber: number
  description: string
  valid: boolean
  /** Present only when the job lives in an editable crontab. */
  target?: CronTarget
}

export interface CronListResponse {
  jobs: CronJob[]
  crontabAvailable: boolean
  canEditUser: boolean
  canEditRoot: boolean
}

/**
 * Absolute path of the file backing a job, or null when the job lives in a
 * crontab that is only reachable through `crontab -l`. run-parts entries are
 * scripts, so the command *is* the file; the other file-backed sources record
 * the file in `sourcePath`.
 */
export function cronJobFilePath(job: CronJob): string | null {
  if (job.source === 'periodic') {
    return job.command.startsWith('/') ? job.command : null
  }
  return job.sourcePath.startsWith('/') ? job.sourcePath : null
}

/**
 * Explains why job creation and editing are unavailable, or null when at least
 * one crontab can be written. A disabled New Job button with no explanation is
 * indistinguishable from a bug.
 */
export function describeCronEditability(listing: CronListResponse): string | null {
  if (listing.canEditUser || listing.canEditRoot) return null
  if (!listing.crontabAvailable) {
    return 'The crontab command is not available on this server, so Zvia cannot create or edit scheduled jobs. Anything listed here comes from system cron files and is read-only.'
  }
  return 'Neither your own crontab nor root’s crontab can be written from this connection, so Zvia cannot create or edit scheduled jobs. Anything listed here is read-only.'
}

export interface CrontabSource {
  target: CronTarget
  /** Verbatim `crontab -l` output. Empty when the crontab has no content. */
  content: string
}

export interface CronValidationResult {
  valid: boolean
  error?: string
}

export interface ParsedCronLine {
  schedule: string
  command: string
  user?: string
}

export interface ParseCrontabOptions {
  source: CronSource
  sourcePath: string
  /** /etc/crontab and /etc/cron.d entries carry a user field; user crontabs do not. */
  hasUserField?: boolean
  defaultUser?: string
  target?: CronTarget
}

const SPECIAL_DESCRIPTIONS: Record<string, string> = {
  '@reboot': 'At system boot',
  '@yearly': 'Every year on January 1 at 00:00',
  '@annually': 'Every year on January 1 at 00:00',
  '@monthly': 'Every month on day 1 at 00:00',
  '@weekly': 'Every week on Sunday at 00:00',
  '@daily': 'Every day at 00:00',
  '@midnight': 'Every day at 00:00',
  '@hourly': 'Every hour at minute 0'
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December'
]

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
]

const MONTH_ALIASES: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12
}

const DAY_ALIASES: Record<string, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6
}

interface FieldSpec {
  label: string
  min: number
  max: number
  aliases?: Record<string, number>
}

const FIELD_SPECS: FieldSpec[] = [
  { label: 'minute', min: 0, max: 59 },
  { label: 'hour', min: 0, max: 23 },
  { label: 'day of month', min: 1, max: 31 },
  { label: 'month', min: 1, max: 12, aliases: MONTH_ALIASES },
  { label: 'day of week', min: 0, max: 7, aliases: DAY_ALIASES }
]

export const CRON_SPECIAL_SCHEDULES = Object.keys(SPECIAL_DESCRIPTIONS)

function isWhitespace(character: string): boolean {
  return character === ' ' || character === '\t'
}

/** Splits the leading `count` whitespace-delimited tokens, preserving the remainder verbatim. */
function takeTokens(text: string, count: number): { tokens: string[]; rest: string } | null {
  const tokens: string[] = []
  let index = 0

  for (let taken = 0; taken < count; taken += 1) {
    while (index < text.length && isWhitespace(text[index])) index += 1
    const start = index
    while (index < text.length && !isWhitespace(text[index])) index += 1
    if (index === start) return null
    tokens.push(text.slice(start, index))
  }

  while (index < text.length && isWhitespace(text[index])) index += 1
  return { tokens, rest: text.slice(index) }
}

function isEnvironmentAssignment(line: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(line)
}

function resolveFieldNumber(token: string, spec: FieldSpec): number | null {
  if (/^\d+$/.test(token)) {
    const value = Number(token)
    if (value < spec.min || value > spec.max) return null
    return value
  }
  const alias = spec.aliases?.[token.toLowerCase()]
  return alias ?? null
}

function isValidFieldPart(part: string, spec: FieldSpec): boolean {
  const segments = part.split('/')
  if (segments.length > 2) return false

  const [range, step] = segments
  if (step !== undefined) {
    if (!/^\d+$/.test(step)) return false
    const stepValue = Number(step)
    if (stepValue < 1 || stepValue > spec.max) return false
  }

  if (range === '*') return true

  const bounds = range.split('-')
  if (bounds.length > 2) return false

  const values = bounds.map((bound) => resolveFieldNumber(bound, spec))
  if (values.some((value) => value === null)) return false
  if (values.length === 2 && (values[0] as number) > (values[1] as number)) return false
  return true
}

function isValidField(field: string, spec: FieldSpec): boolean {
  const parts = field.split(',')
  if (parts.length === 0) return false
  return parts.every((part) => isValidFieldPart(part, spec))
}

export function validateCronExpression(expression: string): CronValidationResult {
  const trimmed = expression.trim()
  if (!trimmed) {
    return { valid: false, error: 'schedule is empty' }
  }

  if (trimmed.startsWith('@')) {
    if (SPECIAL_DESCRIPTIONS[trimmed.toLowerCase()] === undefined) {
      return {
        valid: false,
        error: `unknown special schedule "${trimmed}"`
      }
    }
    return { valid: true }
  }

  const fields = trimmed.split(/\s+/)
  if (fields.length !== 5) {
    return {
      valid: false,
      error: `expected 5 fields or a special schedule, received ${fields.length}`
    }
  }

  for (let index = 0; index < FIELD_SPECS.length; index += 1) {
    const spec = FIELD_SPECS[index]
    if (!isValidField(fields[index], spec)) {
      return { valid: false, error: `invalid ${spec.label} field "${fields[index]}"` }
    }
  }

  return { valid: true }
}

export function parseCronLine(
  line: string,
  options: { hasUserField?: boolean } = {}
): ParsedCronLine | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return null
  if (isEnvironmentAssignment(trimmed)) return null

  let schedule: string
  let remainder: string

  if (trimmed.startsWith('@')) {
    const taken = takeTokens(trimmed, 1)
    if (!taken) return null
    const special = taken.tokens[0].toLowerCase()
    if (SPECIAL_DESCRIPTIONS[special] === undefined) return null
    schedule = special
    remainder = taken.rest
  } else {
    const taken = takeTokens(trimmed, 5)
    if (!taken) return null
    schedule = taken.tokens.join(' ')
    remainder = taken.rest
  }

  let user: string | undefined
  if (options.hasUserField) {
    const taken = takeTokens(remainder, 1)
    if (!taken) return null
    user = taken.tokens[0]
    remainder = taken.rest
  }

  const command = remainder.trim()
  if (!command) return null

  return { schedule, command, user }
}

export function parseCrontab(content: string, options: ParseCrontabOptions): CronJob[] {
  const jobs: CronJob[] = []
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    const parsed = parseCronLine(line, { hasUserField: options.hasUserField })
    if (!parsed) return

    const lineNumber = index + 1
    jobs.push({
      id: `${options.source}:${options.sourcePath}:${lineNumber}`,
      raw: line.trim(),
      schedule: parsed.schedule,
      command: parsed.command,
      user: parsed.user ?? options.defaultUser,
      source: options.source,
      sourcePath: options.sourcePath,
      lineNumber,
      description: describeCron(parsed.schedule),
      valid: validateCronExpression(parsed.schedule).valid,
      target: options.target
    })
  })

  return jobs
}

function isNumericField(field: string): boolean {
  return /^\d+$/.test(field)
}

function stepOfEveryField(field: string): number | null {
  const match = /^\*\/(\d+)$/.exec(field)
  if (!match) return null
  const step = Number(match[1])
  return step >= 1 ? step : null
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

function formatTime(hour: number, minute: number): string {
  return `${pad(hour)}:${pad(minute)}`
}

function joinList(items: string[]): string {
  if (items.length === 1) return items[0]
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

function describeDayOfWeek(field: string): string | null {
  if (field === '*') return null

  const spec = FIELD_SPECS[4]
  const labels: string[] = []

  for (const part of field.split(',')) {
    if (part.includes('/')) return null
    const bounds = part.split('-')
    if (bounds.length === 1) {
      const value = resolveFieldNumber(bounds[0], spec)
      if (value === null) return null
      labels.push(DAY_NAMES[value % 7])
      continue
    }
    if (bounds.length === 2) {
      const from = resolveFieldNumber(bounds[0], spec)
      const to = resolveFieldNumber(bounds[1], spec)
      if (from === null || to === null) return null
      labels.push(`${DAY_NAMES[from % 7]} to ${DAY_NAMES[to % 7]}`)
      continue
    }
    return null
  }

  return joinList(labels)
}

/**
 * Produces human-readable text for common schedules. Unrecognized but valid
 * expressions fall back to the raw expression, which callers always display too.
 */
export function describeCron(expression: string): string {
  const trimmed = expression.trim()

  if (trimmed.startsWith('@')) {
    return SPECIAL_DESCRIPTIONS[trimmed.toLowerCase()] ?? trimmed
  }
  if (!validateCronExpression(trimmed).valid) return trimmed

  const [minute, hour, dayOfMonth, month, dayOfWeek] = trimmed.split(/\s+/)
  const everyDay = dayOfMonth === '*' && month === '*' && dayOfWeek === '*'

  if (everyDay) {
    if (minute === '*' && hour === '*') return 'Every minute'

    const minuteStep = stepOfEveryField(minute)
    if (minuteStep !== null && hour === '*') {
      return minuteStep === 1 ? 'Every minute' : `Every ${minuteStep} minutes`
    }

    if (isNumericField(minute)) {
      const hourStep = stepOfEveryField(hour)
      if (hourStep !== null) {
        return hourStep === 1
          ? `Every hour at minute ${Number(minute)}`
          : `Every ${hourStep} hours at minute ${Number(minute)}`
      }
      if (hour === '*') return `Every hour at minute ${Number(minute)}`
      if (isNumericField(hour)) {
        return `Every day at ${formatTime(Number(hour), Number(minute))}`
      }
    }

    return trimmed
  }

  if (isNumericField(minute) && isNumericField(hour)) {
    const time = formatTime(Number(hour), Number(minute))

    if (month === '*' && dayOfMonth === '*') {
      const days = describeDayOfWeek(dayOfWeek)
      if (days) return `Every week on ${days} at ${time}`
    }
    if (month === '*' && dayOfWeek === '*' && isNumericField(dayOfMonth)) {
      return `Every month on day ${Number(dayOfMonth)} at ${time}`
    }
    if (dayOfWeek === '*' && isNumericField(dayOfMonth) && isNumericField(month)) {
      return `Every year on ${MONTH_NAMES[Number(month) - 1]} ${Number(dayOfMonth)} at ${time}`
    }
  }

  return trimmed
}
