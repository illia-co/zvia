export type PortProtocol = 'tcp' | 'udp'

/**
 * Derived from the bind address only. It deliberately does not claim anything
 * about reachability from the internet — that depends on the firewall, NAT and
 * the network in front of the server.
 */
export type PortExposure = 'localhost' | 'bound-all' | 'bound-specific'

export type FirewallBackend = 'ufw' | 'nftables' | 'iptables' | 'none'

export type FirewallStatus = 'active' | 'inactive' | 'unknown'

export type FirewallVerdict = 'allowed' | 'blocked' | 'unknown'

export type FirewallDefaultPolicy = 'allow' | 'deny' | 'reject' | 'unknown'

export interface PortRange {
  start: number
  end: number
}

export interface FirewallRule {
  /** ufw rule number, used as the delete key. Empty for read-only backends. */
  id: string
  /** Verbatim rule line as reported by the backend. */
  raw: string
  action: string
  target: string
  from: string
  /** Null when the rule applies to both protocols or the protocol is unclear. */
  protocol: PortProtocol | null
  /** Empty when the target is an application profile or could not be parsed. */
  ports: PortRange[]
}

export interface FirewallState {
  backend: FirewallBackend
  status: FirewallStatus
  defaultIncoming: FirewallDefaultPolicy
  /** Only ufw supports rule writes in this version. */
  editable: boolean
  rules: FirewallRule[]
  /** Set when the state could not be read, e.g. because elevation is required. */
  unavailableReason?: string
  /** Command a user can run in the Terminal to inspect the backend directly. */
  inspectCommand?: string
}

export interface PortListener {
  protocol: PortProtocol
  address: string
  port: number
  pid: number | null
  process: string
  exposure: PortExposure
  /** systemd unit derived from /proc/<pid>/cgroup */
  unit: string | null
  containerId: string | null
  containerName: string | null
  firewall: FirewallVerdict
}

export interface PortsSnapshot {
  listeners: PortListener[]
  firewall: FirewallState
  /** SSH port of the active connection profile, protected against lockout. */
  sshPort: number
  /** Source used to enumerate listeners, surfaced for troubleshooting. */
  source: 'ss' | 'lsof'
}

export type FirewallRuleAction = 'allow' | 'deny'

/**
 * Reason shown when the host has no firewall tooling at all. Minimal images and
 * VM runtimes such as OrbStack ship without ufw, nft and iptables, and the
 * absence of a backend is easily mistaken for a broken Ports tool.
 */
export const FIREWALL_NO_BACKEND_REASON =
  'No firewall was detected on this server. Zvia looked for ufw, nftables and iptables and found none, so ports cannot be opened or closed from here.'

export interface FirewallEditability {
  editable: boolean
  /** Why rule changes are unavailable, or null when they are available. */
  reason: string | null
}

/** Single source of truth for whether the UI may offer firewall rule changes. */
export function describeFirewallEditability(state: FirewallState): FirewallEditability {
  if (state.editable) return { editable: true, reason: null }
  if (state.unavailableReason) return { editable: false, reason: state.unavailableReason }
  if (state.backend === 'none') {
    return { editable: false, reason: FIREWALL_NO_BACKEND_REASON }
  }
  return {
    editable: false,
    reason: `Zvia can read ${state.backend} rules but only writes ufw rules in this version.`
  }
}

export function firewallRuleCoversPort(
  rule: FirewallRule,
  port: number,
  protocol: PortProtocol
): boolean {
  if (rule.protocol !== null && rule.protocol !== protocol) return false
  return rule.ports.some((range) => port >= range.start && port <= range.end)
}

/** True when a rule's port scope could not be determined, which callers treat as risky. */
export function firewallRuleScopeIsUnknown(rule: FirewallRule): boolean {
  return rule.ports.length === 0
}

/** Stronger warning copy for firewall deny operations shown before applying a rule. */
export function getFirewallDenyWarning(port: number, protocol: PortProtocol): string {
  return `Blocking ${port}/${protocol} will refuse new incoming connections on that port. If it carries SSH, a web admin interface, or another service you rely on, you may lose access to this server.`
}

/**
 * Extra warning when deleting a firewall rule could remove SSH access. Returns
 * null when the delete looks routine.
 */
export function getFirewallDeleteRuleWarning(rule: FirewallRule, sshPort: number): string | null {
  const action = rule.action.toLowerCase()
  if (action !== 'allow' && action !== 'allow in') return null
  if (!firewallRuleCoversPort(rule, sshPort, 'tcp')) return null
  return `This rule allows SSH on port ${sshPort}/tcp. Removing it can lock you out when the default incoming policy is deny.`
}
