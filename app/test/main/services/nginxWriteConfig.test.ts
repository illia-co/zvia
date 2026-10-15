import { beforeEach, describe, expect, it, vi } from 'vitest'

interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

const hoisted = vi.hoisted(() => {
  const TARGET = '/etc/nginx/sites-available/example'
  const execMock = vi.fn(
    async (_command: string): Promise<ExecResult> => ({ stdout: '', stderr: '', exitCode: 0 })
  )
  const sftpMock = {
    writeFile(
      path: string,
      _data: unknown,
      _encoding: string,
      callback: (error: Error | null) => void
    ): void {
      // Root-owned config: the SSH user cannot write it directly.
      if (path === TARGET) {
        callback(new Error('Permission denied'))
        return
      }
      callback(null)
    }
  }
  return { TARGET, execMock, sftpMock }
})

const { TARGET, execMock, sftpMock } = hoisted
let chmodResult: ExecResult = { stdout: '', stderr: '', exitCode: 0 }

const DETECTION_STDOUT = [
  '---RELAY:NGINX-WHICH---',
  '/usr/sbin/nginx',
  '---RELAY:NGINX-VERSION---',
  'nginx version: nginx/1.24.0 (Ubuntu)',
  'configure arguments: --prefix=/etc/nginx --conf-path=/etc/nginx/nginx.conf --error-log-path=/var/log/nginx/error.log --http-log-path=/var/log/nginx/access.log',
  '---RELAY:NGINX-SYSTEMCTL---',
  '/usr/bin/systemctl'
].join('\n')

vi.mock('@main/ssh/ConnectionManager', () => ({
  connectionManager: {
    getConnection: () => ({
      exec: hoisted.execMock,
      getSftp: async () => hoisted.sftpMock
    }),
    exec: hoisted.execMock,
    registerTeardown: () => undefined
  }
}))

vi.mock('@main/services/PrivilegeService', () => ({
  privilegeService: {
    getContext: async () => ({ isRoot: false, canSudoNonInteractive: true }),
    buildPrivileged: (_context: unknown, command: string) => `sudo -n ${command}`,
    clearCache: () => undefined
  }
}))

import { nginxService } from '@main/services/NginxService'

beforeEach(() => {
  execMock.mockReset()
  chmodResult = { stdout: '', stderr: '', exitCode: 0 }
  execMock.mockImplementation(async (command: string) => {
    if (command.includes('NGINX-VERSION')) {
      return { stdout: DETECTION_STDOUT, stderr: '', exitCode: 0 }
    }
    if (command.includes('chmod')) {
      return chmodResult
    }
    return { stdout: '', stderr: '', exitCode: 0 }
  })
})

function executedCommands(): string[] {
  return execMock.mock.calls.map(([command]) => command as string)
}

describe('NginxService.writeConfig elevated fallback', () => {
  it('elevates chmod as well as cp', async () => {
    await nginxService.writeConfig('srv-elevated', TARGET, 'server {}')

    const chmodCommands = executedCommands().filter((command) => command.includes('chmod'))
    expect(chmodCommands).toHaveLength(1)
    // Regression: `sudo cp … && chmod …` ran chmod as the unprivileged SSH
    // user, which fails on root-owned configs with "Operation not permitted".
    // chmod must be elevated in its own right, not riding on cp's sudo.
    expect(chmodCommands[0].startsWith('sudo -n chmod')).toBe(true)

    const copyCommands = executedCommands().filter((command) => command.includes(' cp -- '))
    expect(copyCommands).toHaveLength(1)
    expect(copyCommands[0].startsWith('sudo -n cp')).toBe(true)
  })

  it('reports the failing step when chmod fails', async () => {
    chmodResult = {
      stdout: `chmod: changing permissions of '${TARGET}': Operation not permitted`,
      stderr: '',
      exitCode: 1
    }

    const error = await nginxService
      .writeConfig('srv-chmod-fails', TARGET, 'server {}')
      .then(
        () => null,
        (failure: unknown) => failure as { message: string; details?: string }
      )
    expect(error).not.toBeNull()
    expect(error?.message).toBe('Could not write the config file')
    expect(error?.details).toContain('Operation not permitted')
  })
})
