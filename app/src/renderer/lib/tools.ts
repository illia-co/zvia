export type ToolId =
  | 'overview'
  | 'stats'
  | 'logs'
  | 'terminal'
  | 'files'
  | 'docker'
  | 'ports'
  | 'nginx'
  | 'ssl'
  | 'services'
  | 'cron'
  | 'users'
  | 'processes'
  | 'packages'
  | 'deployments'

export interface ToolDefinition {
  id: ToolId
  label: string
  section?: string
}

/** Opens automatically when connecting to a server with no workspace panels. */
export const DEFAULT_TOOL: ToolId = 'deployments'

/** Bound to ⌘0 / Ctrl+0 — kept on Docker regardless of sidebar order. */
export const KEYBOARD_ZERO_TOOL: ToolId = 'docker'

export const TOOLS: ToolDefinition[] = [
  { id: 'deployments', label: 'Deployments', section: 'Applications' },
  { id: 'overview', label: 'Overview', section: 'General' },
  { id: 'stats', label: 'Stats', section: 'System' },
  { id: 'users', label: 'Users', section: 'System' },
  { id: 'processes', label: 'Processes', section: 'System' },
  { id: 'packages', label: 'Packages', section: 'System' },
  { id: 'logs', label: 'Logs', section: 'System' },
  { id: 'terminal', label: 'Terminal', section: 'Workspace' },
  { id: 'files', label: 'Files', section: 'Workspace' },
  { id: 'docker', label: 'Docker', section: 'Containers' },
  { id: 'ports', label: 'Ports', section: 'Network' },
  { id: 'nginx', label: 'Nginx', section: 'Network' },
  { id: 'ssl', label: 'SSL', section: 'Network' },
  { id: 'services', label: 'Services', section: 'Daemons' },
  { id: 'cron', label: 'Cron', section: 'Daemons' }
]

export function getToolLabel(toolId: ToolId): string {
  return TOOLS.find((tool) => tool.id === toolId)?.label ?? toolId
}
