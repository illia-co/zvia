import { ValidationError } from './errors'
import { validateCronExpression, type CronTarget } from './cron'
import { isSystemdAction } from './systemd'
import { isUserAction } from './users'
import { isProcessSignal, isProcessesSubscriptionInterval } from './processes'
import { isPackageOperation } from './packages'
import { getPasswordPolicyIssues } from './userPassword'
import type { AuthMethod, ServerId } from './server'
import type {
  ConnectRequest,
  ConnectionTestRequest,
  DisconnectRequest,
  HostKeyResponseRequest,
  ProfileCreateRequest,
  ProfileGetRequest,
  ProfileRemoveRequest,
  ProfileUpdateRequest,
  ServerScoped,
  TerminalCloseRequest,
  TerminalOpenRequest,
  TerminalResizeRequest,
  TerminalSessionId,
  TerminalWriteRequest
} from './ipc'
import { DEFAULT_LOGS_QUERY, normalizeLogsQuery } from './logQuery'
import { isCriticalSystemPath } from './remotePaths'
import { getProtectedSystemdUnitActionBlock } from './systemd'
import type {
  LogFilters,
  LogPriority,
  LogsQuery,
  LogsSetFiltersRequest,
  LogsStartRequest,
  LogTimeRange,
  LogViewMode
} from './logs'
import type {
  FilesCancelTransferRequest,
  FilesCopyRequest,
  FilesDeleteRequest,
  FilesDownloadRequest,
  FilesListRequest,
  FilesMkdirRequest,
  FilesReadRequest,
  FilesRenameRequest,
  FilesUploadRequest,
  FilesWriteRequest
} from './files'

function assertString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`Invalid ${field}: expected non-empty string`)
  }
  return value.trim()
}

function assertServerId(value: unknown): ServerId {
  return assertString(value, 'serverId')
}

function assertPort(value: unknown, fallback = 22): number {
  if (value === undefined) return fallback
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ValidationError('Invalid port: expected integer between 1 and 65535')
  }
  return value
}

function assertAuthMethod(value: unknown): AuthMethod {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid auth: expected object')
  }
  const auth = value as Record<string, unknown>
  if (auth.type === 'ssh-agent') {
    return { type: 'ssh-agent' }
  }
  if (auth.type === 'key-file') {
    const privateKeyPath = assertString(auth.privateKeyPath, 'privateKeyPath')
    return {
      type: 'key-file',
      privateKeyPath,
      hasPassphrase: auth.hasPassphrase === true
    }
  }
  throw new ValidationError('Invalid auth: expected ssh-agent or key-file')
}

export function validateServerScoped(value: unknown): ServerScoped {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid request: expected object')
  }
  const record = value as Record<string, unknown>
  return { serverId: assertServerId(record.serverId) }
}

export function validateConnectRequest(value: unknown): ConnectRequest {
  return validateServerScoped(value)
}

export function validateDisconnectRequest(value: unknown): DisconnectRequest {
  return validateServerScoped(value)
}

export function validateConnectionTestRequest(value: unknown): ConnectionTestRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid connection test request: expected object')
  }
  const record = value as Record<string, unknown>
  const request: ConnectionTestRequest = {
    hostname: assertString(record.hostname, 'hostname'),
    username: assertString(record.username, 'username'),
    port: assertPort(record.port),
    auth: assertAuthMethod(record.auth)
  }
  if (record.passphrase !== undefined) {
    if (typeof record.passphrase !== 'string') {
      throw new ValidationError('Invalid passphrase: expected string')
    }
    request.passphrase = record.passphrase
  }
  if (record.serverId !== undefined) {
    request.serverId = assertServerId(record.serverId)
  }
  return request
}

export function validateHostKeyResponseRequest(value: unknown): HostKeyResponseRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid host key response: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (record.decision !== 'accept' && record.decision !== 'reject') {
    throw new ValidationError('Invalid decision: expected accept or reject')
  }
  return { ...scoped, decision: record.decision }
}

export function validateProfileGetRequest(value: unknown): ProfileGetRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid profile get request: expected object')
  }
  const record = value as Record<string, unknown>
  return { id: assertServerId(record.id) }
}

export function validateProfileRemoveRequest(value: unknown): ProfileRemoveRequest {
  return validateProfileGetRequest(value)
}

export function validateProfileCreateRequest(value: unknown): ProfileCreateRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid profile create request: expected object')
  }
  const record = value as Record<string, unknown>
  const request: ProfileCreateRequest = {
    name: assertString(record.name, 'name'),
    hostname: assertString(record.hostname, 'hostname'),
    username: assertString(record.username, 'username'),
    port: assertPort(record.port),
    auth: assertAuthMethod(record.auth)
  }
  if (record.passphrase !== undefined) {
    if (typeof record.passphrase !== 'string') {
      throw new ValidationError('Invalid passphrase: expected string')
    }
    request.passphrase = record.passphrase
  }
  return request
}

