import type { FirewallRuleAction, PortProtocol } from '@shared/ports'

export interface FirewallPortFormValues {
  port: string
  protocol: PortProtocol
  action: FirewallRuleAction
}

export type FirewallPortFormResult =
  | { ok: true; port: number; protocol: PortProtocol; action: FirewallRuleAction }
  | { ok: false; error: string }

export const PORT_RANGE_ERROR = 'Enter a port number between 1 and 65535.'

export function sshLockoutMessage(sshPort: number): string {
  return `Port ${sshPort} is the SSH port for this connection. Relay refuses firewall changes there to avoid locking you out — make them from the Terminal, where you can verify access first.`
}

/**
 * Mirrors the service-layer checks so the dialog can explain a rejection before
 * anything is sent. The service still enforces both; this never replaces it.
 */
export function parseFirewallPortForm(
  values: FirewallPortFormValues,
  sshPort: number
): FirewallPortFormResult {
  const raw = values.port.trim()
  if (!raw) return { ok: false, error: PORT_RANGE_ERROR }
  if (!/^\d{1,5}$/.test(raw)) return { ok: false, error: PORT_RANGE_ERROR }

  const port = Number(raw)
  if (port < 1 || port > 65535) return { ok: false, error: PORT_RANGE_ERROR }

  if (values.protocol === 'tcp' && port === sshPort) {
    return { ok: false, error: sshLockoutMessage(sshPort) }
  }

  return { ok: true, port, protocol: values.protocol, action: values.action }
}
