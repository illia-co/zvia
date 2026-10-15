import { createHash } from 'node:crypto'
import type { NginxServerBlock } from './deployments/types'
import type {
  SslCertificate,
  SslCertificateStatus,
  SslNginxLink,
  SslRenewalMethod
} from '@shared/ssl'
import { EXPIRING_SOON_DAYS } from '@shared/ssl'
import { parseNginxServerBlocks } from './deployments/parsers'

export type { NginxServerBlock }
export { parseNginxServerBlocks }

export interface OpensslCertificateInfo {
  subjectCn: string | null
  issuer: string | null
  notBefore: string | null
  notAfter: string | null
  serial: string | null
  sans: string[]
}

export interface CertbotCertificateEntry {
  certName: string
  domains: string[]
  expiryDate: string | null
  certificatePath: string
  privateKeyPath: string | null
  valid: boolean
}

export interface SystemdTimerInfo {
  nextRun: string | null
  lastAttempt: string | null
  lastResult: 'success' | 'failure' | null
}

export interface RenewalConfInfo {
  authenticator: string | null
  installer: string | null
  certificatePath: string | null
  privateKeyPath: string | null
}

function parseOpensslDate(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return trimmed
  return parsed.toISOString()
}

function parseX509Field(line: string, prefix: string): string | null {
  if (!line.startsWith(prefix)) return null
  return line.slice(prefix.length).trim() || null
}

/** Parses `openssl x509 -noout` multi-line output. */
export function parseOpensslCertificate(stdout: string): OpensslCertificateInfo {
  let subjectCn: string | null = null
  let issuer: string | null = null
  let notBefore: string | null = null
  let notAfter: string | null = null
  let serial: string | null = null
  const sans: string[] = []
  let inSan = false

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    const subject = parseX509Field(line, 'subject=')
    if (subject) {
      const cnMatch = /(?:^|,\s*)CN\s*=\s*([^,/]+)/i.exec(subject)
      subjectCn = cnMatch ? cnMatch[1].trim() : subject
      continue
    }

    const issuerValue = parseX509Field(line, 'issuer=')
    if (issuerValue) {
      issuer = issuerValue
      continue
    }

    const before = parseX509Field(line, 'notBefore=')
    if (before) {
      notBefore = parseOpensslDate(before)
      continue
    }

    const after = parseX509Field(line, 'notAfter=')
    if (after) {
      notAfter = parseOpensslDate(after)
      continue
    }

    const serialValue = parseX509Field(line, 'serial=')
    if (serialValue) {
      serial = serialValue
      continue
    }

    if (/^X509v3 Subject Alternative Name:/i.test(line)) {
      inSan = true
      const inline = line.replace(/^X509v3 Subject Alternative Name:\s*/i, '')
      if (inline) {
        for (const entry of inline.split(',')) {
          const dns = entry.trim().replace(/^DNS:/i, '').trim()
          if (dns) sans.push(dns)
        }
      }
      continue
    }

    if (inSan) {
      if (/^[A-Za-z]/.test(line) && line.includes('=')) {
        inSan = false
      } else {
        for (const entry of line.split(',')) {
          const dns = entry.trim().replace(/^DNS:/i, '').trim()
          if (dns) sans.push(dns)
        }
        continue
      }
    }
  }

  return { subjectCn, issuer, notBefore, notAfter, serial, sans }
}

/** Parses `certbot certificates` output. */
export function parseCertbotCertificates(stdout: string): CertbotCertificateEntry[] {
  const entries: CertbotCertificateEntry[] = []
  let current: Partial<CertbotCertificateEntry> | null = null

  const flush = (): void => {
    if (!current?.certName || !current.certificatePath) return
    entries.push({
      certName: current.certName,
      domains: current.domains ?? [],
      expiryDate: current.expiryDate ?? null,
      certificatePath: current.certificatePath,
      privateKeyPath: current.privateKeyPath ?? null,
      valid: current.valid ?? true
    })
    current = null
  }

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd()
    const nameMatch = /^\s*Certificate Name:\s*(.+)$/.exec(line)
    if (nameMatch) {
      flush()
      current = { certName: nameMatch[1].trim(), domains: [], valid: true }
      continue
    }
    if (!current) continue

    const domainsMatch = /^\s*Domains:\s*(.+)$/.exec(line)
    if (domainsMatch) {
      current.domains = domainsMatch[1]
        .split(/\s+/)
        .map((domain) => domain.trim())
        .filter(Boolean)
      continue
    }

    const expiryMatch = /^\s*Expiry Date:\s*([^(]+?)(?:\s*\(([^)]+)\))?\s*$/.exec(line)
    if (expiryMatch) {
      current.expiryDate = expiryMatch[1].trim()
      const status = expiryMatch[2]?.trim().toUpperCase() ?? ''
      current.valid = !status.startsWith('INVALID')
      continue
    }

    const certPathMatch = /^\s*Certificate Path:\s*(.+)$/.exec(line)
    if (certPathMatch) {
      current.certificatePath = certPathMatch[1].trim()
      continue
    }

    const keyPathMatch = /^\s*Private Key Path:\s*(.+)$/.exec(line)
    if (keyPathMatch) {
      current.privateKeyPath = keyPathMatch[1].trim()
    }
  }

  flush()
  return entries
}

