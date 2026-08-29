/**
 * Shared DTOs for the Processes tool. Kept free of Node/Electron imports.
 */

export type ProcessSignal = 'terminate' | 'kill'

export type ProcessState = 'running' | 'sleeping' | 'stopped' | 'zombie' | 'unknown'

export const PROCESS_SIGNALS = ['terminate', 'kill'] as const

export const PROCESSES_SUBSCRIPTION_INTERVALS = [1000, 2000, 5000] as const

export type ProcessesSubscriptionInterval = (typeof PROCESSES_SUBSCRIPTION_INTERVALS)[number]

export interface ProcessSummary {
  pid: number
  user: string
  cpuPercent: number
  memoryPercent: number
  rssBytes: number
  stat: string
  elapsedSeconds: number
  comm: string
  args: string
}

export interface ProcessPort {
  protocol: 'tcp' | 'udp'
  address: string
  port: number
}

export interface ProcessDetail extends ProcessSummary {
  ppid: number
  state: ProcessState
  uid: number
  cmdline: string
  exe: string | null
  cwd: string | null
  cgroupUnit: string | null
  containerId: string | null
  containerName: string | null
  unit: string | null
  unitActiveState: string | null
  listeningPorts: ProcessPort[]
  protected: boolean
  protectedReason?: string
}

export function isProcessSignal(value: unknown): value is ProcessSignal {
  return typeof value === 'string' && (PROCESS_SIGNALS as readonly string[]).includes(value)
}

export function isProcessesSubscriptionInterval(
  value: unknown
): value is ProcessesSubscriptionInterval {
  return (
    typeof value === 'number' &&
    (PROCESSES_SUBSCRIPTION_INTERVALS as readonly number[]).includes(value)
  )
}
