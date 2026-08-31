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

function nginxLinksForCert(
  certificatePath: string,
  privateKeyPath: string | null,
  serverBlocks: NginxServerBlock[]
): SslNginxLink[] {
  const links: SslNginxLink[] = []
  for (const block of serverBlocks) {
    const certMatch =
      block.sslCertificate === certificatePath ||
      (block.sslCertificate?.endsWith('/fullchain.pem') &&
        certificatePath.endsWith('/fullchain.pem') &&
        block.sslCertificate.replace(/\/fullchain\.pem$/, '') ===
          certificatePath.replace(/\/fullchain\.pem$/, ''))
  const keyMatch =
    privateKeyPath !== null &&
    (block.sslCertificateKey === privateKeyPath ||
      (block.sslCertificateKey?.endsWith('/privkey.pem') &&
        privateKeyPath.endsWith('/privkey.pem') &&
        block.sslCertificateKey.replace(/\/privkey\.pem$/, '') ===
          privateKeyPath.replace(/\/privkey\.pem$/, '')))

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

    return {
      id: cert.id,
      primaryDomain,
      domains,
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
      nginxSites: nginxLinksForCert(cert.certificatePath, cert.privateKeyPath, serverBlocks),
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

export { certIdForPath }