/** Extracts the version from `certbot --version` output. */
export function parseCertbotVersion(stdout: string): string | null {
  const match = /certbot\s+([0-9][^\s]*)/i.exec(stdout)
  return match ? match[1] : null
}

/** Parses `systemctl show <timer>` output for next/last trigger and result. */
export function parseSystemdTimer(stdout: string): SystemdTimerInfo {
  const properties: Record<string, string> = {}
  for (const line of stdout.split('\n')) {
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    properties[line.slice(0, separator).trim()] = line.slice(separator + 1).trim()
  }

  const nextRun = properties.NextElapseUSecRealtime || properties.NextElapseUSecMonotonic || null
  const lastAttempt = properties.LastTriggerUSec || null
  let lastResult: 'success' | 'failure' | null = null
  const result = properties.Result ?? properties.LastTriggerUSecMonotonic ?? ''
  if (/success/i.test(result)) lastResult = 'success'
  else if (/fail/i.test(result)) lastResult = 'failure'

  return {
    nextRun: nextRun && nextRun !== 'n/a' ? nextRun : null,
    lastAttempt: lastAttempt && lastAttempt !== 'n/a' ? lastAttempt : null,
    lastResult
  }
}

/** Parses a certbot renewal configuration file. */
export function parseRenewalConf(content: string): RenewalConfInfo {
  const info: RenewalConfInfo = {
    authenticator: null,
    installer: null,
    certificatePath: null,
    privateKeyPath: null
  }

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator <= 0) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (key === 'authenticator') info.authenticator = value
    if (key === 'installer') info.installer = value
    if (key === 'cert') info.certificatePath = value
    if (key === 'privkey') info.privateKeyPath = value
  }

  return info
}

export function daysUntil(notAfter: string | null, now = new Date()): number | null {
  if (!notAfter) return null
  const expiry = new Date(notAfter)
  if (Number.isNaN(expiry.getTime())) return null
  const diffMs = expiry.getTime() - now.getTime()
  return Math.floor(diffMs / (1000 * 60 * 60 * 24))
}

export function deriveStatus(options: {
  notAfter: string | null
  managedByCertbot: boolean
  lastRenewalResult: 'success' | 'failure' | null
  inspectionError?: string | null
  now?: Date
}): SslCertificateStatus {
  const { notAfter, managedByCertbot, lastRenewalResult, inspectionError, now = new Date() } =
    options

  if (inspectionError) return 'unknown'

  const remaining = daysUntil(notAfter, now)
  if (remaining === null) return 'unknown'
  if (remaining < 0) return 'expired'
  if (lastRenewalResult === 'failure' && managedByCertbot) return 'renewal-failed'
  if (!managedByCertbot) return 'renewal-unavailable'
  if (remaining <= EXPIRING_SOON_DAYS) return 'expiring-soon'
  return 'valid'
}

function certIdForPath(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 16)
}

function domainsForCert(
  openssl: OpensslCertificateInfo | null,
  certbotDomains: string[]
): { primaryDomain: string; domains: string[] } {
  const sans = openssl?.sans ?? []
  const domains = [...new Set([...certbotDomains, ...sans, openssl?.subjectCn].filter(Boolean) as string[])]
  const primaryDomain = certbotDomains[0] ?? openssl?.subjectCn ?? domains[0] ?? 'unknown'
  return { primaryDomain, domains: domains.length > 0 ? domains : [primaryDomain] }
}

function letsEncryptLiveDir(path: string): string | null {
  const match = /^\/etc\/letsencrypt\/live\/([^/]+)\//.exec(path)
  return match ? `/etc/letsencrypt/live/${match[1]}` : null
}

