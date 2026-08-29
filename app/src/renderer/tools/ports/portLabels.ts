import type {
  FirewallBackend,
  FirewallStatus,
  FirewallVerdict,
  PortExposure,
  PortListener
} from '@shared/ports'

export function exposureLabel(exposure: PortExposure): string {
  switch (exposure) {
    case 'localhost':
      return 'Localhost only'
    case 'bound-all':
      return 'All interfaces'
    case 'bound-specific':
      return 'Single address'
  }
}

export function verdictLabel(verdict: FirewallVerdict): string {
  switch (verdict) {
    case 'allowed':
      return 'Allowed'
    case 'blocked':
      return 'Blocked'
    case 'unknown':
      return 'Unknown'
  }
}

export function backendLabel(backend: FirewallBackend): string {
  switch (backend) {
    case 'ufw':
      return 'ufw'
    case 'nftables':
      return 'nftables'
    case 'iptables':
      return 'iptables'
    case 'none':
      return 'No firewall tool found'
  }
}

export function firewallStatusLabel(status: FirewallStatus): string {
  switch (status) {
    case 'active':
      return 'Active'
    case 'inactive':
      return 'Inactive'
    case 'unknown':
      return 'Unknown'
  }
}

export function ownerLabel(listener: PortListener): string {
  if (listener.containerName) return listener.containerName
  if (listener.containerId) return listener.containerId.slice(0, 12)
  if (listener.unit) return listener.unit
  return '—'
}

export function listenerKey(listener: PortListener): string {
  return `${listener.protocol}:${listener.address}:${listener.port}:${listener.pid ?? 'na'}`
}

/**
 * Reachable-from-outside listeners on a permissive firewall are the rows worth
 * drawing attention to. Everything else stays visually quiet.
 */
export function isNoteworthy(listener: PortListener): boolean {
  return listener.exposure === 'bound-all' && listener.firewall !== 'blocked'
}

const NGINX_HINTS = ['nginx']
const WEB_PORTS = new Set([80, 443, 8080, 8443])

export function looksLikeNginx(listener: PortListener): boolean {
  const haystack = `${listener.process} ${listener.unit ?? ''}`.toLowerCase()
  if (NGINX_HINTS.some((hint) => haystack.includes(hint))) return true
  return WEB_PORTS.has(listener.port)
}
