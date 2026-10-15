import type { BrowserWindow } from 'electron'
import type { ClientChannel } from 'ssh2'
import type { ServerId } from '@shared/server'
import type {
  SslAutoRenewal,
  SslCertificate,
  SslCertbotInfo,
  SslInstallHint,
  SslNginxLink,
  SslOverview,
  SslRenewalMethod,
  SslVerifyHttpsResult,
  SslWorkflowStepId,
  SslWorkflowStepState
} from '@shared/ssl'
import type {
  SslWorkflowDoneEvent,
  SslWorkflowOutputEvent,
  SslWorkflowStepEventPayload
} from '@shared/ipc'
import { CommandError, ConnectionError, ValidationError } from '@shared/errors'
import { connectionManager } from '../ssh/ConnectionManager'
import { getServerConnection, shellQuote } from './ServiceBase'
import { execStreamOnClient } from '../ssh/exec'
import { privilegeService } from './PrivilegeService'
import { nginxService } from './NginxService'
import { portService } from './PortService'
import { isInsideDirectory } from './nginxParsers'
import { parseSsOutput } from './portParsers'
import {
  certEntriesFromRenewalConfs,
  certIdForPath,
  linkCertificatesToSites,
  liveDirCertEntries,
  parseCertbotCertificates,
  parseCertbotVersion,
  parseNginxServerBlocks,
  parseOpensslCertificate,
  parseRenewalConf,
  parseSystemdTimer,
  sameLetsEncryptCert,
  type CertbotCertificateEntry,
  type NginxServerBlock,
  type OpensslCertificateInfo
} from './sslParsers'

const DETECTION_CACHE_TTL_MS = 30000
const RENEWAL_LOG_LINES = 200

const MARKER_CERTBOT = '---RELAY:SSL-CERTBOT---'
const MARKER_PLUGINS = '---RELAY:SSL-PLUGINS---'
const MARKER_TOOLS = '---RELAY:SSL-TOOLS---'
const MARKER_CERTS = '---RELAY:SSL-CERTS---'
const MARKER_RENEWAL = '---RELAY:SSL-RENEWAL---'
const MARKER_NGINX = '---RELAY:SSL-NGINX---'
const MARKER_OS = '---RELAY:SSL-OS---'
const MARKER_TIMERS = '---RELAY:SSL-TIMERS---'
const MARKER_CRON = '---RELAY:SSL-CRON---'

interface WorkflowStream {
  serverId: ServerId
  streamId: string
  channel: ClientChannel | null
  cancelled: boolean
}

interface DiscoveryCache {
  overview: SslOverview
  certPaths: Set<string>
  certById: Map<string, SslCertificate>
  serverBlocks: NginxServerBlock[]
  certbotEntries: CertbotCertificateEntry[]
  checkedAt: number
}

function sectionBetween(stdout: string, start: string, end?: string): string {
  const startIndex = stdout.indexOf(start)
  if (startIndex === -1) return ''
  const from = startIndex + start.length
  if (!end) return stdout.slice(from)
  const endIndex = stdout.indexOf(end, from)
  return endIndex === -1 ? stdout.slice(from) : stdout.slice(from, endIndex)
}

function workflowStreamKey(serverId: ServerId, streamId: string): string {
  return `${serverId}:${streamId}`
}

/**
 * True when a known certbot entry covers the same domains as the nginx blocks
 * serving `certificatePath` — i.e. nginx serves a copy of the cert from a
 * different path, so no duplicate nginx-discovered row is needed. The certbot
 * entry itself links to the blocks by domain overlap in linkCertificatesToSites.
 */
function domainCoveredByKnownEntry(
  certificatePath: string,
  serverBlocks: NginxServerBlock[],
  entries: CertbotCertificateEntry[],
  opensslByPath: Map<string, { openssl: OpensslCertificateInfo | null; error: string | null }>
): boolean {
  const namesForPath = new Set(
    serverBlocks
      .filter((block) => block.sslCertificate === certificatePath)
      .flatMap((block) => block.serverNames.map((name) => name.toLowerCase()))
  )
  if (namesForPath.size === 0) return false
  return entries.some((entry) => {
    const inspected = opensslByPath.get(entry.certificatePath)?.openssl
    const names = [...entry.domains, ...(inspected?.sans ?? []), inspected?.subjectCn]
      .filter((name): name is string => typeof name === 'string' && name.length > 0)
      .map((name) => name.toLowerCase())
    return names.some((name) => namesForPath.has(name))
  })
}

function parseOsRelease(content: string): { id: string; idLike: string[] } {
  let id = ''
  const idLike: string[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('ID=')) id = trimmed.slice(3).replace(/^"|"$/g, '')
    if (trimmed.startsWith('ID_LIKE=')) {
      idLike.push(
        ...trimmed
          .slice(8)
          .replace(/^"|"$/g, '')
          .split(/\s+/)
          .filter(Boolean)
      )
    }
  }
  return { id, idLike }
}

