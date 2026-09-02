export interface DockerContainer {
  id: string
  name: string
  status: string
  state: string
  image: string
  ports: string
  uptime: string
  cpuPercent: string
  memoryUsage: string
  memoryPercent: string
  /** Comma-joined `key=value` labels from `docker ps`, e.g. `com.docker.compose.project=myapp,role=api`. Empty when none. */
  labels: string
  /** Comma-joined Docker network names the container is attached to. Empty when none. */
  networks: string
}

export const COMPOSE_PROJECT_LABEL = 'com.docker.compose.project'
export const COMPOSE_SERVICE_LABEL = 'com.docker.compose.service'

/**
 * Parses a `docker ps` labels string (comma-joined `key=value` pairs) into a
 * record. Values are restored verbatim, so commas inside quoted values are
 * preserved only by a best-effort split; Zvia only relies on the compose labels,
 * which never contain commas.
 */
export function parseContainerLabels(labels: string): Record<string, string> {
  const result: Record<string, string> = {}
  if (!labels) return result
  for (const part of labels.split(',')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const key = part.slice(0, eq).trim()
    const value = part.slice(eq + 1).trim()
    if (key) result[key] = value
  }
  return result
}

export function composeProjectOf(container: DockerContainer): string | null {
  return parseContainerLabels(container.labels)[COMPOSE_PROJECT_LABEL] ?? null
}

/**
 * Extracts the published host ports from a `docker ps` port string such as
 * `0.0.0.0:8080->80/tcp, [::]:8080->80/tcp`. Exposed-but-unpublished ports
 * (`80/tcp`) have no host port and are omitted. Docker prints one row per
 * address family, so duplicates are collapsed.
 */
export function parsePublishedHostPorts(ports: string): number[] {
  const found: number[] = []
  const seen = new Set<number>()

  for (const match of ports.matchAll(/:(\d+)(?:-\d+)?->/g)) {
    const port = Number.parseInt(match[1], 10)
    if (!Number.isInteger(port) || port < 1 || port > 65535) continue
    if (seen.has(port)) continue
    seen.add(port)
    found.push(port)
  }

  return found
}

export interface DockerImage {
  id: string
  repository: string
  tag: string
  size: string
  created: string
}

export interface DockerVolume {
  name: string
  driver: string
  mountpoint: string
}

export interface DockerNetwork {
  id: string
  name: string
  driver: string
  scope: string
  containers: string
}
