import type { ExecResult } from '@shared/ipc'

export interface CommandRunner {
  exec(command: string, timeoutMs?: number): Promise<ExecResult>
}
