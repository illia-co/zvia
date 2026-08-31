import { Client } from 'ssh2'
import { homedir } from 'node:os'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export const ORBSTACK_SSH_HOST = process.env.ZVIA_SSH_HOST ?? '127.0.0.1'
export const ORBSTACK_SSH_PORT = Number(process.env.ZVIA_SSH_PORT ?? 32222)
export const ORBSTACK_SSH_USER = process.env.ZVIA_SSH_USER ?? 'default'
export const ORBSTACK_SSH_KEY =
  process.env.ZVIA_SSH_KEY ?? join(homedir(), '.orbstack/ssh/id_ed25519')
export const ORBSTACK_DOMAIN = process.env.ZVIA_DOMAIN ?? 'zvia-test.local'

const DEFAULT_TIMEOUT_MS = 30_000

export interface ExecResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface OrbstackSession {
  exec(command: string, timeoutMs?: number): Promise<ExecResult>
  close(): void
}

export async function canConnectToOrbstack(timeoutMs = 5000): Promise<boolean> {
  try {
    const session = await connectOrbstack(timeoutMs)
    session.close()
    return true
  } catch {
    return false
  }
}

export async function isFullstackProvisioned(session: OrbstackSession): Promise<boolean> {
  const marker = await session.exec('cat /var/lib/zvia-provisioned 2>/dev/null')
  return marker.stdout.includes('fullstack=1')
}

export async function connectOrbstack(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<OrbstackSession> {
  const privateKey = readFileSync(ORBSTACK_SSH_KEY)
  const conn = new Client()

  await new Promise<void>((resolve, reject) => {
    conn
      .on('ready', () => resolve())
      .on('error', reject)
      .connect({
        host: ORBSTACK_SSH_HOST,
        port: ORBSTACK_SSH_PORT,
        username: ORBSTACK_SSH_USER,
        privateKey,
        readyTimeout: timeoutMs,
        hostVerifier: () => true
      })
  })

  return {
  async exec(command: string, execTimeoutMs = DEFAULT_TIMEOUT_MS): Promise<ExecResult> {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`Timeout after ${execTimeoutMs}ms`)),
          execTimeoutMs
        )
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer)
            reject(err)
            return
          }
          let stdout = ''
          let stderr = ''
          stream.on('data', (chunk: Buffer) => {
            stdout += chunk.toString()
          })
          stream.stderr.on('data', (chunk: Buffer) => {
            stderr += chunk.toString()
          })
          stream.on('close', (code: number | null) => {
            clearTimeout(timer)
            resolve({ exitCode: code ?? 0, stdout, stderr })
          })
        })
      })
    },
    close() {
      conn.end()
    }
  }
}
