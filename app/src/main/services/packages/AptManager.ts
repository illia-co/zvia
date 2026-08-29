import type {
  InstalledPackage,
  PackageDetail,
  PackageOverview,
  PackageSearchResult,
  PackageUpdate,
  PaginatedResult
} from '@shared/packages'
import { CommandError } from '@shared/errors'
import type { CommandRunner } from '../CommandRunner'
import {
  mergePackageDetail,
  parseAptCacheRdepends,
  parseAptCacheSearch,
  parseAptCacheShow,
  parseAptListUpgradable,
  parseDpkgListFiles,
  parseDpkgQueryLine,
  parseDpkgQueryOutput
} from '../packagesParsers'
import type { PackageManager } from './PackageManager'

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function shellQuotePattern(value: string): string {
  return shellQuote(value.replace(/'/g, ''))
}

const DPKG_QUERY_FORMAT =
  "${Package}\\t${Version}\\t${Architecture}\\t${Status}\\t${Description}\\n"

export class AptManager implements PackageManager {
  readonly id = 'apt' as const
  readonly label = 'APT'

  constructor(private readonly runner: CommandRunner) {}

  async detect(): Promise<boolean> {
    const result = await this.runner.exec(
      'command -v apt-get >/dev/null 2>&1 && command -v dpkg >/dev/null 2>&1 && echo yes || echo no',
      5000
    )
    return result.stdout.trim() === 'yes'
  }

  async overview(distro: string): Promise<PackageOverview> {
    const command = [
      `dpkg-query -W -f='${DPKG_QUERY_FORMAT}' 2>/dev/null | wc -l`,
      `apt list --upgradable 2>/dev/null`
    ].join('\n')

    const result = await this.runner.exec(command, 60_000)
    const [countLine, ...upgradableLines] = result.stdout.split('\n')
    const installedCount = Number.parseInt((countLine ?? '').trim(), 10) || 0
    const updates = parseAptListUpgradable(upgradableLines.join('\n'))

    return {
      distro,
      manager: 'apt',
      managerLabel: this.label,
      installedCount,
      updateCount: updates.length
    }
  }

  async listInstalled(opts: {
    query?: string
    offset: number
    limit: number
  }): Promise<PaginatedResult<InstalledPackage>> {
    const baseCommand = `dpkg-query -W -f='${DPKG_QUERY_FORMAT}' 2>/dev/null`
    const query = opts.query?.trim()

    let listCommand = baseCommand
    let countCommand = `${baseCommand} | wc -l`

    if (query) {
      const pattern = shellQuotePattern(query)
      listCommand = `${baseCommand} | grep -Fi ${pattern}`
      countCommand = `${listCommand} | wc -l`
    }

    const start = opts.offset + 1
    const pagedCommand = `${listCommand} | tail -n +${start} | head -n ${opts.limit}`

    const result = await this.runner.exec(`${countCommand}\necho '---RELAY---'\n${pagedCommand}`, 60_000)
    const [countPart, pagePart] = result.stdout.split('\n---RELAY---\n')
    const total = Number.parseInt((countPart ?? '').trim().split('\n').pop() ?? '0', 10) || 0
    const items = parseDpkgQueryOutput(pagePart ?? '')

    return {
      items,
      total,
      offset: opts.offset,
      limit: opts.limit
    }
  }

  async search(query: string): Promise<PackageSearchResult[]> {
    const trimmed = query.trim()
    if (!trimmed) return []

    const command = `apt-cache search --names-only ${shellQuote(trimmed)} 2>/dev/null`
    const result = await this.runner.exec(command, 30_000)
    return parseAptCacheSearch(result.stdout)
  }

  async getInfo(name: string): Promise<PackageDetail> {
    const quoted = shellQuote(name)
    const command = [
      `apt-cache show ${quoted} 2>/dev/null`,
      `echo '---RELAY---'`,
      `apt-cache rdepends ${quoted} 2>/dev/null`,
      `echo '---RELAY---'`,
      `dpkg-query -W -f='${DPKG_QUERY_FORMAT}' ${quoted} 2>/dev/null`,
      `echo '---RELAY---'`,
      `dpkg -L ${quoted} 2>/dev/null`
    ].join('\n')

    const result = await this.runner.exec(command, 30_000)
    const [showPart, rdependsPart, installedPart, filesPart] = result.stdout.split('\n---RELAY---\n')

    const detail = parseAptCacheShow(showPart ?? '', name)
    if (!detail) {
      throw new CommandError(`Package not found: ${name}`)
    }

    const installedLine = (installedPart ?? '').trim().split('\n')[0] ?? ''
    const installed = parseDpkgQueryLine(installedLine)
    const reverseDependencies = parseAptCacheRdepends(rdependsPart ?? '')
    const installedFiles = installed ? parseDpkgListFiles(filesPart ?? '') : []

    return mergePackageDetail(detail, installed, reverseDependencies, installedFiles)
  }

  async listUpdates(): Promise<PackageUpdate[]> {
    const result = await this.runner.exec('apt list --upgradable 2>/dev/null', 60_000)
    return parseAptListUpgradable(result.stdout)
  }

  buildSimulateInstallCommand(packageName: string): string {
    return `DEBIAN_FRONTEND=noninteractive apt-get install -s ${shellQuote(packageName)} 2>&1`
  }

  buildInstallCommand(packageName: string): string {
    return `DEBIAN_FRONTEND=noninteractive apt-get install -y ${shellQuote(packageName)} 2>&1`
  }

  buildRemoveCommand(packageName: string): string {
    return `DEBIAN_FRONTEND=noninteractive apt-get remove -y ${shellQuote(packageName)} 2>&1`
  }

  buildUpgradeCommand(packageName: string): string {
    return `DEBIAN_FRONTEND=noninteractive apt-get install --only-upgrade -y ${shellQuote(packageName)} 2>&1`
  }

  buildUpgradeAllCommand(): string {
    return 'DEBIAN_FRONTEND=noninteractive apt-get upgrade -y 2>&1'
  }

  buildVerifyCommand(packageName: string): string {
    return `dpkg-query -W -f='${DPKG_QUERY_FORMAT}' ${shellQuote(packageName)} 2>/dev/null`
  }
}
