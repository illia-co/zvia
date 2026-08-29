import type { NginxLogPaths, NginxPaths, NginxValidation } from '@shared/nginx'

/** Parses `Key=Value` output of `systemctl show <unit> --property=...`. */
export function parseSystemctlProperties(stdout: string): Record<string, string> {
  const properties: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    properties[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }
  return properties
}

/** Extracts the version from `nginx -v` or `nginx -V` output. */
export function parseNginxVersion(output: string): string | null {
  const match = /nginx version:\s*nginx\/([^\s]+)/i.exec(output)
  return match ? match[1] : null
}

function configureArgument(output: string, name: string): string | null {
  const pattern = new RegExp(`--${name}=(?:'([^']*)'|"([^"]*)"|(\\S+))`)
  const match = pattern.exec(output)
  if (!match) return null
  return match[1] ?? match[2] ?? match[3] ?? null
}

function dirname(path: string): string {
  const separator = path.lastIndexOf('/')
  if (separator <= 0) return '/'
  return path.slice(0, separator)
}

function resolveAgainstPrefix(path: string | null, prefix: string | null): string | null {
  if (!path) return null
  if (path.startsWith('/')) return path
  if (!prefix) return null
  return `${prefix.replace(/\/$/, '')}/${path}`
}

/**
 * Normalises a log destination to a tailable file path. Debian and Ubuntu build
 * nginx with `--error-log-path=stderr`, and `syslog:`/`memory:` targets appear in
 * configs, so these sentinels must not be mistaken for filenames.
 */
function logFilePathOrNull(value: string | null): string | null {
  const path = (value ?? '').replace(/;$/, '').trim()
  if (!path || path === 'off' || path === 'stderr' || path === 'stdout') return null
  if (!path.startsWith('/') && !path.startsWith('.') && path.includes(':')) return null
  return path
}

/**
 * Derives nginx paths from `nginx -V` configure arguments. Nothing is hardcoded:
 * a server built with a non-standard prefix is described accurately.
 */
export function parseNginxPaths(output: string): NginxPaths {
  const prefix = configureArgument(output, 'prefix')
  const confPath = resolveAgainstPrefix(configureArgument(output, 'conf-path'), prefix)
  const errorLogPath = resolveAgainstPrefix(
    logFilePathOrNull(configureArgument(output, 'error-log-path')),
    prefix
  )
  const accessLogPath = resolveAgainstPrefix(
    logFilePathOrNull(configureArgument(output, 'http-log-path')),
    prefix
  )

  return {
    prefix,
    confPath,
    configRoot: confPath ? dirname(confPath) : null,
    errorLogPath,
    accessLogPath
  }
}

/** Classifies `nginx -t` output. stderr carries the interesting part. */
export function parseNginxTestOutput(output: string): NginxValidation {
  const text = output.trim()
  const successful = /test is successful/i.test(text)
  const syntaxOk = /syntax is ok/i.test(text)
  return {
    state: successful && syntaxOk ? 'valid' : 'invalid',
    output: text
  }
}

/**
 * Extracts the effective log destinations from `nginx -T`, which is the only
 * reliable source once sites define their own access_log / error_log.
 */
export function parseNginxLogPaths(output: string, prefix?: string | null): NginxLogPaths {
  const accessLogs = new Set<string>()
  const errorLogs = new Set<string>()

  for (const line of output.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = /^(access_log|error_log)\s+(\S+)/.exec(trimmed)
    if (!match) continue

    const path = logFilePathOrNull(match[2])
    if (!path) continue

    const resolved = resolveAgainstPrefix(path, prefix ?? null)
    if (!resolved) continue

    if (match[1] === 'access_log') {
      accessLogs.add(resolved)
    } else {
      errorLogs.add(resolved)
    }
  }

  return { accessLogs: [...accessLogs], errorLogs: [...errorLogs] }
}

/** Extracts the main PID from `ps -o pid= -C nginx` when systemd is unavailable. */
export function parseNginxMainPid(stdout: string): number | null {
  for (const line of stdout.split('\n')) {
    const pid = Number.parseInt(line.trim(), 10)
    if (Number.isInteger(pid) && pid > 0) return pid
  }
  return null
}

/** True when `candidate` resolves inside `root`, guarding config path traversal. */
export function isInsideDirectory(root: string, candidate: string): boolean {
  if (!root.startsWith('/') || !candidate.startsWith('/')) return false
  if (candidate.split('/').includes('..')) return false
  const normalizedRoot = root.replace(/\/$/, '')
  return candidate === normalizedRoot || candidate.startsWith(`${normalizedRoot}/`)
}
