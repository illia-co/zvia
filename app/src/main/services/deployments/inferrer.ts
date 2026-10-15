import type { DockerContainer } from '@shared/docker'
import { parsePublishedHostPorts, parseContainerLabels, COMPOSE_PROJECT_LABEL, COMPOSE_SERVICE_LABEL } from '@shared/docker'
import type { PortListener } from '@shared/ports'
import type {
  Evidence,
  Relationship,
  TopologyEntity
} from '@shared/topology'
import type { NginxServerBlock, NginxTopology } from './types'
import {
  domainEntityId,
  nginxSiteEntityId,
  portEntityId,
  processEntityId,
  sslCertEntityId,
  unitEntityId,
  containerEntityId,
  fileEntityId,
  composeServiceEntityId
} from '@shared/topology'
import type { SslCertificate } from '@shared/ssl'
import { primaryProxyTarget, primaryStaticRoot } from './parsers'

export interface InferrerInput {
  topology: NginxTopology
  certificates: SslCertificate[]
  listeners: PortListener[]
  containers: DockerContainer[]
  entities: Record<string, TopologyEntity>
}

function parseContainerTargetPorts(ports: string): number[] {
  const found: number[] = []
  const seen = new Set<number>()
  for (const match of ports.matchAll(/->(\d+)\/tcp/g)) {
    const port = Number.parseInt(match[1], 10)
    if (!Number.isInteger(port) || port < 1 || port > 65535 || seen.has(port)) continue
    seen.add(port)
    found.push(port)
  }
  return found
}

function containerNameHints(container: DockerContainer): string[] {
  const hints = new Set<string>()
  const name = container.name.toLowerCase()
  if (name) {
    hints.add(name)
    // Compose names like `project-service-1` also match bare service name.
    const parts = name.split('-')
    if (parts.length >= 3) hints.add(parts.slice(1, -1).join('-'))
    if (parts.length >= 2) hints.add(parts.slice(1).join('-'))
  }
  const labels = parseContainerLabels(container.labels)
  const service = labels[COMPOSE_SERVICE_LABEL]?.toLowerCase()
  if (service) hints.add(service)
  return [...hints]
}

function findContainersForProxyTarget(
  containers: DockerContainer[],
  host: string | null,
  port: number | null
): DockerContainer[] {
  const normalizedHost = host?.toLowerCase() ?? null
  const isLocalHost =
    !normalizedHost ||
    normalizedHost === '127.0.0.1' ||
    normalizedHost === 'localhost' ||
    normalizedHost === '0.0.0.0'
  return containers.filter((container) => {
    if (container.state !== 'running') return false
    const hostPorts = parsePublishedHostPorts(container.ports)
    const targetPorts = parseContainerTargetPorts(container.ports)
    const portMatches =
      port === null || hostPorts.includes(port) || targetPorts.includes(port)
    if (!portMatches) return false
    if (isLocalHost) return true
    // Docker-network service names (compose service, container name) resolve
    // inside the docker network, not via host listeners.
    return containerNameHints(container).some(
      (hint) => hint === normalizedHost || normalizedHost?.endsWith(`.${hint}`)
    )
  })
}

function createRelationshipId(rel: Omit<Relationship, 'id'>): string {
  return `rel:${rel.type}:${rel.from.id}:${rel.to.id}`
}

function pushRelationship(relationships: Relationship[], rel: Omit<Relationship, 'id'>): void {
  relationships.push({ ...rel, id: createRelationshipId(rel) })
}

function evidenceFromDirective(
  source: string,
  directive: { rawText: string; configPath: string; lineNumber: number; directive: string; value: string },
  detail: string,
  observedAt: string
): Evidence {
  return {
    source,
    kind: 'directive',
    detail,
    raw: directive.rawText,
    location: `${directive.configPath}, line ${directive.lineNumber}`,
    observedAt
  }
}

function evidenceFromListener(listener: PortListener, observedAt: string): Evidence {
  return {
    source: 'ss',
    kind: 'command_output',
    detail: `${listener.address}:${listener.port} — LISTEN (${listener.process || 'unknown'})`,
    raw: `${listener.protocol} ${listener.address}:${listener.port} pid=${listener.pid ?? '?'}`,
    observedAt
  }
}

function findListenersForPort(
  listeners: PortListener[],
  port: number,
  host?: string | null
): PortListener[] {
  return listeners.filter((listener) => {
    if (listener.port !== port) return false
    if (!host || host === '127.0.0.1' || host === 'localhost') {
      return (
        listener.address === '127.0.0.1' ||
        listener.address === '::1' ||
        listener.address === '::' ||
        listener.address === '0.0.0.0' ||
        listener.address === '*'
      )
    }
    return (
      listener.address === host ||
      listener.address === '0.0.0.0' ||
      listener.address === '::' ||
      listener.address === '*'
    )
  })
}

