import type { ServerId } from '@shared/server'
import { ConnectionError } from '@shared/errors'
import { connectionManager } from '../../ssh/ConnectionManager'
import { privilegeService } from '../PrivilegeService'
import { portService } from '../PortService'
import { systemdService } from '../SystemdService'
import { dockerService } from '../DockerService'
import { sslService } from '../SSLService'
import { nginxService } from '../NginxService'
import { processService } from '../ProcessService'
import { parseNginxTopology } from './parsers'
import { parseContainerLabels } from '@shared/docker'
import { parsePublishedHostPorts } from '@shared/docker'
import type { CollectorData } from './normalizers'
import type { NginxServerBlock, NginxTopology } from './types'

export type TopologyCollectionResult = CollectorData & {
  nginxTopology: NginxTopology
  warnings: string[]
}

export interface TopologyCollector {
  collect(
    serverId: ServerId,
    onPhase?: (phase: string, message: string) => void
  ): Promise<TopologyCollectionResult>
}

const PHASE_MESSAGES: Record<string, string> = {
  nginx: 'Discovering nginx configuration…',
  ssl: 'Discovering SSL certificates…',
  ports: 'Discovering ports…',
  systemd: 'Discovering systemd services…',
  docker: 'Discovering Docker containers…',
  processes: 'Discovering processes…'
}

function extractVirtualHosts(text: string): string[] {
  const hosts = new Set<string>()
  for (const line of text.split('\n')) {
    const match = /^(?:VIRTUAL_HOST|LETSENCRYPT_HOST|TRAEFIK_[\w.]*HOST|CADDY_[\w.]*HOST)\s*[:=]\s*(.+)$/i.exec(
      line.trim().replace(/^export\s+/, '')
    )
    if (!match) continue
    for (const part of match[1].split(/[,\s;]+/)) {
      const host = part.trim().toLowerCase()
      if (!host || host === '_' || host === 'localhost' || host.includes('/') || host.includes(':')) {
        continue
      }
      if (/^[a-z0-9_.-]+\.[a-z]{2,}$/i.test(host) || /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) {
        hosts.add(host)
      }
    }
  }
  return [...hosts]
}

/**
 * Builds synthetic nginx server blocks from `docker inspect` label+env dumps
 * so domains appear in the graph when nginx -T is unreadable. Each block
 * proxies to the container's first published host port (or 80/443 fallback).
 */
function syntheticServerBlocksFromInspect(
  inspectOutput: string,
  containers: CollectorData['containers']
): NginxServerBlock[] {
  const blocks: NginxServerBlock[] = []
  const lines = inspectOutput.split('\n')
  let cursor = 0
  // docker inspect --format prints one leading line per container:
  // `<id> <labels>;|`, followed by env lines until the next id line.
  const containerByPrefix = new Map(
    containers.map((c) => [c.id.slice(0, 12), c] as const)
  )
  let currentId: string | null = null
  let currentText = ''
  const flush = (): void => {
    if (!currentId) return
    const container = containerByPrefix.get(currentId.slice(0, 12))
    const labelText = parseContainerLabels(container?.labels ?? '')
    const labelHosts = extractVirtualHosts(
      Object.entries(labelText)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n')
    )
    const envHosts = extractVirtualHosts(currentText)
    const names = [...new Set([...labelHosts, ...envHosts])]
    if (names.length > 0 && container) {
      const hostPorts = parsePublishedHostPorts(container.ports)
      const targetPort = hostPorts[0] ?? 80
      blocks.push({
        configPath: `docker:${container.name}`,
        startLineNumber: 1,
        serverNames: names,
        ports: [80, 443],
        listensHttps: false,
        sslCertificate: null,
        sslCertificateKey: null,
        listenDirectives: [],
        locations: [
          {
            match: '/',
            proxyPass: {
              scheme: 'http',
              host: '127.0.0.1',
              port: targetPort,
              upstreamName: null,
              unixSocket: null,
              directive: {
                directive: 'proxy_pass',
                value: `http://127.0.0.1:${targetPort}`,
                configPath: `docker:${container.name}`,
                lineNumber: 1,
                rawText: `proxy_pass http://127.0.0.1:${targetPort};`
              }
            },
            root: null,
            alias: null
          }
        ]
      })
    }
    currentId = null
    currentText = ''
  }
  for (const line of lines) {
    const idMatch = /^([a-f0-9]{12,64})\s/i.exec(line)
    if (idMatch) {
      flush()
      currentId = idMatch[1]
      currentText = `${line.slice(idMatch[0].length)}\n`
    } else if (currentId) {
      currentText += `${line}\n`
    }
    void cursor
  }
  flush()
  return blocks
}

