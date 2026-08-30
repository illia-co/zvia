export interface SystemdUnit {
  unit: string
  description: string
  loadState: string
  activeState: string
  subState: string
  /** enabled / disabled / static / masked / generated, or '' when unknown. */
  unitFileState: string
}

export interface SystemdUnitDetail extends SystemdUnit {
  mainPid: number
  activeEnterTimestamp: string
  fragmentPath: string
}

export interface SystemdUnitFile {
  unit: string
  /**
   * Verbatim `systemctl cat` output, including the `# <path>` banner systemd
   * prints before each fragment and drop-in.
   */
  content: string
  /** Paths systemd reported in the banner lines, in the order it printed them. */
  paths: string[]
}

export const SYSTEMD_ACTIONS = [
  'start',
  'stop',
  'restart',
  'reload',
  'enable',
  'disable'
] as const

export type SystemdAction = (typeof SYSTEMD_ACTIONS)[number]

export function isSystemdAction(value: unknown): value is SystemdAction {
  return typeof value === 'string' && (SYSTEMD_ACTIONS as readonly string[]).includes(value)
}

const PROTECTED_SYSTEMD_ACTIONS = new Set<SystemdAction>(['stop', 'disable'])

/**
 * Unit name patterns that must not be stopped or disabled from Relay — doing so
 * can lock you out or break core system services. Restart/reload remain available.
 */
const PROTECTED_SYSTEMD_UNIT_PATTERNS = [
  /^ssh\.service$/i,
  /^sshd\.service$/i,
  /^ssh\.socket$/i,
  /^sshd\.socket$/i,
  /^sshd@.+\.service$/i,
  /^dbus\.service$/i,
  /^dbus\.socket$/i,
  /^systemd-logind\.service$/i,
  /^systemd-networkd\.service$/i,
  /^systemd-resolved\.service$/i,
  /^networking\.service$/i,
  /^NetworkManager\.service$/i
] as const

export function isProtectedSystemdUnit(unit: string): boolean {
  return PROTECTED_SYSTEMD_UNIT_PATTERNS.some((pattern) => pattern.test(unit))
}

/**
 * Returns a user-facing block reason when `action` must not run on `unit`, or
 * null when the action is permitted.
 */
export function getProtectedSystemdUnitActionBlock(
  unit: string,
  action: SystemdAction
): string | null {
  if (!PROTECTED_SYSTEMD_ACTIONS.has(action)) return null
  if (!isProtectedSystemdUnit(unit)) return null

  if (/^sshd?(@|\.)/i.test(unit)) {
    return 'SSH units are protected to avoid disconnecting your session. Use the Terminal if you need to manage sshd directly.'
  }
  if (/^dbus/i.test(unit)) {
    return 'D-Bus is protected because stopping or disabling it can break most system services.'
  }
  if (/network/i.test(unit) || /resolved/i.test(unit)) {
    return 'Core networking units are protected because stopping or disabling them can disconnect this server.'
  }
  if (/logind/i.test(unit)) {
    return 'systemd-logind is protected because stopping or disabling it can break login sessions.'
  }

  return 'This unit is protected because stopping or disabling it can destabilize the system or lock you out.'
}