function ensurePortEntity(
  entities: Record<string, TopologyEntity>,
  port: number,
  host: string | null | undefined,
  portListener: PortListener | undefined
): string {
  const portId = portListener
    ? portEntityId(portListener.protocol, portListener.address, portListener.port)
    : portEntityId('tcp', host ?? '127.0.0.1', port)

  if (!entities[portId]) {
    entities[portId] = {
      id: portId,
      kind: 'port',
      label: `:${port}`,
      status: portListener ? 'healthy' : 'failed',
      navigate: { tool: 'ports', port },
      sourceRef: {
        protocol: portListener?.protocol ?? 'tcp',
        address: portListener?.address ?? (host ?? '127.0.0.1'),
        port
      }
    }
  }

  return portId
}

function findPortEntityForHostPort(
  hostPort: number,
  entities: Record<string, TopologyEntity>
): string | null {
  for (const entity of Object.values(entities)) {
    if (entity.kind !== 'port' || entity.sourceRef?.port !== hostPort) continue
    const addr = entity.sourceRef.address
    if (
      addr === '127.0.0.1' ||
      addr === '::1' ||
      addr === '::' ||
      addr === '0.0.0.0' ||
      addr === '*'
    ) {
      return entity.id
    }
  }

  for (const entity of Object.values(entities)) {
    if (entity.kind === 'port' && entity.sourceRef?.port === hostPort) {
      return entity.id
    }
  }

  return null
}

function ensureUnixSocketEntity(
  entities: Record<string, TopologyEntity>,
  socketPath: string
): string {
  const id = `unix:${socketPath}`
  if (!entities[id]) {
    entities[id] = {
      id,
      kind: 'runtime',
      label: socketPath,
      status: 'unknown',
      navigate: socketPath.startsWith('/') ? { tool: 'files', path: socketPath } : undefined
    }
  }
  return id
}

function findSslCertForBlock(block: NginxServerBlock, certificates: SslCertificate[]): SslCertificate | null {
  if (!block.sslCertificate) return null
  const blockDir = /^\/etc\/letsencrypt\/live\/([^/]+)\//.exec(block.sslCertificate)?.[1]
  const byPath =
    certificates.find((cert) => {
      if (cert.certificatePath === block.sslCertificate) return true
      // cert.pem / fullchain.pem / chain.pem in the same live dir are the same cert.
      const certDir = /^\/etc\/letsencrypt\/live\/([^/]+)\//.exec(cert.certificatePath)?.[1]
      if (blockDir && certDir && blockDir === certDir) {
        const base = (p: string): string => p.slice(p.lastIndexOf('/') + 1)
        const pems = new Set(['cert.pem', 'fullchain.pem', 'chain.pem'])
        if (pems.has(base(cert.certificatePath)) && pems.has(base(block.sslCertificate as string))) {
          return true
        }
      }
      return (
        cert.certificatePath.replace(/\/fullchain\.pem$/, '') ===
        block.sslCertificate?.replace(/\/fullchain\.pem$/, '')
      )
    }) ?? null
  if (byPath) return byPath
  // Copied certs (nginx serves a copy outside /etc/letsencrypt): link a TLS
  // block to the cert covering one of its server names.
  // ponytail: path match stays first; domain overlap is fallback only.
  if (!block.listensHttps || block.serverNames.length === 0) return null
  const names = new Set(block.serverNames.map((name) => name.toLowerCase()))
  return (
    certificates.find((cert) =>
      cert.domains.some((domain) => names.has(domain.toLowerCase()))
    ) ?? null
  )
}

function siteForDomain(
  domain: string,
  serverBlocks: NginxServerBlock[]
): { block: NginxServerBlock; siteId: string } | null {
  for (const block of serverBlocks) {
    if (block.serverNames.some((name) => name.toLowerCase() === domain.toLowerCase())) {
      return { block, siteId: nginxSiteEntityId(block.configPath, block.startLineNumber) }
    }
  }
  return null
}

