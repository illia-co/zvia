import type { SystemInfo } from '@shared/stats'
import { CommandError } from '@shared/errors'
import type { CommandRunner } from './CommandRunner'

const DELIMITER = '---RELAY---'

const INFO_COMMAND = [
  `(hostname -f 2>/dev/null || hostname)`,
  `echo '${DELIMITER}'`,
  `cat /etc/os-release 2>/dev/null || true`,
  `echo '${DELIMITER}'`,
  `uname -m`,
  `echo '${DELIMITER}'`,
  `cut -d' ' -f1 /proc/uptime`
].join('\n')

function parseOsRelease(content: string): { name: string; version: string } {
  const lines = content.split('\n')
  let name = 'Linux'
  let version = ''

  for (const line of lines) {
    if (line.startsWith('PRETTY_NAME=')) {
      const value = line.slice('PRETTY_NAME='.length).replace(/^"|"$/g, '')
      if (value) return { name: value, version: '' }
    }
    if (line.startsWith('NAME=')) {
      name = line.slice('NAME='.length).replace(/^"|"$/g, '')
    }
    if (line.startsWith('VERSION_ID=')) {
      version = line.slice('VERSION_ID='.length).replace(/^"|"$/g, '')
    }
  }

  return { name, version }
}

export class SystemInfoService {
  constructor(private readonly runner: CommandRunner) {}

  async getInfo(): Promise<SystemInfo> {
    const result = await this.runner.exec(INFO_COMMAND, 10_000)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to read system information', result.stderr || undefined)
    }

    const sections = result.stdout.trim().split(`\n${DELIMITER}\n`)
    if (sections.length < 4) {
      throw new CommandError('Unexpected system information format')
    }

    const [hostname, osRelease, architecture, uptimeRaw] = sections
    const { name, version } = parseOsRelease(osRelease)
    const uptimeSeconds = Number.parseFloat(uptimeRaw.trim())

    return {
      hostname: hostname.trim(),
      osName: name,
      osVersion: version,
      architecture: architecture.trim(),
      uptimeSeconds: Number.isFinite(uptimeSeconds) ? uptimeSeconds : 0
    }
  }
}