function letsEncryptPemKind(path: string): string | null {
  const base = path.slice(path.lastIndexOf('/') + 1)
  if (base === 'cert.pem' || base === 'fullchain.pem' || base === 'chain.pem') return 'cert'
  if (base === 'privkey.pem') return 'key'
  return null
}

function sameLetsEncryptCert(a: string, b: string): boolean {
  if (a === b) return true
  const dirA = letsEncryptLiveDir(a)
  const dirB = letsEncryptLiveDir(b)
  if (!dirA || dirA !== dirB) return false
  const kindA = letsEncryptPemKind(a)
  const kindB = letsEncryptPemKind(b)
  // cert.pem, fullchain.pem and chain.pem in the same live dir are the same cert.
  if (kindA === 'cert' && kindB === 'cert') return true
  return false
}

function sameLetsEncryptKey(a: string, b: string): boolean {
  if (a === b) return true
  const dirA = letsEncryptLiveDir(a)
  const dirB = letsEncryptLiveDir(b)
  if (!dirA || dirA !== dirB) return false
  return letsEncryptPemKind(a) === 'key' && letsEncryptPemKind(b) === 'key'
}

function nginxLinksForCert(
  certificatePath: string,
  privateKeyPath: string | null,
  serverBlocks: NginxServerBlock[]
): SslNginxLink[] {
  const links: SslNginxLink[] = []
  for (const block of serverBlocks) {
    const certMatch =
      block.sslCertificate === certificatePath ||
      (block.sslCertificate !== null && sameLetsEncryptCert(block.sslCertificate, certificatePath))
  const keyMatch =
    privateKeyPath !== null &&
    block.sslCertificateKey !== null &&
    (block.sslCertificateKey === privateKeyPath ||
      sameLetsEncryptKey(block.sslCertificateKey, privateKeyPath))

    if (!certMatch && !keyMatch) continue
    links.push({
      configPath: block.configPath,
      serverNames: [...new Set(block.serverNames)],
      listensHttps: block.listensHttps,
      ports: [...block.ports]
    })
  }
  return links
}

export function linkCertificatesToSites(
  certs: Array<{
    id: string
    certName?: string
    certificatePath: string
    privateKeyPath: string | null
    managedByCertbot: boolean
    openssl: OpensslCertificateInfo | null
    certbotDomains: string[]
    expiryDate: string | null
    inspectionError: string | null
    lastRenewalResult: 'success' | 'failure' | null
    renewalMethod: SslRenewalMethod
    lastAttempt: string | null
  }>,
  serverBlocks: NginxServerBlock[],
  now = new Date()
): SslCertificate[] {
  return certs.map((cert) => {
    const { primaryDomain, domains } = domainsForCert(cert.openssl, cert.certbotDomains)
    const notAfter = cert.openssl?.notAfter ?? cert.expiryDate
    const daysRemaining = daysUntil(notAfter, now)
    let links = nginxLinksForCert(cert.certificatePath, cert.privateKeyPath, serverBlocks)

    // Copied certs (nginx serves a copy outside /etc/letsencrypt): the path
    // never matches, so link by domain overlap instead. Path match stays first.
    if (links.length === 0) {
      const certNames = new Set(
        [...cert.certbotDomains, ...(cert.openssl?.sans ?? []), cert.openssl?.subjectCn]
          .filter((name): name is string => typeof name === 'string' && name.length > 0)
          .map((name) => name.toLowerCase())
      )
      if (certNames.size > 0) {
        links = serverBlocks
          .filter((block) => block.serverNames.some((name) => certNames.has(name.toLowerCase())))
          .map((block) => ({
            configPath: block.configPath,
            serverNames: [...new Set(block.serverNames)],
            listensHttps: block.listensHttps,
            ports: [...block.ports]
          }))
      }
    }

    // Without openssl access (root-only live dirs) the cert has no SANs.
    // The server_names of the blocks serving this cert are the honest
    // fallback: the cert is presented for exactly those names.
    let resolvedDomains = domains
    let resolvedPrimary = primaryDomain
    if (resolvedPrimary === 'unknown' || resolvedDomains.length === 0) {
      const siteNames = [...new Set(links.flatMap((link) => link.serverNames))]
      if (siteNames.length > 0) {
        resolvedDomains = [...new Set([...resolvedDomains.filter((d) => d !== 'unknown'), ...siteNames])]
        resolvedPrimary = resolvedDomains[0] ?? 'unknown'
      }
    }

    return {
      id: cert.id,
      primaryDomain: resolvedPrimary,
      domains: resolvedDomains,
      status: deriveStatus({
        notAfter,
        managedByCertbot: cert.managedByCertbot,
        lastRenewalResult: cert.lastRenewalResult,
        inspectionError: cert.inspectionError
      }),
      issuer: cert.openssl?.issuer ?? null,
      issuedAt: cert.openssl?.notBefore ?? null,
      expiresAt: notAfter,
      daysRemaining,
      certificatePath: cert.certificatePath,
      privateKeyPath: cert.privateKeyPath,
      managedByCertbot: cert.managedByCertbot,
      renewal: {
        method: cert.renewalMethod,
        lastAttempt: cert.lastAttempt,
        lastResult: cert.lastRenewalResult
      },
      nginxSites: links,
      inspectionError: cert.inspectionError
    }
  })
}

