import type { TopologyEntity } from '@shared/topology'
import type { ToolIntent } from '@renderer/state/navigationStore'
import { navigateHintToIntent } from './navigateHintToIntent'

export interface InspectorAction {
  label: string
  intent: ToolIntent
}

export function inspectorActions(entity: TopologyEntity): InspectorAction[] {
  if (entity.navigate) {
    const intent = navigateHintToIntent(entity.navigate)
    if (intent) {
      const label =
        entity.navigate.tool === 'files'
          ? 'Open in Files'
          : entity.navigate.tool === 'deployments'
            ? 'Open in Deployments'
            : 'Open in tool'
      return [{ label, intent }]
    }
  }

  const actions: InspectorAction[] = []

  switch (entity.kind) {
    case 'nginx_site': {
      const configPath = entity.sourceRef?.configPath
      if (typeof configPath === 'string') {
        actions.push({ label: 'Open config', intent: { tool: 'nginx', configPath } })
      }
      break
    }
    case 'systemd_unit':
      actions.push({ label: 'Open service', intent: { tool: 'services', unit: entity.label } })
      actions.push({
        label: 'View logs',
        intent: { tool: 'services', unit: entity.label, view: 'detail' }
      })
      break
    case 'docker_container': {
      const id = entity.navigate?.containerId ?? entity.sourceRef?.containerId
      if (typeof id === 'string') {
        actions.push({ label: 'Open container', intent: { tool: 'docker', containerId: id } })
      }
      break
    }
    case 'port': {
      const port = entity.sourceRef?.port
      if (typeof port === 'number') {
        actions.push({ label: 'Open port', intent: { tool: 'ports', port } })
      }
      break
    }
    case 'process': {
      const pid = entity.sourceRef?.pid
      if (typeof pid === 'number') {
        actions.push({ label: 'Open process', intent: { tool: 'processes', pid } })
      }
      break
    }
    case 'domain':
    case 'ssl_certificate':
      if (entity.navigate?.domain) {
        actions.push({ label: 'Open SSL', intent: { tool: 'ssl', domain: entity.navigate.domain } })
      }
      break
    case 'file_path':
      if (entity.navigate?.path) {
        actions.push({ label: 'Open in Files', intent: { tool: 'files', path: entity.navigate.path } })
      }
      break
    default:
      break
  }

  return actions
}
