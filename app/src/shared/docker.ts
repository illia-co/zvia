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
