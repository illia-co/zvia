import type { ServerId } from './server'

/** Cache TTL shared by TopologyService and the Deployments UI poll interval. */
export const TOPOLOGY_CACHE_TTL_MS = 60_000

export type EntityKind =
  | 'deployment'
  | 'domain'
  | 'nginx_site'
  | 'ssl_certificate'
  | 'port'
  | 'process'
  | 'systemd_unit'
  | 'docker_container'
  /** An autonomous docker compose project (com.docker.compose.project): the entrypoint for container-only deployments. */
  | 'docker_compose_service'
  | 'file_path'
  /** @phase2 Database entity kind — reserved for future discovery. */
  | 'database'
  | 'runtime'

export type Confidence = 'confirmed' | 'likely' | 'unknown' | 'conflicting'

export type HealthStatus = 'healthy' | 'degraded' | 'failed' | 'unknown' | 'discovering'

export type RelationshipType =
  | 'serves'
  | 'terminates_tls'
  | 'listens_on'
  | 'proxies_to'
  | 'serves_static'
  | 'bound_to'
  | 'managed_by'
  | 'published_by'
  | 'member_of'
export type EvidenceKind =
  | 'directive'
  | 'command_output'
  | 'file_path'
  | 'pid_match'
  | 'inference'

export interface EntityRef {
  kind: EntityKind
  id: string
}

export interface Evidence {
  source: string
  kind: EvidenceKind
  detail: string
  raw?: string
  location?: string
  observedAt: string
}

export interface Relationship {
  id: string
  from: EntityRef
  to: EntityRef
  type: RelationshipType
  confidence: Confidence
  evidence: Evidence[]
  label?: string
}

export interface DeploymentComponentStatus {
  ssl?: HealthStatus
  nginx?: HealthStatus
  backend?: HealthStatus
  service?: HealthStatus
  files?: HealthStatus
  container?: HealthStatus
}

export interface Deployment {
  id: string
  name: string
  health: HealthStatus
  entityIds: string[]
  entrypoints: EntityRef[]
  stackSummary: string
  componentStatus: DeploymentComponentStatus
}

export type TopologyInsightType =
  | 'shared_backend'
  /** @phase2 Shared upstream insight — reserved for compose/upstream grouping. */
  | 'shared_upstream'
  /** @phase2 Shared dependency insight — reserved for cross-deployment deps. */
  | 'shared_dependency'

export interface TopologyInsight {
  id: string
  type: TopologyInsightType
  deploymentIds: string[]
  label: string
  confidence: Confidence
  evidence: Evidence[]
  /** Port entity IDs that share this backend across deployments. */
  portEntityIds?: string[]
}

export interface TopologyNavigateHint {
  tool:
    | 'nginx'
    | 'ssl'
    | 'ports'
    | 'processes'
    | 'services'
    | 'docker'
    | 'files'
    | 'deployments'
  configPath?: string
  domain?: string
  port?: number
  pid?: number
  unit?: string
  containerId?: string
  path?: string
  deploymentId?: string
  entityId?: string
}

export interface TopologyEntity {
  id: string
  kind: EntityKind
  label: string
  status: HealthStatus
  sourceRef?: Record<string, string | number | boolean | null>
  navigate?: TopologyNavigateHint
}

export interface TopologySnapshot {
  serverId: ServerId
  scannedAt: string
  scanDurationMs: number
  entities: Record<string, TopologyEntity>
  relationships: Relationship[]
  deployments: Deployment[]
  insights: TopologyInsight[]
  warnings: string[]
}

export interface TopologyScanProgress {
  phase: string
  message: string
  counts?: Record<string, number>
}

export function domainEntityId(domain: string): string {
  return `domain:${domain.toLowerCase()}`
}

export function nginxSiteEntityId(configPath: string, startLineNumber: number): string {
  return `nginx:${configPath}:${startLineNumber}`
}

export function portEntityId(protocol: string, address: string, port: number): string {
  return `port:${protocol}:${address}:${port}`
}

export function processEntityId(pid: number): string {
  return `process:${pid}`
}

export function unitEntityId(unit: string): string {
  return `unit:${unit}`
}

export function containerEntityId(id: string): string {
  return `container:${id}`
}

export function composeServiceEntityId(project: string): string {
  return `compose:${project}`
}

export function sslCertEntityId(id: string): string {
  return `ssl:${id}`
}

export function fileEntityId(path: string): string {
  return `file:${path}`
}

export function deploymentEntityId(domain: string): string {
  return `deployment:${domain.toLowerCase()}`
}

export type TopologyChangeKind =
  | 'entity_added'
  | 'entity_removed'
  | 'entity_modified'
  | 'relationship_added'
  | 'relationship_removed'

export interface TopologyEntityState {
  status: HealthStatus
  sourceRef?: Record<string, string | number | boolean | null>
}

export interface TopologyChangeRelationship {
  type: RelationshipType
  from: string
  to: string
  confidence: Confidence
}

export interface TopologyChange {
  kind: TopologyChangeKind
  entityId: string
  kindLabel?: EntityKind
  label?: string
  before?: TopologyEntityState
  after?: TopologyEntityState
  relationship?: TopologyChangeRelationship
  /** IDs of deployments that contain this entity, resolved against the "after" snapshot. */
  deploymentIds: string[]
}