function buildInstallHint(osRelease: string): SslInstallHint | null {
  const { id, idLike } = parseOsRelease(osRelease)
  if (id === 'ubuntu' || id === 'debian' || idLike.includes('debian')) {
    return {
      command: 'apt-get update && apt-get install -y certbot python3-certbot-nginx',
      description: 'Install Certbot and the nginx plugin from your distribution packages.'
    }
  }
  return null
}

function detectCertbotChannel(
  certbotPath: string,
  snapAvailable: boolean,
  versionOutput: string
): SslCertbotInfo['channel'] {
  if (certbotPath.includes('/snap/')) return 'snap'
  if (/pip|python/i.test(versionOutput)) return 'pip'
  if (certbotPath.startsWith('/usr/bin/') || certbotPath.startsWith('/bin/')) return 'apt'
  if (snapAvailable && certbotPath.length === 0) return null
  return certbotPath ? 'unknown' : null
}

export class SSLService {
  private mainWindow: BrowserWindow | null = null
  private detectionCache = new Map<ServerId, DiscoveryCache>()
  private workflowStreams = new Map<string, WorkflowStream>()

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  private getConnection(serverId: ServerId) {
    return getServerConnection(serverId)
  }

  private async exec(serverId: ServerId, command: string, timeoutMs = 20000) {
    return this.getConnection(serverId).exec(command, timeoutMs)
  }

  private async elevate(serverId: ServerId, command: string): Promise<string> {
    const context = await privilegeService.getContext(serverId)
    return privilegeService.buildPrivileged(context, command)
  }

