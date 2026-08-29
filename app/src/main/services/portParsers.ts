import {
  firewallRuleCoversPort,
  firewallRuleScopeIsUnknown,
  type FirewallDefaultPolicy,
  type FirewallRule,
  type FirewallStatus,
  type FirewallVerdict,
  type PortExposure,
  type PortProtocol,
  type PortRange
} from '@shared/ports'

export interface RawListener {
  protocol: PortProtocol
  address: string
  port: number
  pid: number | null
  process: string
}

export interface CgroupAttribution {
  unit: string | null
  containerId: string | null
}

export interface UfwState {
  status: FirewallStatus
  defaultIncoming: FirewallDefaultPolicy
  rules: FirewallRule[]
}

const LOCALHOST_ADDRESSES = new Set(['127.0.0.1', '::1', 'localhost'])
const WILDCARD_ADDRESSES = new Set(['0.0.0.0', '::', '*'])

export function classifyExposure(address: string): PortExposure {
  const normalized = normalizeAddress(address)
  if (WILDCARD_ADDRESSES.has(normalized)) return 'bound-all'
  if (LOCALHOST_ADDRESSES.has(normalized)) return 'localhost'
  if (normalized.startsWith('127.')) return 'localhost'
  return 'bound-specific'
}

function normalizeAddress(address: string): string {
  let value = address.trim()
  // ss appends the scope for link-local and loopback addresses, e.g. 127.0.0.53%lo
  const scopeIndex = value.indexOf('%')
  if (scopeIndex !== -1) value = value.slice(0, scopeIndex)
  if (value.startsWith('[') && value.endsWith(']')) value = value.slice(1, -1)
  return value
}

/** Splits `0.0.0.0:22`, `[::]:22`, `*:80` and `127.0.0.53%lo:53` into address and port. */
function splitEndpoint(endpoint: string): { address: string; port: number } | null {
  const separator = endpoint.lastIndexOf(':')
  if (separator === -1) return null
  const address = normalizeAddress(endpoint.slice(0, separator))
  const port = Number.parseInt(endpoint.slice(separator + 1), 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  if (!address) return null
  return { address, port }
}

function parseSsUsers(field: string): { pid: number | null; process: string } {
  const match = /\("([^"]+)",pid=(\d+)/.exec(field)
  if (!match) return { pid: null, process: '' }
  return { process: match[1], pid: Number.parseInt(match[2], 10) }
}

/**
 * Parses `ss -tulpnH` output. Tolerates the header line so that the `ss -tulpn`
 * fallback can be fed through unchanged.
 */
export function parseSsOutput(stdout: string): RawListener[] {
  const listeners: RawListener[] = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const columns = trimmed.split(/\s+/)
    const netid = columns[0]?.toLowerCase()
    if (netid !== 'tcp' && netid !== 'udp' && netid !== 'tcp6' && netid !== 'udp6') continue

    const state = columns[1]?.toUpperCase()
    if (state !== 'LISTEN' && state !== 'UNCONN') continue

    const endpoint = splitEndpoint(columns[4] ?? '')
    if (!endpoint) continue

    const usersField = columns.slice(6).join(' ')
    const { pid, process } = parseSsUsers(usersField)

    listeners.push({
      protocol: netid.startsWith('tcp') ? 'tcp' : 'udp',
      address: endpoint.address,
      port: endpoint.port,
      pid,
      process
    })
  }

  return listeners
}

