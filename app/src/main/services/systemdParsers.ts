import type { SystemdUnit, SystemdUnitDetail } from '@shared/systemd'

export interface SystemdListRow {
  unit: string
  load: string
  active: string
  sub: string
  description: string
}

const UNIT_SUFFIX_PATTERN =
  /\.(service|socket|target|timer|path|mount|automount|slice|scope|device|swap)$/

/**
 * `systemctl list-units` prefixes failed and activating units with a status
 * glyph (or its ASCII fallback). The marker must be followed by whitespace so
 * unit names are never truncated.
 */
const LEADING_MARKER_PATTERN = /^\s*(?:[●↻→]|->|\*)\s+/

function stripMarker(line: string): string {
  return line.replace(LEADING_MARKER_PATTERN, '').trim()
}

function isUnitName(value: string): boolean {
  return UNIT_SUFFIX_PATTERN.test(value)
}

function stringField(record: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string') return value
  }
  return ''
}

/**
 * Parses `systemctl list-units --output=json`. Returns null when the output is
 * not JSON, which happens on systemd versions without `--output=json`.
 */
export function parseListUnitsJson(stdout: string): SystemdListRow[] | null {
  const trimmed = stdout.trim()
  if (!trimmed.startsWith('[')) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  const rows: SystemdListRow[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const record = entry as Record<string, unknown>
    const unit = stringField(record, 'unit', 'UNIT', 'id')
    if (!isUnitName(unit)) continue
    rows.push({
      unit,
      load: stringField(record, 'load', 'loadState', 'LOAD'),
      active: stringField(record, 'active', 'activeState', 'ACTIVE'),
      sub: stringField(record, 'sub', 'subState', 'SUB'),
      description: stringField(record, 'description', 'DESCRIPTION')
    })
  }
  return rows
}

/** Parses `systemctl list-units --plain --no-legend` for older systemd. */
export function parseListUnitsPlain(stdout: string): SystemdListRow[] {
  const rows: SystemdListRow[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = stripMarker(rawLine)
    if (!line) continue

    const match = /^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/.exec(line)
    if (!match) continue
    if (!isUnitName(match[1])) continue

    rows.push({
      unit: match[1],
      load: match[2],
      active: match[3],
      sub: match[4],
      description: match[5].trim()
    })
  }

  return rows
}

/** Parses `systemctl list-unit-files --plain --no-legend` into unit -> state. */
export function parseUnitFileStates(stdout: string): Map<string, string> {
  const states = new Map<string, string>()

  for (const rawLine of stdout.split('\n')) {
    const line = stripMarker(rawLine)
    if (!line) continue

    const match = /^(\S+)\s+(\S+)/.exec(line)
    if (!match) continue
    if (!isUnitName(match[1])) continue

    states.set(match[1], match[2])
  }

  return states
}

/** Parses `systemctl show` key=value output. */
export function parseShowProperties(stdout: string): Map<string, string> {
  const properties = new Map<string, string>()

  for (const line of stdout.split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    properties.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim())
  }

  return properties
}

export function mergeUnits(
  rows: SystemdListRow[],
  unitFileStates: Map<string, string>
): SystemdUnit[] {
  return rows
    .map((row) => ({
      unit: row.unit,
      description: row.description,
      loadState: row.load,
      activeState: row.active,
      subState: row.sub,
      unitFileState: unitFileStates.get(row.unit) ?? ''
    }))
    .sort((a, b) => a.unit.localeCompare(b.unit))
}

export function buildUnitDetail(
  unit: string,
  properties: Map<string, string>
): SystemdUnitDetail {
  const mainPid = Number.parseInt(properties.get('MainPID') ?? '', 10)

  return {
    unit: properties.get('Id') || unit,
    description: properties.get('Description') ?? '',
    loadState: properties.get('LoadState') ?? '',
    activeState: properties.get('ActiveState') ?? '',
    subState: properties.get('SubState') ?? '',
    unitFileState: properties.get('UnitFileState') ?? '',
    mainPid: Number.isFinite(mainPid) ? mainPid : 0,
    activeEnterTimestamp: properties.get('ActiveEnterTimestamp') ?? '',
    fragmentPath: properties.get('FragmentPath') ?? ''
  }
}

/**
 * Collects the paths `systemctl cat` announces above each fragment and drop-in.
 * The banner is a comment line holding nothing but an absolute path, which is
 * how it stays distinguishable from ordinary comments inside the unit file.
 */
export function parseUnitFilePaths(stdout: string): string[] {
  const paths: string[] = []

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.replace(/\r$/, '').trim()
    const match = /^#\s*(\/\S+)$/.exec(line)
    if (!match) continue
    if (!paths.includes(match[1])) paths.push(match[1])
  }

  return paths
}

export function parseJournalOutput(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.trim().length > 0)
}
