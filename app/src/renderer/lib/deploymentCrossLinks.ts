import type { ServerId } from '@shared/server'
import type { ToolIntent } from '@renderer/state/navigationStore'
import type { DeploymentLookupMatch } from '@renderer/lib/topologyLookup'

export interface DeploymentNavLink {
  label: string
  onClick: () => void
}

export function deploymentNavLink(
  serverId: ServerId,
  match: DeploymentLookupMatch,
  openWithIntent: (serverId: ServerId, intent: ToolIntent) => void,
  label = 'View in Deployments'
): DeploymentNavLink {
  return {
    label,
    onClick: () =>
      openWithIntent(serverId, {
        tool: 'deployments',
        deploymentId: match.deploymentId,
        entityId: match.entityId
      })
  }
}

export async function lookupDeploymentByPort(
  serverId: ServerId,
  port: number
): Promise<DeploymentLookupMatch | null> {
  return window.zvia.deployments.lookup({ serverId, kind: 'port', port })
}

export async function lookupDeploymentByContainer(
  serverId: ServerId,
  containerId: string
): Promise<DeploymentLookupMatch | null> {
  return window.zvia.deployments.lookup({ serverId, kind: 'container', containerId })
}

export async function lookupDeploymentByDomain(
  serverId: ServerId,
  domain: string
): Promise<DeploymentLookupMatch | null> {
  return window.zvia.deployments.lookup({ serverId, kind: 'domain', domain })
}

export async function lookupDeploymentByNginxSite(
  serverId: ServerId,
  configPath: string,
  startLineNumber: number
): Promise<DeploymentLookupMatch | null> {
  return window.zvia.deployments.lookup({
    serverId,
    kind: 'nginxSite',
    configPath,
    startLineNumber
  })
}