export function inferRelationships(input: InferrerInput, observedAt: string): Relationship[] {
  const relationships: Relationship[] = []
  const { topology, certificates, listeners, containers, entities } = input
  const { serverBlocks, upstreams } = topology

  for (const block of serverBlocks) {
    const siteId = nginxSiteEntityId(block.configPath, block.startLineNumber)

    for (const name of block.serverNames) {
      const domainId = domainEntityId(name)
      if (!entities[domainId] || !entities[siteId]) continue
      pushRelationship(relationships, {
        from: { kind: 'domain', id: domainId },
        to: { kind: 'nginx_site', id: siteId },
        type: 'serves',
        confidence: 'confirmed',
        evidence: [
          {
            source: 'nginx-T',
            kind: 'directive',
            detail: `server_name includes ${name}`,
            raw: `server_name ${block.serverNames.join(' ')};`,
            location: block.configPath,
            observedAt
          }
        ],
        label: 'server_name'
      })
    }

    const cert = findSslCertForBlock(block, certificates)
    if (cert && entities[siteId]) {
      const certId = sslCertEntityId(cert.id)
      if (entities[certId]) {
pushRelationship(relationships, {
          from: { kind: 'nginx_site', id: siteId },
          to: { kind: 'ssl_certificate', id: certId },
          type: 'terminates_tls',
          confidence: 'confirmed',
          evidence: block.sslCertificate
            ? [
                evidenceFromDirective(
                  'nginx-T',
                  {
                    directive: 'ssl_certificate',
                    value: block.sslCertificate,
                    configPath: block.configPath,
                    lineNumber: 0,
                    rawText: `ssl_certificate ${block.sslCertificate};`
                  },
                  'SSL certificate path matches discovered certificate',
                  observedAt
                )
              ]
            : [],
          label: 'ssl_certificate'
        })
      }
    }

    for (const listen of block.listenDirectives) {
      const matching = findListenersForPort(listeners, parseListenPort(listen.value))
      const portId = matching[0]
        ? portEntityId(matching[0].protocol, matching[0].address, matching[0].port)
        : portEntityId('tcp', '*', parseListenPort(listen.value))
      if (!entities[portId]) continue
      pushRelationship(relationships, {
        from: { kind: 'nginx_site', id: siteId },
        to: { kind: 'port', id: portId },
        type: 'listens_on',
        confidence: matching.length > 0 ? 'confirmed' : 'likely',
        evidence: [
          evidenceFromDirective(
            'nginx-T',
            listen,
            `Nginx listens on port ${parseListenPort(listen.value)}`,
            observedAt
          ),
          ...(matching[0] ? [evidenceFromListener(matching[0], observedAt)] : [])
        ],
        label: 'listen'
      })
    }

    const proxy = primaryProxyTarget(block, upstreams)
    if (proxy) {
      if (proxy.unixSocket) {
        const runtimeId = ensureUnixSocketEntity(entities, proxy.unixSocket)
        pushRelationship(relationships, {
          from: { kind: 'nginx_site', id: siteId },
          to: { kind: 'runtime', id: runtimeId },
          type: 'proxies_to',
          confidence: 'unknown',
          evidence: [
            evidenceFromDirective(
              'nginx-T',
              proxy.directive,
              `proxy_pass to Unix socket — port join not possible`,
              observedAt
            )
          ],
          label: 'proxy_pass'
        })
      } else if (proxy.port !== null) {
        const matching = findListenersForPort(listeners, proxy.port, proxy.host)
        const confidence =
          matching.length > 1 ? 'conflicting' : matching.length === 1 ? 'confirmed' : 'likely'
        const portListener = matching[0]
        const portId = ensurePortEntity(entities, proxy.port, proxy.host, portListener)
pushRelationship(relationships, {
          from: { kind: 'nginx_site', id: siteId },
          to: { kind: 'port', id: portId },
          type: 'proxies_to',
          confidence,
          evidence: [
            evidenceFromDirective(
              'nginx-T',
              proxy.directive,
              `proxy_pass to ${proxy.host ?? '127.0.0.1'}:${proxy.port}`,
              observedAt
            ),
            ...matching.map((listener) => evidenceFromListener(listener, observedAt))
          ],
          label: 'proxy_pass'
        })
        // Docker-network targets (compose service names, container-internal
        // ports) have no host listener. Link the site straight to matching
        // containers so the domain deployment claims them and the graph is
        // full when the app runs under Docker behind host nginx.
        for (const container of findContainersForProxyTarget(containers, proxy.host, proxy.port)) {
          const containerId = containerEntityId(container.id)
          if (!entities[containerId]) continue
          const already = relationships.some(
            (rel) => rel.from.id === siteId && rel.to.id === containerId && rel.type === 'proxies_to'
          )
          if (already) continue
          pushRelationship(relationships, {
            from: { kind: 'nginx_site', id: siteId },
            to: { kind: 'docker_container', id: containerId },
            type: 'proxies_to',
            confidence: matching.length > 0 ? 'confirmed' : 'likely',
            evidence: [
              evidenceFromDirective(
                'nginx-T',
                proxy.directive,
                `proxy_pass target matches container ${container.name}`,
                observedAt
              )
            ],
            label: 'proxy_pass'
          })
        }
      } else if (proxy.upstreamName || proxy.host) {
        // Named upstream / docker-service host without a port (e.g.
        // `proxy_pass http://app;`). Resolve by container/service name so the
        // graph still joins host nginx to its Docker backend.
        for (const container of findContainersForProxyTarget(containers, proxy.host ?? proxy.upstreamName, null)) {
          const containerId = containerEntityId(container.id)
          if (!entities[containerId]) continue
          pushRelationship(relationships, {
            from: { kind: 'nginx_site', id: siteId },
            to: { kind: 'docker_container', id: containerId },
            type: 'proxies_to',
            confidence: 'likely',
            evidence: [
              evidenceFromDirective(
                'nginx-T',
                proxy.directive,
                `proxy_pass target matches container ${container.name}`,
                observedAt
              )
            ],
            label: 'proxy_pass'
          })
        }
      }
    }

    const staticRoot = primaryStaticRoot(block)
    if (staticRoot) {
      const fileId = fileEntityId(staticRoot.value)
      if (entities[fileId]) {
pushRelationship(relationships, {
          from: { kind: 'nginx_site', id: siteId },
          to: { kind: 'file_path', id: fileId },
          type: 'serves_static',
          confidence: 'confirmed',
          evidence: [
            evidenceFromDirective(
              'nginx-T',
              staticRoot,
              `Static files at ${staticRoot.value}`,
              observedAt
            )
          ],
          label: staticRoot.directive
        })
      }
    }
  }

  for (const listener of listeners) {
    if (listener.pid === null) continue
    const portId = portEntityId(listener.protocol, listener.address, listener.port)
    const processId = processEntityId(listener.pid)
    if (!entities[portId] || !entities[processId]) continue
    pushRelationship(relationships, {
      from: { kind: 'port', id: portId },
      to: { kind: 'process', id: processId },
      type: 'bound_to',
      confidence: 'confirmed',
      evidence: [evidenceFromListener(listener, observedAt)],
      label: 'pid_match'
    })

    if (listener.unit) {
      const unitId = unitEntityId(listener.unit)
      if (entities[unitId]) {
pushRelationship(relationships, {
          from: { kind: 'process', id: processId },
          to: { kind: 'systemd_unit', id: unitId },
          type: 'managed_by',
          confidence: 'confirmed',
          evidence: [
            evidenceFromListener(listener, observedAt),
            {
              source: 'cgroup',
              kind: 'pid_match',
              detail: `PID ${listener.pid} attributed to ${listener.unit}`,
              observedAt
            }
          ],
          label: 'cgroup'
        })
      }
    }

    if (listener.containerId) {
      const containerId = containerEntityId(listener.containerId)
      if (entities[containerId]) {
pushRelationship(relationships, {
          from: { kind: 'port', id: portId },
          to: { kind: 'docker_container', id: containerId },
          type: 'published_by',
          confidence: 'confirmed',
          evidence: [evidenceFromListener(listener, observedAt)],
          label: 'docker_publish'
        })
      }
    }
  }

  for (const container of containers) {
    const containerId = containerEntityId(container.id)
    if (!entities[containerId]) continue

    const composeProject = container.labels
      ? parseContainerLabels(container.labels)[COMPOSE_PROJECT_LABEL]
      : undefined
    if (composeProject) {
      const composeId = composeServiceEntityId(composeProject)
      if (entities[composeId]) {
        pushRelationship(relationships, {
          from: { kind: 'docker_container', id: containerId },
          to: { kind: 'docker_compose_service', id: composeId },
          type: 'member_of',
          confidence: 'confirmed',
          evidence: [
            {
              source: 'docker-ps',
              kind: 'command_output',
              detail: `Container ${container.name} is part of compose project ${composeProject}`,
              raw: container.labels,
              observedAt
            }
          ],
          label: 'compose_project'
        })
      }
    }

    for (const hostPort of parsePublishedHostPorts(container.ports)) {
      const portId = findPortEntityForHostPort(hostPort, entities)
      if (!portId) continue

      const alreadyLinked = relationships.some(
        (rel) =>
          rel.type === 'published_by' && rel.from.id === portId && rel.to.id === containerId
      )
      if (alreadyLinked) continue

      pushRelationship(relationships, {
        from: { kind: 'port', id: portId },
        to: { kind: 'docker_container', id: containerId },
        type: 'published_by',
        confidence: container.state === 'running' ? 'confirmed' : 'likely',
        evidence: [
          {
            source: 'docker-ps',
            kind: 'command_output',
            detail: `Container ${container.name} publishes host port :${hostPort}`,
            raw: container.ports,
            observedAt
          }
        ],
        label: 'docker_publish'
      })
    }
  }

  return relationships
}

function parseListenPort(value: string): number {
  const portMatch = /:(\d{1,5})\b/.exec(value) ?? /^(\d{1,5})\b/.exec(value)
  if (!portMatch) return 80
  return Number.parseInt(portMatch[1], 10)
}

export { siteForDomain }
