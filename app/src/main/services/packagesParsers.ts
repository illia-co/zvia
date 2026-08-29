import type {
  InstalledPackage,
  PackageDetail,
  PackageSearchResult,
  PackageUpdate
} from '@shared/packages'

export function parseDpkgQueryLine(line: string): InstalledPackage | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const parts = trimmed.split('\t')
  if (parts.length < 5) return null

  const [name, version, architecture, status, ...descriptionParts] = parts
  if (!name || status !== 'install ok installed') return null

  return {
    name,
    version,
    architecture,
    status,
    description: descriptionParts.join('\t')
  }
}

export function parseDpkgQueryOutput(stdout: string): InstalledPackage[] {
  const packages: InstalledPackage[] = []
  for (const line of stdout.split('\n')) {
    const parsed = parseDpkgQueryLine(line)
    if (parsed) packages.push(parsed)
  }
  return packages
}

export function parseAptListUpgradable(stdout: string): PackageUpdate[] {
  const updates: PackageUpdate[] = []

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('Listing')) continue

    const match = trimmed.match(
      /^([^/\s]+)\/\S+\s+(\S+)\s+(\S+)\s+\[upgradable from:\s*([^\]]+)\]$/
    )
    if (!match) continue

    updates.push({
      name: match[1],
      candidateVersion: match[2],
      architecture: match[3],
      installedVersion: match[4].trim()
    })
  }

  return updates
}

export function parseAptCacheSearch(stdout: string): PackageSearchResult[] {
  const results: PackageSearchResult[] = []
  const seen = new Set<string>()

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const separator = trimmed.indexOf(' - ')
    if (separator === -1) continue

    const name = trimmed.slice(0, separator).trim()
    const description = trimmed.slice(separator + 3).trim()
    if (!name || seen.has(name)) continue

    seen.add(name)
    results.push({ name, description })
  }

  return results
}

interface AptCacheShowBlock {
  fields: Map<string, string[]>
}

function parseAptCacheShowBlocks(stdout: string): AptCacheShowBlock[] {
  const blocks: AptCacheShowBlock[] = []
  let current: AptCacheShowBlock | null = null

  for (const line of stdout.split('\n')) {
    if (!line.trim()) {
      if (current) {
        blocks.push(current)
        current = null
      }
      continue
    }

    const colon = line.indexOf(':')
    if (colon === -1) continue

    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim()
    if (!key) continue

    if (!current) current = { fields: new Map() }
    const existing = current.fields.get(key)
    if (existing) {
      existing.push(value)
    } else {
      current.fields.set(key, [value])
    }
  }

  if (current) blocks.push(current)
  return blocks
}

function fieldValue(block: AptCacheShowBlock, key: string): string | null {
  const values = block.fields.get(key)
  return values?.[0] ?? null
}

function fieldValues(block: AptCacheShowBlock, key: string): string[] {
  return block.fields.get(key) ?? []
}

function parseDependsField(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean)
}

export function parseAptCacheShow(stdout: string, packageName: string): PackageDetail | null {
  const blocks = parseAptCacheShowBlocks(stdout)
  const block =
    blocks.find((entry) => fieldValue(entry, 'Package') === packageName) ?? blocks[0]
  if (!block) return null

  const name = fieldValue(block, 'Package') ?? packageName
  const version = fieldValue(block, 'Version')
  const architecture = fieldValue(block, 'Architecture')
  const description =
    fieldValue(block, 'Description-en') ??
    fieldValue(block, 'Description') ??
    ''
  const homepage = fieldValue(block, 'Homepage')
  const depends = parseDependsField(fieldValue(block, 'Depends'))
  const preDepends = parseDependsField(fieldValue(block, 'Pre-Depends'))
  const dependencies = [...new Set([...depends, ...preDepends])]

  return {
    name,
    version,
    installedVersion: null,
    architecture,
    description,
    homepage,
    installed: false,
    dependencies,
    reverseDependencies: [],
    installedFiles: []
  }
}

export function parseAptCacheRdepends(stdout: string): string[] {
  const results: string[] = []
  let inDepends = false

  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('Reverse Depends:')) {
      inDepends = true
      continue
    }
    if (trimmed.endsWith(':') && !trimmed.startsWith('|')) {
      inDepends = false
      continue
    }
    if (!inDepends) continue

    const match = trimmed.match(/^\|\s*([^\s<]+)/) ?? trimmed.match(/^([^\s<|]+)/)
    if (match?.[1]) {
      results.push(match[1])
    }
  }

  return [...new Set(results)]
}

export function parseDpkgListFiles(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function mergePackageDetail(
  detail: PackageDetail,
  installed: InstalledPackage | null,
  reverseDependencies: string[],
  installedFiles: string[]
): PackageDetail {
  return {
    ...detail,
    installedVersion: installed?.version ?? null,
    installed: installed !== null,
    reverseDependencies,
    installedFiles
  }
}