export function validateProfileUpdateRequest(value: unknown): ProfileUpdateRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid profile update request: expected object')
  }
  const record = value as Record<string, unknown>
  const request: ProfileUpdateRequest = { id: assertServerId(record.id) }
  if (record.name !== undefined) request.name = assertString(record.name, 'name')
  if (record.hostname !== undefined) request.hostname = assertString(record.hostname, 'hostname')
  if (record.username !== undefined) request.username = assertString(record.username, 'username')
  if (record.port !== undefined) request.port = assertPort(record.port)
  if (record.auth !== undefined) request.auth = assertAuthMethod(record.auth)
  if (record.passphrase !== undefined) {
    if (typeof record.passphrase !== 'string') {
      throw new ValidationError('Invalid passphrase: expected string')
    }
    request.passphrase = record.passphrase
  }
  if (record.clearPassphrase === true) request.clearPassphrase = true
  return request
}

export function createServerId(name: string): ServerId {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${slug || 'server'}-${suffix}`
}

function assertSessionId(value: unknown): TerminalSessionId {
  return assertString(value, 'sessionId')
}

function assertDimensions(
  record: Record<string, unknown>
): { cols: number; rows: number } {
  const cols = record.cols
  const rows = record.rows
  if (typeof cols !== 'number' || !Number.isInteger(cols) || cols < 1 || cols > 500) {
    throw new ValidationError('Invalid cols: expected integer between 1 and 500')
  }
  if (typeof rows !== 'number' || !Number.isInteger(rows) || rows < 1 || rows > 500) {
    throw new ValidationError('Invalid rows: expected integer between 1 and 500')
  }
  return { cols, rows }
}

export function validateTerminalOpenRequest(value: unknown): TerminalOpenRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid terminal open request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const sessionId = assertSessionId(record.sessionId)
  const { cols, rows } = assertDimensions(record)
  const request: TerminalOpenRequest = { ...scoped, sessionId, cols, rows }
  if (record.command !== undefined) {
    request.command = assertString(record.command, 'command')
  }
  return request
}

export function validateTerminalWriteRequest(value: unknown): TerminalWriteRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid terminal write request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const sessionId = assertSessionId(record.sessionId)
  if (typeof record.data !== 'string') {
    throw new ValidationError('Invalid data: expected string')
  }
  return { ...scoped, sessionId, data: record.data }
}

export function validateTerminalResizeRequest(value: unknown): TerminalResizeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid terminal resize request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const sessionId = assertSessionId(record.sessionId)
  const { cols, rows } = assertDimensions(record)
  return { ...scoped, sessionId, cols, rows }
}

export function validateTerminalCloseRequest(value: unknown): TerminalCloseRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid terminal close request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const sessionId = assertSessionId(record.sessionId)
  return { ...scoped, sessionId }
}

function assertRemotePath(value: unknown, field = 'path'): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError(`Invalid ${field}: expected non-empty string`)
  }
  if (!value.startsWith('/')) {
    throw new ValidationError(`Invalid ${field}: expected absolute path`)
  }
  if (value.split('/').includes('..')) {
    throw new ValidationError(`Invalid ${field}: must not contain parent directory segments`)
  }
  return value
}

function assertCriticalPathMutationAllowed(
  paths: string[],
  confirmed: unknown,
  operation: string
): void {
  if (!paths.some(isCriticalSystemPath)) return
  if (confirmed === true) return
  throw new ValidationError(
    `${operation} blocked: critical system path requires explicit confirmation`,
    'Type DELETE in the Files tool to confirm this operation.'
  )
}

function readDangerousPathConfirmed(record: Record<string, unknown>): boolean | undefined {
  return record.dangerousPathConfirmed === true ? true : undefined
}

function assertTransferId(value: unknown): string {
  return assertString(value, 'transferId')
}

export function validateFilesListRequest(value: unknown): FilesListRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files list request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, path: assertRemotePath(record.path) }
}

export function validateFilesReadRequest(value: unknown): FilesReadRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files read request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, path: assertRemotePath(record.path) }
}

export function validateFilesWriteRequest(value: unknown): FilesWriteRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files write request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (typeof record.content !== 'string') {
    throw new ValidationError('Invalid content: expected string')
  }
  const path = assertRemotePath(record.path)
  const confirmed = readDangerousPathConfirmed(record)
  assertCriticalPathMutationAllowed([path], confirmed, 'Write')
  const request: FilesWriteRequest = { ...scoped, path, content: record.content }
  if (confirmed) request.dangerousPathConfirmed = true
  return request
}

export function validateFilesMkdirRequest(value: unknown): FilesMkdirRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files mkdir request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, path: assertRemotePath(record.path) }
}

export function validateFilesRenameRequest(value: unknown): FilesRenameRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files rename request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const from = assertRemotePath(record.from, 'from')
  const to = assertRemotePath(record.to, 'to')
  const confirmed = readDangerousPathConfirmed(record)
  assertCriticalPathMutationAllowed([from, to], confirmed, 'Rename')
  const request: FilesRenameRequest = { ...scoped, from, to }
  if (confirmed) request.dangerousPathConfirmed = true
  return request
}

export function validateFilesDeleteRequest(value: unknown): FilesDeleteRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files delete request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const path = assertRemotePath(record.path)
  const confirmed = readDangerousPathConfirmed(record)
  assertCriticalPathMutationAllowed([path], confirmed, 'Delete')
  const request: FilesDeleteRequest = { ...scoped, path }
  if (record.recursive === true) request.recursive = true
  if (confirmed) request.dangerousPathConfirmed = true
  return request
}

export function validateFilesCopyRequest(value: unknown): FilesCopyRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files copy request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const from = assertRemotePath(record.from, 'from')
  const to = assertRemotePath(record.to, 'to')
  const confirmed = readDangerousPathConfirmed(record)
  assertCriticalPathMutationAllowed([from, to], confirmed, 'Copy')
  const request: FilesCopyRequest = { ...scoped, from, to }
  if (confirmed) request.dangerousPathConfirmed = true
  return request
}

export function validateFilesUploadRequest(value: unknown): FilesUploadRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files upload request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const transferId = assertTransferId(record.transferId)
  const remotePath = assertRemotePath(record.remotePath, 'remotePath')

  const request: FilesUploadRequest = { ...scoped, transferId, remotePath }

  if (record.localPath !== undefined) {
    request.localPath = assertString(record.localPath, 'localPath')
  }
  if (record.data !== undefined) {
    if (typeof record.data !== 'string') {
      throw new ValidationError('Invalid data: expected base64 string')
    }
    request.data = record.data
  }
  if (record.offset !== undefined) {
    if (typeof record.offset !== 'number' || record.offset < 0) {
      throw new ValidationError('Invalid offset: expected non-negative number')
    }
    request.offset = record.offset
  }
  if (record.totalSize !== undefined) {
    if (typeof record.totalSize !== 'number' || record.totalSize < 0) {
      throw new ValidationError('Invalid totalSize: expected non-negative number')
    }
    request.totalSize = record.totalSize
  }
  if (record.final === true) request.final = true

  const hasData = request.data !== undefined
  const hasLocalPath = request.localPath !== undefined
  const isChunked = request.offset !== undefined || request.final === true

  if (!hasData && !hasLocalPath && !isChunked) {
    return request
  }

  if (!hasData && !hasLocalPath) {
    throw new ValidationError('Upload requires localPath or data')
  }

  const confirmed = readDangerousPathConfirmed(record)
  assertCriticalPathMutationAllowed([remotePath], confirmed, 'Upload')
  if (confirmed) request.dangerousPathConfirmed = true

  return request
}

export function validateFilesDownloadRequest(value: unknown): FilesDownloadRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid files download request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: FilesDownloadRequest = {
    ...scoped,
    transferId: assertTransferId(record.transferId),
    remotePath: assertRemotePath(record.remotePath, 'remotePath')
  }
  if (record.localPath !== undefined) {
    request.localPath = assertString(record.localPath, 'localPath')
  }
  return request
}

export function validateFilesCancelTransferRequest(value: unknown): FilesCancelTransferRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid cancel transfer request: expected object')
  }
  const record = value as Record<string, unknown>
  return { transferId: assertTransferId(record.transferId) }
}

function assertSubscriberId(value: unknown): string {
  return assertString(value, 'subscriberId')
}

export function validateStatsSubscribeRequest(value: unknown): import('./ipc').StatsSubscribeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid stats subscribe request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const subscriberId = assertSubscriberId(record.subscriberId)
  if (record.mode !== 'overview' && record.mode !== 'stats') {
    throw new ValidationError('Invalid mode: expected overview or stats')
  }
  return { ...scoped, subscriberId, mode: record.mode }
}

export function validateStatsUnsubscribeRequest(value: unknown): import('./ipc').StatsUnsubscribeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid stats unsubscribe request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, subscriberId: assertSubscriberId(record.subscriberId) }
}

const LOG_PRIORITIES = new Set<string>([
  'emerg',
  'alert',
  'crit',
  'err',
  'warning',
  'notice',
  'info',
  'debug',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7'
])

const JOURNAL_TIME_PATTERN =
  /^[\d]{4}-[\d]{2}-[\d]{2}(?:[ T][\d]{2}:[\d]{2}(?::[\d]{2})?)?$|^[a-zA-Z0-9][a-zA-Z0-9 .:@+-]{0,63}$/

const SYSTEMD_UNIT_PATTERN = /^[a-zA-Z0-9@._:-]+$/

function assertJournalTime(value: unknown, field: string): string {
  const text = assertString(value, field)
  if (!JOURNAL_TIME_PATTERN.test(text)) {
    throw new ValidationError(`Invalid ${field}: unsupported time format`)
  }
  return text
}

function assertLogPriority(value: unknown): LogPriority | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` {
  if (typeof value !== 'string' || !LOG_PRIORITIES.has(value)) {
    throw new ValidationError('Invalid priority: expected journalctl priority level')
  }
  return value as LogPriority | `${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
}

export function assertSystemdUnit(value: unknown): string {
  const unit = assertString(value, 'unit')
  if (!SYSTEMD_UNIT_PATTERN.test(unit) || unit.length > 256) {
    throw new ValidationError('Invalid unit: expected systemd unit name')
  }
  return unit
}

export function validateLogFilters(value: unknown): LogFilters {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid filters: expected object')
  }
  const record = value as Record<string, unknown>
  const filters: LogFilters = {}

  if (record.since !== undefined) {
    filters.since = assertJournalTime(record.since, 'since')
  }
  if (record.until !== undefined) {
    filters.until = assertJournalTime(record.until, 'until')
  }
  if (record.priority !== undefined) {
    filters.priority = assertLogPriority(record.priority)
  }
  if (record.unit !== undefined) {
    filters.unit = assertSystemdUnit(record.unit)
  }

  return filters
}

const LOG_TIME_RANGES = new Set<LogTimeRange>(['15m', '1h', '6h', '24h', 'today', 'all'])

function assertLogViewMode(value: unknown): LogViewMode {
  if (value !== 'live' && value !== 'recent') {
    throw new ValidationError('Invalid mode: expected live or recent')
  }
  return value
}

function assertLogTimeRange(value: unknown): LogTimeRange {
  if (typeof value !== 'string' || !LOG_TIME_RANGES.has(value as LogTimeRange)) {
    throw new ValidationError('Invalid timeRange: expected a supported preset')
  }
  return value as LogTimeRange
}

function migrateLogFiltersToQuery(filters: LogFilters): LogsQuery {
  const query: LogsQuery = {
    mode: 'live',
    lines: DEFAULT_LOGS_QUERY.lines
  }

  if (filters.priority !== undefined) {
    query.priority = filters.priority
  }
  if (filters.unit !== undefined) {
    query.unit = filters.unit
  }

  return query
}

export function validateLogsQuery(value: unknown): LogsQuery {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid query: expected object')
  }
  const record = value as Record<string, unknown>
  const partial: Partial<LogsQuery> = {}

  if (record.mode !== undefined) {
    partial.mode = assertLogViewMode(record.mode)
  }
  if (record.lines !== undefined) {
    partial.lines = assertLogsPanelLineCount(record.lines)
  }
  if (record.timeRange !== undefined) {
    partial.timeRange = assertLogTimeRange(record.timeRange)
  }
  if (record.priority !== undefined) {
    partial.priority = assertLogPriority(record.priority)
  }
  if (record.unit !== undefined) {
    partial.unit = assertSystemdUnit(record.unit)
  }
  if (record.pid !== undefined) {
    partial.pid = assertPid(record.pid)
  }

  return normalizeLogsQuery(partial)
}

export function validateLogsStartRequest(value: unknown): LogsStartRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid logs start request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)

  if (record.query !== undefined) {
    return { ...scoped, query: validateLogsQuery(record.query) }
  }
  if (record.filters !== undefined) {
    return { ...scoped, query: migrateLogFiltersToQuery(validateLogFilters(record.filters)) }
  }
  return scoped
}

export function validateLogsSetFiltersRequest(value: unknown): LogsSetFiltersRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid logs set filters request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)

  if (record.query !== undefined) {
    return { ...scoped, query: validateLogsQuery(record.query) }
  }
  if (record.filters !== undefined) {
    return { ...scoped, query: migrateLogFiltersToQuery(validateLogFilters(record.filters)) }
  }

  throw new ValidationError('Invalid logs set filters request: expected query')
}

function assertLogLineCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 2000) {
    throw new ValidationError('Invalid lines: expected integer between 1 and 2000')
  }
  return value
}

export function assertLogsPanelLineCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 100 || value > 5000) {
    throw new ValidationError('Invalid lines: expected integer between 100 and 5000')
  }
  return value
}

export function validateServicesUnitRequest(
  value: unknown
): import('./ipc').ServicesUnitRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid services unit request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, unit: assertSystemdUnit(record.unit) }
}

export function validateServicesUnitLogsRequest(
  value: unknown
): import('./ipc').ServicesUnitLogsRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid services unit logs request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').ServicesUnitLogsRequest = {
    ...scoped,
    unit: assertSystemdUnit(record.unit)
  }
  if (record.lines !== undefined) {
    request.lines = assertLogLineCount(record.lines)
  }
  return request
}

export function validateServicesActionRequest(
  value: unknown
): import('./ipc').ServicesActionRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid services action request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (!isSystemdAction(record.action)) {
    throw new ValidationError('Invalid action: expected a supported systemctl action')
  }
  const unit = assertSystemdUnit(record.unit)
  const action = record.action
  const blockReason = getProtectedSystemdUnitActionBlock(unit, action)
  if (blockReason) {
    throw new ValidationError(blockReason)
  }
  return { ...scoped, unit, action }
}

const CRON_JOB_ID_PATTERN = /^[a-z.-]+:\S*:\d+$/

function assertCronTarget(value: unknown): CronTarget {
  if (value !== 'user' && value !== 'root') {
    throw new ValidationError('Invalid target: expected user or root')
  }
  return value
}

function assertCronExpression(value: unknown): string {
  const expression = assertString(value, 'schedule')
  const result = validateCronExpression(expression)
  if (!result.valid) {
    throw new ValidationError(`Invalid schedule: ${result.error ?? 'unsupported cron expression'}`)
  }
  return expression
}

function assertCronCommand(value: unknown): string {
  const command = assertString(value, 'command')
  if (command.length > 1024) {
    throw new ValidationError('Invalid command: exceeds 1024 characters')
  }
  if (/[\n\r\0]/.test(command)) {
    throw new ValidationError('Invalid command: expected a single line')
  }
  return command
}

function assertCronJobId(value: unknown): string {
  const jobId = assertString(value, 'jobId')
  if (!CRON_JOB_ID_PATTERN.test(jobId)) {
    throw new ValidationError('Invalid jobId: expected cron job identifier')
  }
  return jobId
}

export function validateCronSourceRequest(value: unknown): import('./ipc').CronSourceRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid cron source request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, target: assertCronTarget(record.target) }
}

export function validateCronCreateJobRequest(
  value: unknown
): import('./ipc').CronCreateJobRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid cron create job request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    target: assertCronTarget(record.target),
    schedule: assertCronExpression(record.schedule),
    command: assertCronCommand(record.command)
  }
}

export function validateCronUpdateJobRequest(
  value: unknown
): import('./ipc').CronUpdateJobRequest {
  const request = validateCronCreateJobRequest(value)
  const record = value as Record<string, unknown>
  return { ...request, jobId: assertCronJobId(record.jobId) }
}

export function validateCronDeleteJobRequest(
  value: unknown
): import('./ipc').CronDeleteJobRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid cron delete job request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    target: assertCronTarget(record.target),
    jobId: assertCronJobId(record.jobId)
  }
}

function assertDockerId(value: unknown, field: string): string {
  const id = assertString(value, field)
  if (!/^[a-f0-9]{12,64}$/i.test(id)) {
    throw new ValidationError(`Invalid ${field}: expected container or image ID`)
  }
  return id
}

function assertDockerName(value: unknown, field: string): string {
  const name = assertString(value, field)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name)) {
    throw new ValidationError(`Invalid ${field}: expected Docker resource name`)
  }
  return name
}

function assertStreamId(value: unknown): string {
  return assertString(value, 'streamId')
}

export function validateDockerListContainersRequest(
  value: unknown
): import('./ipc').DockerListContainersRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker list containers request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').DockerListContainersRequest = { ...scoped }
  if (record.all === true) request.all = true
  return request
}

export function validateDockerContainerActionRequest(
  value: unknown
): import('./ipc').DockerContainerActionRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker container action request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, containerId: assertDockerId(record.containerId, 'containerId') }
}

export function validateDockerRemoveContainerRequest(
  value: unknown
): import('./ipc').DockerRemoveContainerRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker remove container request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').DockerRemoveContainerRequest = {
    ...scoped,
    containerId: assertDockerId(record.containerId, 'containerId')
  }
  if (record.force === true) request.force = true
  return request
}

export function validateDockerInspectRequest(
  value: unknown
): import('./ipc').DockerInspectRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker inspect request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, containerId: assertDockerId(record.containerId, 'containerId') }
}

export function validateDockerRemoveImageRequest(
  value: unknown
): import('./ipc').DockerRemoveImageRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker remove image request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').DockerRemoveImageRequest = {
    ...scoped,
    imageId: assertDockerId(record.imageId, 'imageId')
  }
  if (record.force === true) request.force = true
  return request
}

export function validateDockerRemoveVolumeRequest(
  value: unknown
): import('./ipc').DockerRemoveVolumeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker remove volume request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').DockerRemoveVolumeRequest = {
    ...scoped,
    volumeName: assertDockerName(record.volumeName, 'volumeName')
  }
  if (record.force === true) request.force = true
  return request
}

export function validateDockerLogsStartRequest(
  value: unknown
): import('./ipc').DockerLogsStartRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker logs start request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').DockerLogsStartRequest = {
    ...scoped,
    streamId: assertStreamId(record.streamId),
    containerId: assertDockerId(record.containerId, 'containerId')
  }
  if (record.timestamps === true) request.timestamps = true
  if (record.tail !== undefined) {
    if (typeof record.tail !== 'number' || !Number.isInteger(record.tail) || record.tail < 1) {
      throw new ValidationError('Invalid tail: expected positive integer')
    }
    request.tail = record.tail
  }
  return request
}

export function validateDockerLogsStopRequest(
  value: unknown
): import('./ipc').DockerLogsStopRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid docker logs stop request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, streamId: assertStreamId(record.streamId) }
}

export function assertPortNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new ValidationError('Invalid port: expected integer between 1 and 65535')
  }
  return value
}

export function assertProtocol(value: unknown): import('./ports').PortProtocol {
  if (value !== 'tcp' && value !== 'udp') {
    throw new ValidationError('Invalid protocol: expected tcp or udp')
  }
  return value
}

export function assertFirewallRuleId(value: unknown): string {
  const id = assertString(value, 'ruleId')
  if (!/^\d{1,4}$/.test(id)) {
    throw new ValidationError('Invalid ruleId: expected ufw rule number')
  }
  return id
}

/**
 * Structural check only. Containment inside the detected nginx config root is
 * enforced by NginxService, which is the only place that knows the root.
 */
export function assertNginxConfigPath(value: unknown): string {
  const path = assertRemotePath(value, 'path')
  if (path.length > 4096) {
    throw new ValidationError('Invalid path: too long')
  }
  if (path.split('/').includes('..')) {
    throw new ValidationError('Invalid path: must not contain parent directory segments')
  }
  if (!/^[a-zA-Z0-9/._@+-]+$/.test(path)) {
    throw new ValidationError('Invalid path: unsupported characters in nginx config path')
  }
  return path
}

export function validatePortsFirewallRuleRequest(
  value: unknown
): import('./ipc').PortsFirewallRuleRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid firewall rule request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (record.action !== 'allow' && record.action !== 'deny') {
    throw new ValidationError('Invalid action: expected allow or deny')
  }
  return {
    ...scoped,
    action: record.action,
    port: assertPortNumber(record.port),
    protocol: assertProtocol(record.protocol)
  }
}

export function validatePortsDeleteFirewallRuleRequest(
  value: unknown
): import('./ipc').PortsDeleteFirewallRuleRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid delete firewall rule request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, ruleId: assertFirewallRuleId(record.ruleId) }
}

export function validateNginxConfigPathRequest(
  value: unknown
): import('./ipc').NginxConfigPathRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid nginx config request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, path: assertNginxConfigPath(record.path) }
}

export function validateNginxWriteConfigRequest(
  value: unknown
): import('./ipc').NginxWriteConfigRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid nginx write config request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (typeof record.content !== 'string') {
    throw new ValidationError('Invalid content: expected string')
  }
  return { ...scoped, path: assertNginxConfigPath(record.path), content: record.content }
}

export function validateNginxActionRequest(value: unknown): import('./ipc').NginxActionRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid nginx action request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (
    record.action !== 'start' &&
    record.action !== 'stop' &&
    record.action !== 'restart' &&
    record.action !== 'reload'
  ) {
    throw new ValidationError('Invalid action: expected start, stop, restart or reload')
  }
  return { ...scoped, action: record.action }
}

export function validateNginxLogsStartRequest(
  value: unknown
): import('./ipc').NginxLogsStartRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid nginx logs start request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    streamId: assertStreamId(record.streamId),
    path: assertRemotePath(record.path, 'path')
  }
}

export function validateNginxLogsStopRequest(
  value: unknown
): import('./ipc').NginxLogsStopRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid nginx logs stop request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, streamId: assertStreamId(record.streamId) }
}

const DOMAIN_LABEL_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/

export function assertDomain(value: unknown): string {
  const domain = assertString(value, 'domain')
  if (domain.length > 253) {
    throw new ValidationError('Invalid domain: exceeds 253 characters')
  }
  if (domain.includes('*')) {
    throw new ValidationError('Invalid domain: wildcards are not supported')
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(domain)) {
    throw new ValidationError('Invalid domain: unsupported characters')
  }
  const labels = domain.split('.')
  if (labels.some((label) => label.length === 0)) {
    throw new ValidationError('Invalid domain: empty label')
  }
  for (const label of labels) {
    if (!DOMAIN_LABEL_PATTERN.test(label)) {
      throw new ValidationError('Invalid domain: malformed label')
    }
  }
  return domain
}

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export function assertEmail(value: unknown): string {
  const email = assertString(value, 'email')
  if (email.length > 254) {
    throw new ValidationError('Invalid email: exceeds 254 characters')
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Invalid email: expected a valid email address')
  }
  return email
}

export function assertCertName(value: unknown): string {
  const certName = assertString(value, 'certName')
  if (certName.length > 128) {
    throw new ValidationError('Invalid certName: exceeds 128 characters')
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(certName)) {
    throw new ValidationError('Invalid certName: unsupported characters')
  }
  return certName
}

function assertCertId(value: unknown): string {
  const id = assertString(value, 'id')
  if (id.length > 256) {
    throw new ValidationError('Invalid id: exceeds 256 characters')
  }
  if (!/^[a-zA-Z0-9._/-]+$/.test(id)) {
    throw new ValidationError('Invalid id: unsupported characters')
  }
  return id
}

export function validateSslEnableHttpsRequest(
  value: unknown
): import('./ipc').SslEnableHttpsRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid enable HTTPS request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (typeof record.redirect !== 'boolean') {
    throw new ValidationError('Invalid redirect: expected boolean')
  }
  return {
    ...scoped,
    streamId: assertStreamId(record.streamId),
    domain: assertDomain(record.domain),
    configPath: assertNginxConfigPath(record.configPath),
    email: assertEmail(record.email),
    redirect: record.redirect
  }
}

export function validateSslCertNameRequest(
  value: unknown
): import('./ipc').SslCertNameRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid SSL cert name request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, certName: assertCertName(record.certName) }
}

export function validateSslCertIdRequest(value: unknown): import('./ipc').SslCertIdRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid SSL certificate request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, id: assertCertId(record.id) }
}

export function validateSslStreamRequest(value: unknown): import('./ipc').SslStreamRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid SSL stream request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, streamId: assertStreamId(record.streamId) }
}

export function validateSslVerifyRequest(value: unknown): import('./ipc').SslVerifyRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid SSL verify request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, domain: assertDomain(record.domain) }
}

function assertLinuxUsername(value: unknown): string {
  const username = assertString(value, 'username')
  if (!/^[a-z_][a-z0-9._-]{0,31}$/i.test(username)) {
    throw new ValidationError('Invalid username: expected a valid Linux username')
  }
  return username
}

function assertShellPath(value: unknown): string {
  const shell = assertString(value, 'shell')
  if (!/^\/[a-zA-Z0-9/._-]+$/.test(shell)) {
    throw new ValidationError('Invalid shell: expected absolute path')
  }
  if (/\s/.test(shell)) {
    throw new ValidationError('Invalid shell: must not contain spaces')
  }
  return shell
}

function assertLinuxGroupName(value: unknown): string {
  const group = assertString(value, 'group')
  if (!/^[a-z_][a-z0-9._-]{0,31}$/i.test(group)) {
    throw new ValidationError('Invalid group: expected a valid Linux group name')
  }
  return group
}

function assertLinuxGroupNameArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError('Invalid groups: expected array')
  }
  return value.map((group) => assertLinuxGroupName(group))
}

function assertPassword(value: unknown, username?: string): string {
  const password = assertString(value, 'password')
  if (password.length > 256) {
    throw new ValidationError('Invalid password: exceeds 256 characters')
  }
  const issues = getPasswordPolicyIssues(password, username)
  if (issues.length > 0) {
    throw new ValidationError(`Invalid password: ${issues[0]}`)
  }
  return password
}

function assertSshPublicKey(value: unknown): string {
  const key = assertString(value, 'publicKey')
  if (key.length > 8192) {
    throw new ValidationError('Invalid publicKey: exceeds maximum length')
  }
  if (/[\n\r]/.test(key)) {
    throw new ValidationError('Invalid publicKey: expected a single line')
  }
  if (!/^(ssh-|ecdsa-|sk-)/.test(key)) {
    throw new ValidationError('Invalid publicKey: expected SSH public key format')
  }
  return key
}

function assertOptionalGecos(value: unknown): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Invalid gecos: expected string')
  }
  if (value.length > 256) {
    throw new ValidationError('Invalid gecos: exceeds 256 characters')
  }
  if (/[\n\r\0]/.test(value)) {
    throw new ValidationError('Invalid gecos: must not contain newlines')
  }
  return value
}

function assertPid(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ValidationError('Invalid pid: expected a positive integer')
  }
  return value
}

function assertPackageName(value: unknown): string {
  const name = assertString(value, 'packageName')
  if (!/^[a-zA-Z0-9][a-zA-Z0-9+._:-]*$/.test(name)) {
    throw new ValidationError('Invalid packageName: expected a valid package name')
  }
  return name
}

function assertPaginationOffset(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError('Invalid offset: expected a non-negative integer')
  }
  return value
}

function assertPaginationLimit(value: unknown): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 500) {
    throw new ValidationError('Invalid limit: expected integer between 1 and 500')
  }
  return value
}

function assertUserAction(value: unknown): import('./users').UserAction {
  if (!isUserAction(value)) {
    throw new ValidationError('Invalid action: expected a supported user action')
  }

  const action = value
  switch (action.type) {
    case 'create': {
      const validated: Extract<import('./users').UserAction, { type: 'create' }> = {
        type: 'create',
        username: assertLinuxUsername(action.username),
        shell: assertShellPath(action.shell)
      }
      if (action.home !== undefined) validated.home = action.home
      if (action.gecos !== undefined) validated.gecos = assertOptionalGecos(action.gecos)
      if (action.groups !== undefined) {
        validated.groups = assertLinuxGroupNameArray(action.groups)
      }
      if (action.password !== undefined) {
        validated.password = assertPassword(action.password, validated.username)
      }
      if (action.sudo === true) validated.sudo = true
      return validated
    }
    case 'delete':
      return {
        type: 'delete',
        username: assertLinuxUsername(action.username),
        removeHome: action.removeHome
      }
    case 'lock':
    case 'unlock':
      return { type: action.type, username: assertLinuxUsername(action.username) }
    case 'changeShell':
      return {
        type: 'changeShell',
        username: assertLinuxUsername(action.username),
        shell: assertShellPath(action.shell)
      }
    case 'setPassword':
      return {
        type: 'setPassword',
        username: assertLinuxUsername(action.username),
        password: assertPassword(action.password, action.username)
      }
    case 'addGroups':
    case 'removeGroups':
      return {
        type: action.type,
        username: assertLinuxUsername(action.username),
        groups: assertLinuxGroupNameArray(action.groups)
      }
    case 'grantSudo':
    case 'revokeSudo':
      return { type: action.type, username: assertLinuxUsername(action.username) }
    case 'enableSsh': {
      const validated: Extract<import('./users').UserAction, { type: 'enableSsh' }> = {
        type: 'enableSsh',
        username: assertLinuxUsername(action.username)
      }
      if (action.publicKey !== undefined) {
        validated.publicKey = assertSshPublicKey(action.publicKey)
      }
      return validated
    }
  }
}

export function validateUsersUsernameRequest(
  value: unknown
): import('./ipc').UsersUsernameRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid users username request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, username: assertLinuxUsername(record.username) }
}

export function validateUsersActionRequest(value: unknown): import('./ipc').UsersActionRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid users action request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, action: assertUserAction(record.action) }
}

export function validateProcessesGetRequest(
  value: unknown
): import('./ipc').ProcessesGetRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid processes get request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, pid: assertPid(record.pid) }
}

export function validateProcessesSubscribeRequest(
  value: unknown
): import('./ipc').ProcessesSubscribeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid processes subscribe request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').ProcessesSubscribeRequest = {
    ...scoped,
    subscriberId: assertSubscriberId(record.subscriberId)
  }
  if (record.intervalMs !== undefined) {
    if (!isProcessesSubscriptionInterval(record.intervalMs)) {
      throw new ValidationError('Invalid intervalMs: expected 1000, 2000, or 5000')
    }
    request.intervalMs = record.intervalMs
  }
  return request
}

export function validateProcessesUnsubscribeRequest(
  value: unknown
): import('./ipc').ProcessesUnsubscribeRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid processes unsubscribe request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, subscriberId: assertSubscriberId(record.subscriberId) }
}

export function validateProcessesSignalRequest(
  value: unknown
): import('./ipc').ProcessesSignalRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid processes signal request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  if (!isProcessSignal(record.signal)) {
    throw new ValidationError('Invalid signal: expected terminate or kill')
  }
  return { ...scoped, pid: assertPid(record.pid), signal: record.signal }
}

export function validatePackagesListRequest(
  value: unknown
): import('./ipc').PackagesListRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid packages list request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const request: import('./ipc').PackagesListRequest = {
    ...scoped,
    offset: assertPaginationOffset(record.offset),
    limit: assertPaginationLimit(record.limit)
  }
  if (record.query !== undefined) {
    request.query = assertString(record.query, 'query')
  }
  return request
}

export function validatePackagesSearchRequest(
  value: unknown
): import('./ipc').PackagesSearchRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid packages search request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, query: assertString(record.query, 'query') }
}

export function validatePackagesInfoRequest(
  value: unknown
): import('./ipc').PackagesInfoRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid packages info request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, packageName: assertPackageName(record.packageName) }
}

function assertPackageOperation(value: unknown): import('./packages').PackageOperation {
  if (!isPackageOperation(value)) {
    throw new ValidationError('Invalid operation: expected a supported package operation')
  }
  return value
}

export function validatePackagesOperationStartRequest(
  value: unknown
): import('./ipc').PackagesOperationStartRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid packages operation start request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    streamId: assertStreamId(record.streamId),
    operation: assertPackageOperation(record.operation)
  }
}

export function validatePackagesOperationCancelRequest(
  value: unknown
): import('./ipc').PackagesOperationCancelRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid packages operation cancel request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return { ...scoped, streamId: assertStreamId(record.streamId) }
}

export function validateDeploymentsLookupRequest(
  value: unknown
): import('./ipc').DeploymentsLookupRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments lookup request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  switch (record.kind) {
    case 'port':
      return { ...scoped, kind: 'port', port: assertPortNumber(record.port) }
    case 'container':
      return { ...scoped, kind: 'container', containerId: assertString(record.containerId, 'containerId') }
    case 'domain':
      return { ...scoped, kind: 'domain', domain: assertString(record.domain, 'domain') }
    case 'nginxSite': {
      if (typeof record.startLineNumber !== 'number' || !Number.isInteger(record.startLineNumber) || record.startLineNumber < 1) {
        throw new ValidationError('Invalid startLineNumber: expected positive integer')
      }
      return {
        ...scoped,
        kind: 'nginxSite',
        configPath: assertString(record.configPath, 'configPath'),
        startLineNumber: record.startLineNumber
      }
    }
    default:
      throw new ValidationError('Invalid lookup kind')
  }
}

export function validateDeploymentsTagRequest(
  value: unknown
): import('./ipc').DeploymentsTagRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments tag request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const snapshotId = assertString(record.snapshotId, 'snapshotId')
  const deploymentId = assertString(record.deploymentId, 'deploymentId')
  const tag = assertString(record.tag, 'tag')
  if (tag === 'latest') {
    throw new ValidationError('"latest" is a reserved tag name')
  }
  const remove = record.remove === true ? true : undefined
  return { ...scoped, snapshotId, deploymentId, tag, remove }
}

export function validateDeploymentsTagCurrentRequest(
  value: unknown
): import('./ipc').DeploymentsTagCurrentRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments tag current request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  const deploymentId = assertString(record.deploymentId, 'deploymentId')
  const tag = assertString(record.tag, 'tag')
  if (tag === 'latest') {
    throw new ValidationError('"latest" is a reserved tag name')
  }
  return { ...scoped, deploymentId, tag }
}

export function validateDeploymentsSnapshotDiffRequest(
  value: unknown
): import('./ipc').DeploymentsSnapshotDiffRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments snapshot diff request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    fromSnapshotId: assertString(record.fromSnapshotId, 'fromSnapshotId'),
    toSnapshotId: assertString(record.toSnapshotId, 'toSnapshotId'),
    deploymentId: assertString(record.deploymentId, 'deploymentId')
  }
}

export function validateDeploymentsDiffRequest(
  value: unknown
): import('./ipc').DeploymentsDiffRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments diff request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    baselineId: record.baselineId === null || record.baselineId === undefined
      ? null
      : assertString(record.baselineId, 'baselineId'),
    deploymentId: assertString(record.deploymentId, 'deploymentId')
  }
}

export function validateDeploymentsDeploymentHistoryRequest(
  value: unknown
): import('./ipc').DeploymentsDeploymentHistoryRequest {
  if (!value || typeof value !== 'object') {
    throw new ValidationError('Invalid deployments deployment history request: expected object')
  }
  const record = value as Record<string, unknown>
  const scoped = validateServerScoped(record)
  return {
    ...scoped,
    deploymentId: assertString(record.deploymentId, 'deploymentId')
  }
}
