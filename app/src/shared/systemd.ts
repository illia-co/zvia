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
