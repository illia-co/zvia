import type { DockerContainer } from '@shared/docker'
import type { PortListener } from '@shared/ports'
import type { ProcessDetail } from '@shared/processes'
import type { SslCertificate } from '@shared/ssl'
import type { SystemdUnit } from '@shared/systemd'
import type { HealthStatus, TopologyEntity } from '@shared/topology'
import type { NginxServerBlock } from './types'
import {
  containerEntityId,
  domainEntityId,
  fileEntityId,
  nginxSiteEntityId,
  portEntityId,
  processEntityId,
  sslCertEntityId,
  unitEntityId
} from '@shared/topology'

export interface CollectorData {
  serverBlocks: NginxServerBlock[]
  certificates: SslCertificate[]
  listeners: PortListener[]
  units: SystemdUnit[]
  containers: DockerContainer[]
  processes: Map<number, ProcessDetail>
  nginxRunning: boolean
}

function entity(
  id: string,
  kind: TopologyEntity['kind'],
  label: string,
  status: HealthStatus = 'unknown',
  navigate?: TopologyEntity['navigate'],
  sourceRef?: TopologyEntity['sourceRef']
): TopologyEntity {
  return { id, kind, label, status, navigate, sourceRef }
}

function sslHealth(cert: SslCertificate): HealthStatus {
  if (cert.status === 'expired' || cert.status === 'renewal-failed') return 'failed'
  if (cert.status === 'expiring-soon') return 'degraded'
  if (cert.status === 'valid') return 'healthy'
  return 'unknown'
}

function unitHealth(unit: SystemdUnit): HealthStatus {
  if (unit.activeState === 'failed') return 'failed'
  if (unit.activeState === 'activating' || unit.activeState === 'deactivating') return 'degraded'
  if (unit.activeState === 'active') return 'healthy'
  return 'unknown'
}

function containerHealth(container: DockerContainer): HealthStatus {
  if (container.state === 'exited') return 'failed'
  if (container.state === 'restarting') return 'degraded'
  if (container.state === 'running') return 'healthy'
  return 'unknown'
}

function nginxSiteLabel(block: NginxServerBlock): string {
  const names = block.serverNames
  if (names.length === 0) return block.configPath
  if (names.length === 1) return names[0]
  if (names.length === 2) return names.join(', ')
  return `${names[0]} (+${names.length - 1})`
}

export function normalizeEntities(data: CollectorData): Record<string, TopologyEntity> {
  const entities: Record<string, TopologyEntity> = {}
  const seenDomains = new Set<string>()

  for (const block of data.serverBlocks) {
    const siteId = nginxSiteEntityId(block.configPath, block.startLineNumber)
    entities[siteId] = entity(
      siteId,
      'nginx_site',
      nginxSiteLabel(block),
      data.nginxRunning ? 'healthy' : 'degraded',
      { tool: 'nginx', configPath: block.configPath },
      { configPath: block.configPath, startLineNumber: block.startLineNumber }
    )

    for (const name of block.serverNames) {
      const normalized = name.toLowerCase()
      if (seenDomains.has(normalized)) continue
      seenDomains.add(normalized)
      const id = domainEntityId(name)
      entities[id] = entity(id, 'domain', name, 'healthy', {
        tool: 'ssl',
        domain: name
      })
    }
  }

  for (const cert of data.certificates) {
    const id = sslCertEntityId(cert.id)
    entities[id] = entity(
      id,
      'ssl_certificate',
      cert.primaryDomain,
      sslHealth(cert),
      { tool: 'ssl', domain: cert.primaryDomain },
      { certificatePath: cert.certificatePath }
    )
  }

  for (const listener of data.listeners) {
    const id = portEntityId(listener.protocol, listener.address, listener.port)
    entities[id] = entity(
      id,
      'port',
      `:${listener.port}`,
      listener.pid !== null ? 'healthy' : 'unknown',
      { tool: 'ports', port: listener.port },
      {
        protocol: listener.protocol,
        address: listener.address,
        port: listener.port
      }
    )
  }

  for (const unit of data.units) {
    const id = unitEntityId(unit.unit)
    entities[id] = entity(
      id,
      'systemd_unit',
      unit.unit,
      unitHealth(unit),
      { tool: 'services', unit: unit.unit },
      { activeState: unit.activeState }
    )
  }

  for (const container of data.containers) {
    const id = containerEntityId(container.id)
    entities[id] = entity(
      id,
      'docker_container',
      container.name,
      containerHealth(container),
      { tool: 'docker', containerId: container.id },
      { state: container.state }
    )
  }

  for (const [pid, process] of data.processes) {
    const id = processEntityId(pid)
    const runtime = process.comm || process.args.split(/\s+/)[0] || 'process'
    entities[id] = entity(
      id,
      'process',
      `${runtime} (${pid})`,
      'healthy',
      { tool: 'processes', pid },
      { pid, comm: process.comm }
    )
  }

  for (const block of data.serverBlocks) {
    for (const location of block.locations) {
      const staticPath = location.root?.value ?? location.alias?.value
      if (!staticPath) continue
      const id = fileEntityId(staticPath)
      if (entities[id]) continue
      entities[id] = entity(id, 'file_path', staticPath, 'unknown', {
        tool: 'files',
        path: staticPath
      })
    }
  }

  return entities
}
