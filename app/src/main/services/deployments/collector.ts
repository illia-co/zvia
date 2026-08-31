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
import type { CollectorData } from './normalizers'
import type { NginxTopology } from './types'

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
      const ctx = await privilegeService.getContext(serverId)
      const command = privilegeService.buildPrivileged(ctx, 'nginx -T')
      const result = await connectionManager.exec(serverId, `${command} 2>/dev/null`, 45000)
      if (result.exitCode === 0 && result.stdout.trim()) {
        nginxTopology = parseNginxTopology(result.stdout)
      } else {
        warnings.push('nginx -T did not return configuration output')
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
