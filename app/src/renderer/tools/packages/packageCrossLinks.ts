import type { ServerId } from '@shared/server'
import type { ToolIntent } from '@renderer/state/navigationStore'

const NGINX_PACKAGES = new Set(['nginx', 'nginx-common', 'nginx-full', 'nginx-core', 'nginx-extras'])

const DOCKER_PACKAGES = new Set([
  'docker.io',
  'docker-ce',
  'docker-ce-cli',
  'docker-ce-rootless-extras',
  'containerd.io'
])

const WEB_SERVER_PACKAGES = new Set([
  'nginx',
  'nginx-common',
  'nginx-full',
  'apache2',
  'lighttpd',
  'caddy'
])

const PACKAGE_SERVICE_UNITS: Record<string, string> = {
  nginx: 'nginx.service',
  'nginx-common': 'nginx.service',
  'nginx-full': 'nginx.service',
  apache2: 'apache2.service',
  'mysql-server': 'mysql.service',
  'mariadb-server': 'mariadb.service',
  postgresql: 'postgresql.service',
  'redis-server': 'redis-server.service',
  'openssh-server': 'ssh.service',
  ssh: 'ssh.service',
  'docker.io': 'docker.service',
  'docker-ce': 'docker.service',
  certbot: 'certbot.timer'
}

export interface PackageNavLink {
  label: string
  onClick: () => void
}

function normalizedPackageName(name: string): string {
  return name.trim().toLowerCase()
}

export function packageNavLinks(
  serverId: ServerId,
  packageName: string,
  openWithIntent: (serverId: ServerId, intent: ToolIntent) => void,
  openTool: (serverId: ServerId, tool: 'nginx' | 'docker') => void
): PackageNavLink[] {
  const name = normalizedPackageName(packageName)
  const links: PackageNavLink[] = []

  if (NGINX_PACKAGES.has(name)) {
    links.push({
      label: 'Open in Nginx',
      onClick: () => openTool(serverId, 'nginx')
    })
  }

  if (DOCKER_PACKAGES.has(name)) {
    links.push({
      label: 'Open in Docker',
      onClick: () => openTool(serverId, 'docker')
    })
  }

  const unit = PACKAGE_SERVICE_UNITS[name]
  if (unit) {
    links.push({
      label: 'Open in Services',
      onClick: () =>
        openWithIntent(serverId, {
          tool: 'services',
          unit,
          view: 'detail'
        })
    })
  }

  if (WEB_SERVER_PACKAGES.has(name)) {
    links.push(
      {
        label: 'Open port 80',
        onClick: () => openWithIntent(serverId, { tool: 'ports', port: 80 })
      },
      {
        label: 'Open port 443',
        onClick: () => openWithIntent(serverId, { tool: 'ports', port: 443 })
      }
    )
  }

  return links
}