/** Parses `lsof -nP -iTCP -sTCP:LISTEN -iUDP` output as an `ss` fallback. */
export function parseLsofOutput(stdout: string): RawListener[] {
  const listeners: RawListener[] = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('COMMAND')) continue

    const columns = trimmed.split(/\s+/)
    const protocolIndex = columns.findIndex(
      (column) => column === 'TCP' || column === 'UDP'
    )
    if (protocolIndex === -1) continue

    const name = columns[protocolIndex + 1]
    if (!name || name.includes('->')) continue

    const endpoint = splitEndpoint(name)
    if (!endpoint) continue

    const protocol: PortProtocol = columns[protocolIndex] === 'TCP' ? 'tcp' : 'udp'
    if (protocol === 'tcp' && !trimmed.includes('(LISTEN)')) continue

    const pid = Number.parseInt(columns[1] ?? '', 10)

    listeners.push({
      protocol,
      address: endpoint.address,
      port: endpoint.port,
      pid: Number.isInteger(pid) ? pid : null,
      process: columns[0] ?? ''
    })
  }

  return listeners
}

/** Collapses duplicate IPv4/IPv6 rows for the same protocol, port and process. */
export function dedupeListeners(listeners: RawListener[]): RawListener[] {
  const seen = new Map<string, RawListener>()
  for (const listener of listeners) {
    const key = `${listener.protocol}:${listener.address}:${listener.port}:${listener.pid ?? ''}`
    if (!seen.has(key)) seen.set(key, listener)
  }
  return [...seen.values()]
}

export const CGROUP_BLOCK_PREFIX = '---RELAY:PID:'

function attributionFromCgroup(content: string): CgroupAttribution {
  const container = /docker[-/]([0-9a-f]{12,64})/.exec(content)
  if (container) {
    return { unit: null, containerId: container[1] }
  }

  // Prefer the innermost .service segment; scopes and slices are not units we can act on.
  const services = [...content.matchAll(/\/([a-zA-Z0-9@:._-]+\.service)/g)]
  const unit = services.length > 0 ? services[services.length - 1][1] : null
  return { unit, containerId: null }
}

/**
 * Parses the batched `/proc/<pid>/cgroup` dump produced by
 * `for p in ...; do echo "---RELAY:PID:$p---"; cat /proc/$p/cgroup; done`.
 */
export function parseCgroupBlocks(stdout: string): Map<number, CgroupAttribution> {
  const attributions = new Map<number, CgroupAttribution>()
  let currentPid: number | null = null
  let buffer: string[] = []

  const flush = (): void => {
    if (currentPid === null) return
    attributions.set(currentPid, attributionFromCgroup(buffer.join('\n')))
    buffer = []
  }

  for (const line of stdout.split('\n')) {
    if (line.startsWith(CGROUP_BLOCK_PREFIX)) {
      flush()
      const pid = Number.parseInt(line.slice(CGROUP_BLOCK_PREFIX.length), 10)
      currentPid = Number.isInteger(pid) ? pid : null
      continue
    }
    buffer.push(line)
  }
  flush()

  return attributions
}

/** Parses `docker ps --format '{{.ID}} {{.Names}}'`. */
export function parseDockerPsIds(stdout: string): { id: string; name: string }[] {
  const rows: { id: string; name: string }[] = []
  for (const line of stdout.split('\n')) {
    const [id, name] = line.trim().split(/\s+/)
    if (!id || !name) continue
    rows.push({ id, name })
  }
  return rows
}

export function resolveContainerName(
  containerId: string,
  containers: { id: string; name: string }[]
): string | null {
  const match = containers.find(
    (container) => containerId.startsWith(container.id) || container.id.startsWith(containerId)
  )
  return match?.name ?? null
}

/**
 * A bare ufw port spec: `22`, `22/tcp`, `80,443/tcp`, `6000:6010/tcp`. Anchored so
 * that hostnames, addresses and interface names can never be mistaken for ports.
 */
const UFW_PORT_SPEC = /^\d{1,5}(?::\d{1,5})?(?:,\d{1,5}(?::\d{1,5})?)*(?:\/(?:tcp|udp))?$/i