export function buildCertbotCertificate(
  entry: CertbotCertificateEntry,
  openssl: OpensslCertificateInfo | null,
  inspectionError: string | null,
  renewalMethod: SslRenewalMethod,
  lastAttempt: string | null,
  lastRenewalResult: 'success' | 'failure' | null
): SslCertificate {
  const linked = linkCertificatesToSites(
    [
      {
        id: entry.certName,
        certName: entry.certName,
        certificatePath: entry.certificatePath,
        privateKeyPath: entry.privateKeyPath,
        managedByCertbot: true,
        openssl,
        certbotDomains: entry.domains,
        expiryDate: entry.expiryDate,
        inspectionError,
        lastRenewalResult,
        renewalMethod,
        lastAttempt
      }
    ],
    []
  )
  return linked[0]
}

export function buildNginxDiscoveredCertificate(
  certificatePath: string,
  privateKeyPath: string | null,
  openssl: OpensslCertificateInfo | null,
  inspectionError: string | null,
  serverBlocks: NginxServerBlock[]
): SslCertificate {
  const linked = linkCertificatesToSites(
    [
      {
        id: certIdForPath(certificatePath),
        certificatePath,
        privateKeyPath,
        managedByCertbot: false,
        openssl,
        certbotDomains: [],
        expiryDate: openssl?.notAfter ?? null,
        inspectionError,
        lastRenewalResult: null,
        renewalMethod: 'none',
        lastAttempt: null
      }
    ],
    serverBlocks
  )
  return linked[0]
}

export function renewalConfCertName(fileName: string): string {
  return fileName.endsWith('.conf') ? fileName.slice(0, -'.conf'.length) : fileName
}

/**
 * Builds certbot-style entries from renewal configs. Used when
 * `certbot certificates` is unavailable or misses a cert that still has a
 * renewal file on disk (the reported #1: cert exists but SSL screen is empty).
 * Prefers fullchain.pem when the conf only points at cert.pem.
 */
export function certEntriesFromRenewalConfs(
  confs: Array<{ file: string; content: string }>
): CertbotCertificateEntry[] {
  const entries: CertbotCertificateEntry[] = []
  for (const { file, content } of confs) {
    const info = parseRenewalConf(content)
    if (!info.certificatePath && !info.privateKeyPath) continue
    const baseName = file.slice(file.lastIndexOf('/') + 1)
    const certName = renewalConfCertName(baseName)
    let certificatePath = info.certificatePath ?? ''
    // Normalize cert.pem -> fullchain.pem so openssl inspection and nginx
    // linking use the chain nginx actually serves.
    if (certificatePath.endsWith('/cert.pem')) {
      certificatePath = certificatePath.replace(/\/cert\.pem$/, '/fullchain.pem')
    }
    if (!certificatePath) continue
    entries.push({
      certName,
      domains: [],
      expiryDate: null,
      certificatePath,
      privateKeyPath: info.privateKeyPath,
      valid: true
    })
  }
  return entries
}

export function liveDirCertEntries(liveDirs: string[]): CertbotCertificateEntry[] {
  return liveDirs
    .map((name) => name.trim())
    .filter(Boolean)
    // ponytail: /etc/letsencrypt/live always contains a README file alongside the cert dirs
    .filter((name) => name.toLowerCase() !== 'readme' && !name.toLowerCase().startsWith('readme.'))
    .map((name) => ({
      certName: name,
      domains: [],
      expiryDate: null,
      certificatePath: `/etc/letsencrypt/live/${name}/fullchain.pem`,
      privateKeyPath: `/etc/letsencrypt/live/${name}/privkey.pem`,
      valid: true
    }))
}

export { certIdForPath, sameLetsEncryptCert }