  private sendWorkflowStep(event: SslWorkflowStepEventPayload): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('ssl:workflowStep', event)
    }
  }

  private sendWorkflowOutput(event: SslWorkflowOutputEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('ssl:workflowOutput', event)
    }
  }

  private sendWorkflowDone(event: SslWorkflowDoneEvent): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('ssl:workflowDone', event)
    }
  }

  private emitStep(
    serverId: ServerId,
    streamId: string,
    stepId: SslWorkflowStepId,
    state: SslWorkflowStepState,
    message?: string
  ): void {
    this.sendWorkflowStep({ serverId, streamId, stepId, state, message })
  }

  private emitOutput(serverId: ServerId, streamId: string, text: string): void {
    if (!text) return
    this.sendWorkflowOutput({ serverId, streamId, data: Buffer.from(text).toString('base64') })
  }

  private async inspectCertificate(
    serverId: ServerId,
    path: string
  ): Promise<{ openssl: OpensslCertificateInfo | null; error: string | null }> {
    // Use elevation when available: /etc/letsencrypt/live is root-only and a
    // plain-user openssl probe would report permission denied.
    let prefix = ''
    try {
      const ctx = await privilegeService.getContext(serverId)
      if (ctx.isRoot || ctx.canSudoNonInteractive) {
        prefix = await this.elevate(serverId, ':').then((cmd) => cmd.slice(0, -':'.length))
        if (prefix && !prefix.endsWith(' ')) prefix += ' '
      }
    } catch {
      prefix = ''
    }
    const command = `${prefix}openssl x509 -noout -subject -issuer -dates -serial -ext subjectAltName -in ${shellQuote(path)} 2>&1`
    const result = await this.exec(serverId, command)
    if (result.exitCode !== 0) {
      return { openssl: null, error: (result.stderr || result.stdout).trim() }
    }
    return { openssl: parseOpensslCertificate(result.stdout), error: null }
  }

  private async runDiscovery(serverId: ServerId, force = false): Promise<DiscoveryCache> {
    const cached = this.detectionCache.get(serverId)
    if (!force && cached && Date.now() - cached.checkedAt < DETECTION_CACHE_TTL_MS) {
      return cached
    }

    const nginxStatus = await nginxService.getStatus(serverId)
    const elevatedCerts = await this.elevate(serverId, 'certbot certificates').catch(() => null)
    const elevatedRenewal = await this.elevate(serverId, 'ls -1 /etc/letsencrypt/renewal').catch(
      () => null
    )
    // Shared dump helper: elevated `nginx -T`, plain fallback, then an
    // SFTP-assembled dump. Emerg failures (root-only ssl keys) yield no dump
    // from `nginx -T` at all, which is why the SFTP leg matters here.
    const nginxDump = await nginxService.getConfigDump(serverId).catch(() => null)

    const discoveryCommand = [
      `echo '${MARKER_CERTBOT}'`,
      // Absolute fallbacks: non-interactive PATH often lacks snap dirs.
      // Assignment shares the line so section line indices stay stable.
      'CERTBOT_BIN=$(command -v certbot 2>/dev/null || ls /usr/bin/certbot /snap/bin/certbot /usr/local/bin/certbot 2>/dev/null | head -1); echo "$CERTBOT_BIN"; command -v snap 2>/dev/null; ${CERTBOT_BIN:-certbot} --version 2>&1',
      `echo '${MARKER_PLUGINS}'`,
      '${CERTBOT_BIN:-certbot} plugins 2>&1',
      `echo '${MARKER_TOOLS}'`,
      'command -v openssl 2>/dev/null; command -v curl 2>/dev/null; command -v systemctl 2>/dev/null; command -v crontab 2>/dev/null',
      `echo '${MARKER_CERTS}'`,
      elevatedCerts ? `${elevatedCerts} 2>&1` : 'echo "certbot certificates unavailable"',
      `echo '${MARKER_RENEWAL}'`,
      // Renewal dir listing is best-effort without elevation too: the dir and
      // confs are often world-readable even for password-sudo users.
      elevatedRenewal ? `${elevatedRenewal} 2>/dev/null` : 'ls -1 /etc/letsencrypt/renewal 2>/dev/null',
      `echo '${MARKER_NGINX}'`,
      'echo ""',
      `echo '${MARKER_OS}'`,
      'cat /etc/os-release 2>/dev/null',
      `echo '${MARKER_TIMERS}'`,
      'systemctl list-timers --all --no-pager 2>/dev/null; systemctl show certbot.timer snap.certbot.renew.timer --property=NextElapseUSecRealtime,LastTriggerUSec,Result --no-pager 2>/dev/null',
      `echo '${MARKER_CRON}'`,
      'grep -R "certbot renew" /etc/cron.* 2>/dev/null; crontab -l 2>/dev/null; sudo -n crontab -l 2>/dev/null'
    ].join('; ')

    const result = await this.exec(serverId, discoveryCommand, 45000)
    const certbotSection = sectionBetween(result.stdout, MARKER_CERTBOT, MARKER_PLUGINS)
    const pluginsSection = sectionBetween(result.stdout, MARKER_PLUGINS, MARKER_TOOLS)
    const toolsSection = sectionBetween(result.stdout, MARKER_TOOLS, MARKER_CERTS)
    const certsSection = sectionBetween(result.stdout, MARKER_CERTS, MARKER_RENEWAL)
    const renewalSection = sectionBetween(result.stdout, MARKER_RENEWAL, MARKER_NGINX)
    const osSection = sectionBetween(result.stdout, MARKER_OS, MARKER_TIMERS)
    const timersSection = sectionBetween(result.stdout, MARKER_TIMERS, MARKER_CRON)
    const cronSection = sectionBetween(result.stdout, MARKER_CRON)

    const certbotLines = certbotSection.trim().split('\n')
    const certbotPath = certbotLines[0]?.trim() ?? ''
    const snapPath = certbotLines[1]?.trim() ?? ''
    const versionOutput = certbotLines.slice(2).join('\n')
    const certbotInstalled = certbotPath.length > 0
    const nginxPluginAvailable = /nginx.*enabled/i.test(pluginsSection)

    const toolLines = toolsSection.trim().split('\n')
    const opensslAvailable = (toolLines[0]?.trim().length ?? 0) > 0
    const curlAvailable = (toolLines[1]?.trim().length ?? 0) > 0
    const systemdAvailable = (toolLines[2]?.trim().length ?? 0) > 0
    const cronAvailable = (toolLines[3]?.trim().length ?? 0) > 0

    const certbotEntries = certbotInstalled ? parseCertbotCertificates(certsSection) : []
    const nginxDumpText = nginxDump?.dump ?? ''
    const serverBlocks = nginxDumpText.includes('# configuration file')
      ? parseNginxServerBlocks(nginxDumpText)
      : []

    // Fallback: `certbot certificates` can miss certs (strict parse, custom
    // config-dir, broken output). Renewal confs + live dirs are the on-disk
    // source of truth when the terminal user can read them via sudo.
    // Only runs when certbot output yielded nothing new to avoid extra SSH round-trips.
    const renewalFiles = renewalSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.conf'))
    let fallbackEntries: CertbotCertificateEntry[] = []
    try {
      const knownPaths = new Set(certbotEntries.map((entry) => entry.certificatePath))
      const knownNames = new Set(certbotEntries.map((entry) => entry.certName))
      // Triggers on renewal listing OR on nginx blocks referencing
      // letsencrypt paths: with an emerg-killed `nginx -T` and an unreadable
      // renewal dir, the SFTP-fed blocks are still enough to seed the scan.
      const referencesLetsEncrypt = serverBlocks.some((block) =>
        (block.sslCertificate ?? '').includes('/etc/letsencrypt/')
      )
      const needsFallback =
        certbotEntries.length === 0 && (renewalFiles.length > 0 || referencesLetsEncrypt)
      if (needsFallback) {
        const scanBody =
          'for f in /etc/letsencrypt/renewal/*.conf; do echo "---RELAY:SSL-RENEWAL-CONF:$f---"; cat -- "$f" 2>/dev/null; done; echo "---RELAY:SSL-LIVE---"; ls -1 /etc/letsencrypt/live 2>/dev/null'
        // Renewal confs are often 644/world-readable, so a plain scan
        // recovers certbot certs for password-sudo users too.
        const renewalCat =
          (await this.elevate(serverId, scanBody).catch(() => null)) ?? scanBody
        {
          const renewalResult = await this.exec(serverId, `${renewalCat} 2>&1`, 20000)
          if (renewalResult.exitCode === 0 && renewalResult.stdout.includes('---RELAY:SSL-')) {
            const confs: Array<{ file: string; content: string }> = []
            const confMarker = '---RELAY:SSL-RENEWAL-CONF:'
            const liveMarker = '---RELAY:SSL-LIVE---'
            const liveIndex = renewalResult.stdout.indexOf(liveMarker)
            const confSection =
              liveIndex === -1 ? renewalResult.stdout : renewalResult.stdout.slice(0, liveIndex)
            let cursor = 0
            while (true) {
              const markerIndex = confSection.indexOf(confMarker, cursor)
              if (markerIndex === -1) break
              const nameStart = markerIndex + confMarker.length
              const nameEnd = confSection.indexOf('---', nameStart)
              if (nameEnd === -1) break
              const file = confSection.slice(nameStart, nameEnd).trim()
              const contentStart = nameEnd + 3
              const nextMarker = confSection.indexOf(confMarker, contentStart)
              const content =
                nextMarker === -1
                  ? confSection.slice(contentStart)
                  : confSection.slice(contentStart, nextMarker)
              // Validate with the shared parser; skips empty/garbage confs.
              const parsed = parseRenewalConf(content)
              if (parsed.certificatePath || parsed.privateKeyPath) {
                confs.push({ file, content })
              }
              cursor = nextMarker === -1 ? confSection.length : nextMarker
            }
            fallbackEntries = certEntriesFromRenewalConfs(confs).filter(
              (entry) => !knownPaths.has(entry.certificatePath) && !knownNames.has(entry.certName)
            )
            const liveOutput =
              liveIndex === -1 ? '' : renewalResult.stdout.slice(liveIndex + liveMarker.length)
            const liveDirs = liveOutput
              .split('\n')
              .map((line) => line.trim())
              .filter((line) => line && !line.includes(' ') && !line.includes('/'))
            const liveEntries = liveDirCertEntries(liveDirs).filter(
              (entry) =>
                ![...knownPaths, ...fallbackEntries.map((f) => f.certificatePath)].includes(
                  entry.certificatePath
                ) && !knownNames.has(entry.certName)
            )
            fallbackEntries = [...fallbackEntries, ...liveEntries]
          }
        }
      }
    } catch {
      // Fallback is best-effort; certbot/nginx results still stand.
    }
    const allCertbotEntries = [...certbotEntries, ...fallbackEntries]

    const certPaths = new Set<string>()
    for (const entry of allCertbotEntries) certPaths.add(entry.certificatePath)
    for (const block of serverBlocks) {
      if (block.sslCertificate) certPaths.add(block.sslCertificate)
    }

    // Inspect with elevation when the terminal user has it: privkey/live dirs
    // are root-only (700/600), plain-user openssl returns permission denied
    // which previously surfaced as status unknown.
    let inspectPrefix = ''
    try {
      const ctx = await privilegeService.getContext(serverId)
      inspectPrefix = ctx.isRoot || ctx.canSudoNonInteractive ? await this.elevate(serverId, ':').then((cmd) => cmd.slice(0, -':'.length)) : ''
      if (inspectPrefix && !inspectPrefix.endsWith(' ')) inspectPrefix += ' '
    } catch {
      inspectPrefix = ''
    }

    const opensslByPath = new Map<string, { openssl: OpensslCertificateInfo | null; error: string | null }>()
    if (opensslAvailable && certPaths.size > 0) {
      const inspectCommands = [...certPaths].map(
        (path) =>
          `echo '---RELAY:SSL-INSPECT:${path}---'; ${inspectPrefix}openssl x509 -noout -subject -issuer -dates -serial -ext subjectAltName -in ${shellQuote(path)} 2>&1`
      )
      const inspectResult = await this.exec(serverId, inspectCommands.join('; '), 45000)
      for (const path of certPaths) {
        const marker = `---RELAY:SSL-INSPECT:${path}---`
        const output = sectionBetween(inspectResult.stdout, marker).trim()
        if (/^subject=/m.test(output)) {
          opensslByPath.set(path, { openssl: parseOpensslCertificate(output), error: null })
        } else {
          opensslByPath.set(path, { openssl: null, error: output || 'openssl inspection failed' })
        }
      }
    }

    const autoRenewal = this.detectAutoRenewal(
      systemdAvailable,
      cronAvailable,
      certbotInstalled,
      renewalSection,
      timersSection,
      cronSection
    )

    const linkedInputs = allCertbotEntries.map((entry) => {
      const inspection = opensslByPath.get(entry.certificatePath) ?? {
        openssl: null,
        error: 'Certificate path was not inspected'
      }
      return {
        id: entry.certName,
        certificatePath: entry.certificatePath,
        privateKeyPath: entry.privateKeyPath,
        managedByCertbot: true,
        openssl: inspection.openssl,
        certbotDomains: entry.domains,
        expiryDate: entry.expiryDate,
        inspectionError: inspection.error,
        lastRenewalResult: autoRenewal.lastResult,
        renewalMethod: autoRenewal.method,
        lastAttempt: autoRenewal.lastAttempt
      }
    })

    for (const block of serverBlocks) {
      if (!block.sslCertificate) continue
      const alreadyCovered =
        [...certPaths].some(
          (known) =>
            known === block.sslCertificate ||
            sameLetsEncryptCert(known, block.sslCertificate as string)
        ) || domainCoveredByKnownEntry(block.sslCertificate, serverBlocks, allCertbotEntries, opensslByPath)
      if (alreadyCovered) continue
      const inspection = opensslByPath.get(block.sslCertificate) ?? {
        openssl: null,
        error: opensslAvailable ? 'Certificate path was not inspected' : 'openssl is not available'
      }
      linkedInputs.push({
        id: certIdForPath(block.sslCertificate),
        certificatePath: block.sslCertificate,
        privateKeyPath: block.sslCertificateKey,
        managedByCertbot: false,
        openssl: inspection.openssl,
        certbotDomains: [],
        expiryDate: inspection.openssl?.notAfter ?? null,
        inspectionError: inspection.error,
        lastRenewalResult: null,
        renewalMethod: 'none' as SslRenewalMethod,
        lastAttempt: null
      })
      certPaths.add(block.sslCertificate)
    }

    const certificates = linkCertificatesToSites(linkedInputs, serverBlocks)
    const certById = new Map(certificates.map((cert) => [cert.id, cert]))

    const certbot: SslCertbotInfo = {
      installed: certbotInstalled,
      version: certbotInstalled ? parseCertbotVersion(versionOutput) : null,
      channel: certbotInstalled
        ? detectCertbotChannel(certbotPath, snapPath.length > 0, versionOutput)
        : null,
      nginxPluginAvailable,
      installHint: certbotInstalled ? null : buildInstallHint(osSection)
    }

    const overview: SslOverview = {
      nginx: {
        installed: nginxStatus.installed,
        running: nginxStatus.activeState === 'active',
        version: nginxStatus.version
      },
      certbot,
      certificates,
      autoRenewal,
      opensslAvailable,
      capabilities: {
        systemd: systemdAvailable,
        cron: cronAvailable,
        curl: curlAvailable
      }
    }

    const cache: DiscoveryCache = {
      overview,
      certPaths,
      certById,
      serverBlocks,
      certbotEntries: allCertbotEntries,
      checkedAt: Date.now()
    }
    this.detectionCache.set(serverId, cache)
    return cache
  }

  private detectAutoRenewal(
    systemdAvailable: boolean,
    cronAvailable: boolean,
    certbotInstalled: boolean,
    renewalSection: string,
    timersSection: string,
    cronSection: string
  ): SslAutoRenewal {
    const renewalFiles = renewalSection
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.endsWith('.conf'))

    if (systemdAvailable) {
      const hasCertbotTimer =
        /certbot\.timer/.test(timersSection) || /snap\.certbot\.renew\.timer/.test(timersSection)
      if (hasCertbotTimer) {
        const timerName = /snap\.certbot\.renew\.timer/.test(timersSection)
          ? 'snap.certbot.renew.timer'
          : 'certbot.timer'
        const timerInfo = parseSystemdTimer(timersSection)
        return {
          configured: true,
          method: 'systemd-timer',
          detail: timerName,
          nextRun: timerInfo.nextRun,
          lastAttempt: timerInfo.lastAttempt,
          lastResult: timerInfo.lastResult,
          canEnable: false
        }
      }
    }

    if (cronAvailable && /certbot renew/.test(cronSection)) {
      const cronLine =
        cronSection
          .split('\n')
          .find((line) => /certbot renew/.test(line))
          ?.trim() ?? 'certbot renew'
      return {
        configured: true,
        method: 'cron',
        detail: cronLine,
        nextRun: null,
        lastAttempt: null,
        lastResult: null,
        canEnable: false
      }
    }

    if (renewalFiles.length > 0 && certbotInstalled) {
      return {
        configured: true,
        method: 'certbot-internal',
        detail: `${renewalFiles.length} renewal configuration file(s)`,
        nextRun: null,
        lastAttempt: null,
        lastResult: null,
        canEnable: false
      }
    }

    return {
      configured: false,
      method: 'none',
      detail: null,
      nextRun: null,
      lastAttempt: null,
      lastResult: null,
      canEnable: certbotInstalled && systemdAvailable
    }
  }

  private async assertKnownCertId(serverId: ServerId, id: string): Promise<SslCertificate> {
    const cache = await this.runDiscovery(serverId)
    const cert = cache.certById.get(id)
    if (!cert) {
      throw new ValidationError('Invalid certificate id: not found in server discovery', id)
    }
    return cert
  }

  private async assertKnownCertName(serverId: ServerId, certName: string): Promise<SslCertificate> {
    const cache = await this.runDiscovery(serverId)
    const cert = cache.certById.get(certName)
    if (!cert) {
      throw new ValidationError('Invalid certificate name: not found in server discovery', certName)
    }
    return cert
  }

  async getOverview(serverId: ServerId): Promise<SslOverview> {
    const cache = await this.runDiscovery(serverId)
    return cache.overview
  }

  async getCertificate(serverId: ServerId, id: string): Promise<SslCertificate> {
    return this.assertKnownCertId(serverId, id)
  }

  async getNginxSites(serverId: ServerId): Promise<SslNginxLink[]> {
    const cache = await this.runDiscovery(serverId)
    const links = new Map<string, SslNginxLink>()
    for (const block of cache.serverBlocks) {
      if (block.serverNames.length === 0 && block.ports.length === 0) continue
      const key = block.configPath
      links.set(key, {
        configPath: block.configPath,
        serverNames: [...new Set(block.serverNames)],
        listensHttps: block.listensHttps,
        ports: [...block.ports]
      })
    }
    return [...links.values()]
  }

  async installCertbot(serverId: ServerId): Promise<void> {
    const cache = await this.runDiscovery(serverId)
    const hint = cache.overview.certbot.installHint
    if (!hint) {
      throw new CommandError(
        'Automatic Certbot installation is not supported on this distribution',
        'Install certbot and python3-certbot-nginx manually, then refresh.'
      )
    }
    const command = await this.elevate(serverId, hint.command)
    const result = await this.exec(serverId, `${command} 2>&1`, 120000)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to install Certbot', result.stdout.trim() || result.stderr.trim())
    }
    this.detectionCache.delete(serverId)
  }

  async renew(serverId: ServerId, certName: string): Promise<void> {
    await this.assertKnownCertName(serverId, certName)
    const command = await this.elevate(
      serverId,
      `certbot renew --cert-name ${shellQuote(certName)}`
    )
    const result = await this.exec(serverId, `${command} 2>&1`, 120000)
    if (result.exitCode !== 0) {
      throw new CommandError('Certificate renewal failed', result.stdout.trim() || result.stderr.trim())
    }
    this.detectionCache.delete(serverId)
  }

  async testRenewal(serverId: ServerId, certName: string): Promise<string> {
    await this.assertKnownCertName(serverId, certName)
    const command = await this.elevate(
      serverId,
      `certbot renew --cert-name ${shellQuote(certName)} --dry-run`
    )
    const result = await this.exec(serverId, `${command} 2>&1`, 180000)
    const output = (result.stdout || result.stderr).trim()
    if (result.exitCode !== 0) {
      throw new CommandError('Renewal dry-run failed', output)
    }
    return output
  }

  async enableAutoRenewal(serverId: ServerId): Promise<void> {
    const cache = await this.runDiscovery(serverId)
    if (cache.overview.autoRenewal.configured) {
      throw new ValidationError(
        'Auto-renewal is already configured on this server',
        cache.overview.autoRenewal.detail ?? undefined
      )
    }
    if (!cache.overview.capabilities.systemd) {
      throw new ValidationError('systemd is not available; cannot enable a certbot timer')
    }

    const timer =
      cache.overview.certbot.channel === 'snap' ? 'snap.certbot.renew.timer' : 'certbot.timer'
    const command = await this.elevate(serverId, `systemctl enable --now ${timer}`)
    const result = await this.exec(serverId, `${command} 2>&1`, 30000)
    if (result.exitCode !== 0) {
      throw new CommandError('Failed to enable auto-renewal', result.stdout.trim())
    }
    this.detectionCache.delete(serverId)
  }

  async verifyHttps(serverId: ServerId, domain: string): Promise<SslVerifyHttpsResult> {
    const localCommand = `curl -sS -o /dev/null -w '%{http_code}' --max-time 10 --resolve ${shellQuote(`${domain}:443:127.0.0.1`)} ${shellQuote(`https://${domain}/`)} 2>&1`
    const publicCommand = `curl -sS -o /dev/null -w '%{http_code}' --max-time 10 ${shellQuote(`https://${domain}/`)} 2>&1`

    const [localResult, publicResult] = await Promise.all([
      this.exec(serverId, localCommand, 15000),
      this.exec(serverId, publicCommand, 15000)
    ])

    const localCode = localResult.stdout.trim()
    const publicCode = publicResult.stdout.trim()

    return {
      localResolve: {
        responding: localResult.exitCode === 0 && /^[0-9]{3}$/.test(localCode),
        httpCode: /^[0-9]{3}$/.test(localCode) ? localCode : null
      },
      public: {
        responding: publicResult.exitCode === 0 && /^[0-9]{3}$/.test(publicCode),
        httpCode: /^[0-9]{3}$/.test(publicCode) ? publicCode : null
      }
    }
  }

  async getRenewalLog(serverId: ServerId, certName: string): Promise<string> {
    await this.assertKnownCertName(serverId, certName)
    const command = await this.elevate(
      serverId,
      `tail -n ${RENEWAL_LOG_LINES} /var/log/letsencrypt/letsencrypt.log`
    )
    const result = await this.exec(serverId, `${command} 2>&1`, 20000)
    if (result.exitCode !== 0) {
      throw new CommandError('Could not read the renewal log', result.stdout.trim())
    }
    return result.stdout
  }

  cancelEnableHttps(serverId: ServerId, streamId: string): void {
    const key = workflowStreamKey(serverId, streamId)
    const stream = this.workflowStreams.get(key)
    if (!stream) return
    stream.cancelled = true
    stream.channel?.close()
    this.workflowStreams.delete(key)
  }

  async startEnableHttps(
    serverId: ServerId,
    streamId: string,
    options: { domain: string; configPath: string; email: string; redirect: boolean }
  ): Promise<void> {
    const key = workflowStreamKey(serverId, streamId)
    if (this.workflowStreams.has(key)) {
      throw new CommandError(`HTTPS workflow already exists: ${streamId}`)
    }

    const stream: WorkflowStream = { serverId, streamId, channel: null, cancelled: false }
    this.workflowStreams.set(key, stream)

    void this.runEnableHttpsWorkflow(serverId, streamId, options).finally(() => {
      this.workflowStreams.delete(key)
    })
  }

  private async runEnableHttpsWorkflow(
    serverId: ServerId,
    streamId: string,
    options: { domain: string; configPath: string; email: string; redirect: boolean }
  ): Promise<void> {
    let backupPath: string | undefined
    let capturedOutput = ''

    const fail = (stepId: SslWorkflowStepId, message: string, output = ''): void => {
      this.emitStep(serverId, streamId, stepId, 'failed', message)
      this.sendWorkflowDone({
        serverId,
        streamId,
        success: false,
        failedStepId: stepId,
        output: output || message,
        backupPath
      })
    }

    const isCancelled = (): boolean =>
      this.workflowStreams.get(workflowStreamKey(serverId, streamId))?.cancelled === true

    try {
      this.emitStep(serverId, streamId, 'nginx-installed', 'running')
      const nginxStatus = await nginxService.getStatus(serverId)
      if (!nginxStatus.installed) {
        fail('nginx-installed', 'nginx is not installed on this server')
        return
      }
      this.emitStep(serverId, streamId, 'nginx-installed', 'ok')

      this.emitStep(serverId, streamId, 'nginx-running', 'running')
      if (nginxStatus.activeState !== 'active') {
        fail('nginx-running', 'nginx is not running')
        return
      }
      this.emitStep(serverId, streamId, 'nginx-running', 'ok')

      this.emitStep(serverId, streamId, 'nginx-config-valid', 'running')
      const validation = await nginxService.validate(serverId)
      capturedOutput = validation.output
      this.emitOutput(serverId, streamId, validation.output)
      if (validation.state !== 'valid') {
        fail('nginx-config-valid', 'nginx configuration is invalid', validation.output)
        return
      }
      this.emitStep(serverId, streamId, 'nginx-config-valid', 'ok')

      this.emitStep(serverId, streamId, 'site-detected', 'running')
      const configRoot = nginxStatus.paths.configRoot
      if (!configRoot || !isInsideDirectory(configRoot, options.configPath)) {
        fail('site-detected', 'The selected nginx site is outside the config root')
        return
      }
      const cache = await this.runDiscovery(serverId, true)
      const site = cache.serverBlocks.find((block) => block.configPath === options.configPath)
      if (!site) {
        fail('site-detected', 'Could not find the selected nginx site in the active configuration')
        return
      }
      this.emitStep(serverId, streamId, 'site-detected', 'ok', options.configPath)

      this.emitStep(serverId, streamId, 'domain-configured', 'running')
      const domainMatches = site.serverNames.includes(options.domain)
      if (!domainMatches) {
        fail(
          'domain-configured',
          `server_name in ${options.configPath} does not include ${options.domain}`
        )
        return
      }
      this.emitStep(serverId, streamId, 'domain-configured', 'ok')

      this.emitStep(serverId, streamId, 'ports-reachable', 'running')
      const ssResult = await this.exec(serverId, 'ss -ltn 2>/dev/null')
      const listeners = parseSsOutput(ssResult.stdout)
      const port80 = listeners.some((listener) => listener.port === 80)
      const port443 = listeners.some((listener) => listener.port === 443)
      let portsWarning: string | null = null
      if (!port80 || !port443) {
        portsWarning = `Ports may not be listening locally (80: ${port80 ? 'yes' : 'no'}, 443: ${port443 ? 'yes' : 'no'}). External firewalls cannot be verified from inside the server.`
      } else {
        try {
          const portsSnapshot = await portService.list(serverId)
          const listener80 = portsSnapshot.listeners.find(
            (listener) => listener.port === 80 && listener.protocol === 'tcp'
          )
          const listener443 = portsSnapshot.listeners.find(
            (listener) => listener.port === 443 && listener.protocol === 'tcp'
          )
          if (listener80?.firewall === 'blocked' || listener443?.firewall === 'blocked') {
            portsWarning = 'UFW may be blocking HTTP or HTTPS traffic.'
          }
        } catch {
          // Port firewall inspection is best-effort.
        }
      }
      this.emitStep(
        serverId,
        streamId,
        'ports-reachable',
        portsWarning ? 'warning' : 'ok',
        portsWarning ?? undefined
      )

      this.emitStep(serverId, streamId, 'certbot-available', 'running')
      const overview = (await this.runDiscovery(serverId, true)).overview
      if (!overview.certbot.installed) {
        fail('certbot-available', 'Certbot is not installed')
        return
      }
      if (!overview.certbot.nginxPluginAvailable) {
        fail('certbot-available', 'The certbot nginx plugin is not available')
        return
      }
      this.emitStep(serverId, streamId, 'certbot-available', 'ok')

      this.emitStep(serverId, streamId, 'config-backed-up', 'running')
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      backupPath = `${options.configPath}.zvia-backup-${timestamp}`
      const backupCommand = await this.elevate(
        serverId,
        `cp -a -- ${shellQuote(options.configPath)} ${shellQuote(backupPath)}`
      )
      const backupResult = await this.exec(serverId, `${backupCommand} 2>&1`)
      if (backupResult.exitCode !== 0) {
        fail('config-backed-up', 'Failed to back up the nginx site configuration', backupResult.stdout)
        return
      }
      this.emitStep(serverId, streamId, 'config-backed-up', 'ok', backupPath)

      if (isCancelled()) return

      this.emitStep(serverId, streamId, 'certificate-issued', 'running')
      const redirectFlag = options.redirect ? '--redirect' : '--no-redirect'
      const certbotCommand = await this.elevate(
        serverId,
        `certbot --nginx --non-interactive --agree-tos -m ${shellQuote(options.email)} -d ${shellQuote(options.domain)} --keep-until-expiring ${redirectFlag}`
      )

      const connection = this.getConnection(serverId)
      const client = await connection.getInteractiveClient()
      const channel = await execStreamOnClient(client, `${certbotCommand} 2>&1`)
      const workflow = this.workflowStreams.get(workflowStreamKey(serverId, streamId))
      if (workflow) workflow.channel = channel

      const certbotOutput = await new Promise<string>((resolve, reject) => {
        let output = ''
        channel.on('data', (data: Buffer) => {
          const chunk = data.toString('utf8')
          output += chunk
          this.emitOutput(serverId, streamId, chunk)
        })
        channel.stderr.on('data', (data: Buffer) => {
          const chunk = data.toString('utf8')
          output += chunk
          this.emitOutput(serverId, streamId, chunk)
        })
        channel.on('close', (code?: number) => {
          if (code && code !== 0) {
            reject(new CommandError('Certbot failed to issue the certificate', output.trim()))
            return
          }
          resolve(output)
        })
        channel.on('error', (error: Error) => reject(error))
      }).catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        fail('certificate-issued', message, capturedOutput)
        return null
      })

      if (!certbotOutput) return
      capturedOutput = certbotOutput
      this.emitStep(serverId, streamId, 'certificate-issued', 'ok')

      if (isCancelled()) return

      this.emitStep(serverId, streamId, 'certificate-verified', 'running')
      this.detectionCache.delete(serverId)
      const refreshed = await this.runDiscovery(serverId, true)
      const issuedCert =
        refreshed.overview.certificates.find((cert) => cert.domains.includes(options.domain)) ??
        refreshed.overview.certificates.find((cert) => cert.primaryDomain === options.domain)
      if (!issuedCert || issuedCert.status === 'unknown') {
        fail(
          'certificate-verified',
          issuedCert?.inspectionError ?? 'Could not verify the issued certificate',
          capturedOutput
        )
        return
      }
      this.emitStep(serverId, streamId, 'certificate-verified', 'ok')

      this.emitStep(serverId, streamId, 'nginx-revalidated', 'running')
      const postValidation = await nginxService.validate(serverId)
      this.emitOutput(serverId, streamId, postValidation.output)
      if (postValidation.state !== 'valid') {
        fail(
          'nginx-revalidated',
          `nginx configuration is invalid after certbot changes. Restore from ${backupPath}`,
          postValidation.output
        )
        return
      }
      this.emitStep(serverId, streamId, 'nginx-revalidated', 'ok')

      this.emitStep(serverId, streamId, 'nginx-reloaded', 'running')
      await nginxService.runAction(serverId, 'reload')
      this.emitStep(serverId, streamId, 'nginx-reloaded', 'ok')

      this.emitStep(serverId, streamId, 'https-responding', 'running')
      const https = await this.verifyHttps(serverId, options.domain)
      const httpsMessage = `Local: ${https.localResolve.httpCode ?? 'unreachable'} · Public: ${https.public.httpCode ?? 'unreachable'}`
      this.emitStep(
        serverId,
        streamId,
        'https-responding',
        https.localResolve.responding ? 'ok' : 'warning',
        httpsMessage
      )

      this.emitStep(serverId, streamId, 'auto-renewal-detected', 'running')
      const finalOverview = await this.runDiscovery(serverId, true)
      const renewal = finalOverview.overview.autoRenewal
      this.emitStep(
        serverId,
        streamId,
        'auto-renewal-detected',
        renewal.configured ? 'ok' : 'warning',
        renewal.configured ? renewal.detail ?? undefined : 'Auto-renewal is not configured yet'
      )

      this.sendWorkflowDone({ serverId, streamId, success: true, backupPath })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.sendWorkflowDone({
        serverId,
        streamId,
        success: false,
        output: message,
        backupPath
      })
    }
  }

  stopAllForServer(serverId: ServerId): void {
    for (const [key, stream] of this.workflowStreams) {
      if (stream.serverId !== serverId) continue
      stream.cancelled = true
      stream.channel?.close()
      this.workflowStreams.delete(key)
    }
    this.detectionCache.delete(serverId)
  }
}

export const sslService = new SSLService()
connectionManager.registerTeardown((serverId) => sslService.stopAllForServer(serverId))