function parseUfwPortSpec(target: string): { protocol: PortProtocol | null; ports: PortRange[] } {
  // Strip ufw annotations such as "(v6)" and application profile names.
  const cleaned = target.replace(/\([^)]*\)/g, '').trim()
  // The port spec is not at a fixed position: destination-scoped rules read
  // "192.168.1.10 22/tcp" while interface-scoped rules read "4000/tcp on eth0".
  const spec = cleaned.split(/\s+/).find((token) => UFW_PORT_SPEC.test(token)) ?? ''

  let protocol: PortProtocol | null = null
  let portPart = spec
  const slash = spec.lastIndexOf('/')
  if (slash !== -1) {
    const suffix = spec.slice(slash + 1).toLowerCase()
    if (suffix === 'tcp' || suffix === 'udp') {
      protocol = suffix
      portPart = spec.slice(0, slash)
    }
  }

  const ports: PortRange[] = []
  for (const chunk of portPart.split(',')) {
    const range = chunk.trim()
    if (!range) continue
    const [startText, endText] = range.split(':')
    const start = Number.parseInt(startText, 10)
    if (!Number.isInteger(start) || start < 1 || start > 65535) continue
    const end = endText === undefined ? start : Number.parseInt(endText, 10)
    if (!Number.isInteger(end) || end < start || end > 65535) continue
    ports.push({ start, end })
  }

  return { protocol, ports }
}

function parseUfwDefaultIncoming(verbose: string): FirewallDefaultPolicy {
  const match = /^Default:\s*(.+)$/m.exec(verbose)
  if (!match) return 'unknown'
  const incoming = /(\w+)\s*\(incoming\)/.exec(match[1])
  const policy = incoming?.[1]?.toLowerCase()
  if (policy === 'allow' || policy === 'deny' || policy === 'reject') return policy
  return 'unknown'
}

function parseUfwStatusLine(output: string): FirewallStatus {
  const match = /^Status:\s*(\w+)/m.exec(output)
  const status = match?.[1]?.toLowerCase()
  if (status === 'active') return 'active'
  if (status === 'inactive') return 'inactive'
  return 'unknown'
}

/** Strips the trailing `(v6)` marker ufw appends to the IPv6 copy of a rule. */
function withoutV6Marker(value: string): string {
  return value.replace(/\s*\(v6\)\s*$/, '').trim()
}

/**
 * Maps application profile names to their port spec.
 *
 * `ufw status numbered` prints only the profile name ("Nginx Full"), which leaves a
 * rule with no port scope, while `ufw status verbose` prints the resolved ports
 * alongside it ("80,443/tcp (Nginx Full)"). Recovering the ports here is what stops
 * a profile-opened port from being reported as blocked.
 */
function parseUfwProfilePorts(verbose: string): Map<string, string> {
  const profiles = new Map<string, string>()

  for (const line of verbose.split('\n')) {
    // The action column is upper-case, which also excludes the "Default:" line.
    const row = /^(\S.*?)\s+(?:ALLOW|DENY|REJECT|LIMIT)\b/.exec(line)
    if (!row) continue

    // Only annotated targets carry a profile name, and it is always last.
    const annotated = /^(\S+)\s+\((.+)\)$/.exec(row[1].trim())
    if (!annotated) continue

    const name = withoutV6Marker(annotated[2])
    if (!name || name === 'v6') continue
    if (!profiles.has(name)) profiles.set(name, annotated[1])
  }

  return profiles
}

/**
 * Parses `ufw status verbose` (for the default policy and application profile
 * ports) together with `ufw status numbered` (for rule numbers, which delete
 * operations need).
 */
export function parseUfwStatus(verbose: string, numbered: string): UfwState {
  const profilePorts = parseUfwProfilePorts(verbose)
  const numberedStatus = parseUfwStatusLine(numbered)
  const status = numberedStatus !== 'unknown' ? numberedStatus : parseUfwStatusLine(verbose)

  const rules: FirewallRule[] = []
  for (const line of numbered.split('\n')) {
    const match = /^\[\s*(\d+)\]\s+(.*)$/.exec(line.trim())
    if (!match) continue

    const columns = match[2].split(/\s{2,}/).map((column) => column.trim()).filter(Boolean)
    const target = columns[0] ?? ''
    const action = columns[1] ?? ''
    const from = columns[2] ?? ''

    let { protocol, ports } = parseUfwPortSpec(target)
    if (ports.length === 0) {
      const profileSpec = profilePorts.get(withoutV6Marker(target))
      if (profileSpec) ({ protocol, ports } = parseUfwPortSpec(profileSpec))
    }

    rules.push({
      id: match[1],
      raw: line.trim(),
      action,
      target,
      from,
      protocol,
      ports
    })
  }

  return { status, defaultIncoming: parseUfwDefaultIncoming(verbose), rules }
}

