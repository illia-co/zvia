import type { TopologyNavigateHint } from '@shared/topology'
import type { ToolIntent } from '@renderer/state/navigationStore'

export function navigateHintToIntent(hint: TopologyNavigateHint): ToolIntent | null {
  switch (hint.tool) {
    case 'nginx':
      return hint.configPath ? { tool: 'nginx', configPath: hint.configPath } : { tool: 'nginx' }
    case 'ssl':
      return hint.domain ? { tool: 'ssl', domain: hint.domain } : { tool: 'ssl' }
    case 'ports':
      return hint.port !== undefined ? { tool: 'ports', port: hint.port } : null
    case 'processes':
      return hint.pid !== undefined ? { tool: 'processes', pid: hint.pid } : null
    case 'services':
      return hint.unit
        ? { tool: 'services', unit: hint.unit, view: 'detail' }
        : null
    case 'docker':
      return hint.containerId ? { tool: 'docker', containerId: hint.containerId } : null
    case 'files':
      return hint.path ? { tool: 'files', path: hint.path } : null
    case 'deployments':
      return {
        tool: 'deployments',
        deploymentId: hint.deploymentId,
        entityId: hint.entityId
      }
    default:
      return null
  }
}
