import type { EntityKind, TopologyChange } from '@shared/topology'

const CHANGE_KIND_LABELS: Partial<Record<EntityKind, string>> = {
  ssl_certificate: 'SSL',
  nginx_site: 'Nginx config',
  port: 'Port',
  process: 'Process',
  systemd_unit: 'Service',
  docker_container: 'Container',
  docker_compose_service: 'Compose',
  file_path: 'Files',
  domain: 'Domain',
  deployment: 'Deployment'
}

export function summarizeChanges(changes: TopologyChange[]): string {
  if (changes.length === 0) return 'No changes'
  const labels: string[] = []
  const seen = new Set<string>()
  for (const change of changes) {
    const label = change.kindLabel
      ? (CHANGE_KIND_LABELS[change.kindLabel] ?? change.kindLabel)
      : (change.label ?? change.entityId)
    if (seen.has(label)) continue
    seen.add(label)
    labels.push(label)
  }
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return labels.join(', ')
  return `${changes.length} changes`
}