export {
  firewallRuleCoversPort as ruleCoversPort,
  firewallRuleScopeIsUnknown as ruleScopeIsUnknown
}

export function ufwVerdictForPort(
  state: UfwState,
  port: number,
  protocol: PortProtocol
): FirewallVerdict {
  if (state.status === 'inactive') return 'allowed'
  if (state.status === 'unknown') return 'unknown'

  for (const rule of state.rules) {
    const action = rule.action.toUpperCase()
    if (action.includes('OUT')) continue
    if (!firewallRuleCoversPort(rule, port, protocol)) continue
    // LIMIT permits the connection and only rate-limits repeated attempts.
    if (action.startsWith('ALLOW') || action.startsWith('LIMIT')) return 'allowed'
    if (action.startsWith('DENY') || action.startsWith('REJECT')) return 'blocked'
    return 'unknown'
  }

  if (state.defaultIncoming === 'deny' || state.defaultIncoming === 'reject') return 'blocked'
  if (state.defaultIncoming === 'allow') return 'allowed'
  return 'unknown'
}

function parsePortList(text: string): PortRange[] {
  const ports: PortRange[] = []
  for (const chunk of text.split(',')) {
    const range = chunk.trim()
    if (!range) continue
    const [startText, endText] = range.split(/[-:]/)
    const start = Number.parseInt(startText, 10)
    if (!Number.isInteger(start)) continue
    const end = endText === undefined ? start : Number.parseInt(endText, 10)
    ports.push({ start, end: Number.isInteger(end) ? end : start })
  }
  return ports
}

function protocolFromText(text: string): PortProtocol | null {
  if (/\btcp\b/.test(text)) return 'tcp'
  if (/\budp\b/.test(text)) return 'udp'
  return null
}

/** Parses `nft list ruleset` into read-only rule rows. */
export function parseNftRules(stdout: string): FirewallRule[] {
  const rules: FirewallRule[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (!/\b(accept|drop|reject)\b/.test(trimmed)) continue
    if (/^(table|chain|type|policy)\b/.test(trimmed)) continue

    const dport = /dport\s+(?:\{([^}]*)\}|([\d\-:]+))/.exec(trimmed)
    const ports = dport ? parsePortList(dport[1] ?? dport[2] ?? '') : []
    const action = /\b(accept|drop|reject)\b/.exec(trimmed)?.[1] ?? ''

    rules.push({
      id: '',
      raw: trimmed,
      action: action.toUpperCase(),
      target: dport?.[0] ?? '',
      from: '',
      protocol: protocolFromText(trimmed),
      ports
    })
  }
  return rules
}

/** Parses `iptables -S` into read-only rule rows. */
export function parseIptablesRules(stdout: string): FirewallRule[] {
  const rules: FirewallRule[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('-A')) continue

    const dport = /--dports?\s+([\d,\-:]+)/.exec(trimmed)
    const ports = dport ? parsePortList(dport[1]) : []
    const protocolMatch = /-p\s+(\w+)/.exec(trimmed)
    const protocol = protocolMatch ? protocolFromText(protocolMatch[1]) : null
    const jump = /-j\s+(\w+)/.exec(trimmed)?.[1] ?? ''

    rules.push({
      id: '',
      raw: trimmed,
      action: jump.toUpperCase(),
      target: dport?.[1] ?? '',
      from: '',
      protocol,
      ports
    })
  }
  return rules
}