export class ProductionTopologyCollector implements TopologyCollector {
  async collect(
    serverId: ServerId,
    onPhase?: (phase: string, message: string) => void
  ): Promise<TopologyCollectionResult> {
    const warnings: string[] = []
    const report = (phase: string): void => {
      onPhase?.(phase, PHASE_MESSAGES[phase] ?? phase)
    }

    if (!connectionManager.getConnection(serverId)) {
      throw new ConnectionError('Server is not connected')
    }

    report('nginx')

    let nginxTopology: NginxTopology = { serverBlocks: [], upstreams: [] }
    let nginxRunning = false

    try {
      const nginxStatus = await nginxService.getStatus(serverId)
      nginxRunning = nginxStatus.activeState === 'active'
      // getConfigDump tries elevated `nginx -T`, then a plain one, then an
      // SFTP-assembled dump — password-sudo users recover host nginx topology
      // without elevation when configs are world-readable.
      const { dump, source, failure } = await nginxService.getConfigDump(serverId)
      if (dump.includes('# configuration file')) {
        nginxTopology = parseNginxTopology(dump)
        if (nginxTopology.serverBlocks.length === 0) {
          warnings.push('nginx -T returned no server blocks')
        } else if (source === 'sftp') {
          warnings.push('nginx -T unreadable; topology assembled via SFTP config read')
        }
      } else if (failure === 'not-found') {
        warnings.push(
          'nginx binary not found on PATH for this SSH user (checked /usr/sbin/nginx). ' +
            'If nginx is installed, the Nginx tool will also report it as missing.'
        )
      } else {
        warnings.push('nginx -T did not return configuration output')
        if (failure === 'denied') {
          const ctx = await privilegeService.getContext(serverId).catch(() => null)
          const sudoKind = ctx?.sudoKind ?? 'none'
          if (sudoKind === 'password' || sudoKind === 'none') {
            warnings.push(
              'Nginx config is unreadable without elevation. The SSH user cannot sudo ' +
                'non-interactively, and the app never asks for a sudo password. For full ' +
                'topology, allow specific commands without a password on the server ' +
                '(visudo): <user> ALL=(root) NOPASSWD: /usr/sbin/nginx -T, /usr/bin/certbot ' +
                'certificates, /usr/bin/openssl x509 *, /bin/ls -1 /etc/letsencrypt/*, ' +
                '/bin/cat -- /etc/letsencrypt/renewal/*, ' +
                '/usr/bin/systemctl reload nginx, /usr/bin/systemctl restart nginx'
            )
          }
        }
      }
    } catch (error) {
      warnings.push(
        error instanceof Error
          ? `Nginx topology collection failed: ${error.message}`
          : 'Nginx topology collection failed'
      )
    }

    report('ssl')
    let certificates: CollectorData['certificates'] = []
    try {
      const overview = await sslService.getOverview(serverId)
      certificates = overview.certificates
    } catch {
      warnings.push('SSL certificate discovery failed')
    }

    report('ports')
    let listeners: CollectorData['listeners'] = []
    try {
      const ports = await portService.list(serverId)
      listeners = ports.listeners
    } catch {
      warnings.push('Port listener enumeration failed')
    }

    report('systemd')
    let units: CollectorData['units'] = []
    try {
      if (await systemdService.isAvailable(serverId)) {
        units = await systemdService.listUnits(serverId)
      }
    } catch {
      warnings.push('systemd unit listing failed')
    }

    report('docker')
    let containers: CollectorData['containers'] = []
    try {
      if (await dockerService.isAvailable(serverId)) {
        containers = await dockerService.listContainers(serverId, true)
      }
    } catch {
      warnings.push('Docker container listing failed')
    }

    // Fallback 1: host nginx -T empty but an nginx-like container exists.
    // Read its config via `docker exec <id> nginx -T` (best-effort, never throws).
    if (nginxTopology.serverBlocks.length === 0 && containers.length > 0) {
      const candidates = containers.filter(
        (c) =>
          c.state === 'running' &&
          /nginx|openresty|traefik|caddy|jwilder\/nginx-proxy/i.test(`${c.image} ${c.name}`)
      )
      for (const candidate of candidates.slice(0, 3)) {
        try {
          const shortId = candidate.id.slice(0, 12)
          const result = await connectionManager.exec(
            serverId,
            `docker exec ${shortId} nginx -T 2>&1`,
            20000
          )
          if (result.exitCode === 0 && result.stdout.trim()) {
            const parsed = parseNginxTopology(result.stdout)
            if (parsed.serverBlocks.length > 0) {
              nginxTopology = parsed
              warnings.push(
                `Host nginx config unreadable; using nginx config from container ${candidate.name}`
              )
              break
            }
          }
        } catch {
          // Best-effort per container.
        }
      }
    }

    // Fallback 2: synthesize domain hints from VIRTUAL_HOST / LETSENCRYPT_HOST
    // env and labels so host-nginx→docker apps still show domains even when
    // nginx -T is unreadable. Synthetic blocks proxy to the container's first
    // published host port so the domain deployment claims its containers.
    if (nginxTopology.serverBlocks.length === 0 && containers.length > 0) {
      try {
        const ids = containers
          .filter((c) => c.state === 'running')
          .slice(0, 20)
          .map((c) => c.id.slice(0, 12))
          .join(' ')
        if (ids) {
          const inspectResult = await connectionManager.exec(
            serverId,
            `docker inspect --format '{{.Id}} {{range $k,$v := .Config.Labels}}{{$k}}={{$v}};{{end}}|{{range .Config.Env}}{{println .}}{{end}}' ${ids} 2>/dev/null`,
            20000
          )
          if (inspectResult.exitCode === 0 && inspectResult.stdout.trim()) {
            const synthetic = syntheticServerBlocksFromInspect(
              inspectResult.stdout,
              containers
            )
            if (synthetic.length > 0) {
              nginxTopology = { serverBlocks: synthetic, upstreams: [] }
              warnings.push(
                'nginx -T unreadable; domains inferred from container VIRTUAL_HOST hints'
              )
            }
          }
        }
      } catch {
        // Best-effort; docker-only deployments still render.
      }
    }

    report('processes')
    const processes = new Map<number, import('@shared/processes').ProcessDetail>()
    const pids = new Set<number>()
    for (const listener of listeners) {
      if (listener.pid !== null) pids.add(listener.pid)
    }
    for (const pid of pids) {
      try {
        processes.set(pid, await processService.get(serverId, pid))
      } catch {
        // Process may have exited between ss and ps
      }
    }

    return {
      serverBlocks: nginxTopology.serverBlocks,
      certificates,
      listeners,
      units,
      containers,
      processes,
      nginxRunning,
      nginxTopology,
      warnings
    }
  }
}

export const productionTopologyCollector = new ProductionTopologyCollector()
