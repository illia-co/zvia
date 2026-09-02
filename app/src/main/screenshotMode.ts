import type { BrowserWindow } from 'electron'
import type { IpcChannel } from '@shared/ipc'
import type { CronListResponse } from '@shared/cron'
import type { DockerContainer } from '@shared/docker'
import type { FilesListResponse } from '@shared/files'
import type { LogEntry } from '@shared/logs'
import type { NginxConfigTree, NginxStatus } from '@shared/nginx'
import type {
  InstalledPackage,
  PackageOverview,
  PackageUpdate,
  PaginatedResult
} from '@shared/packages'
import type { PortsSnapshot } from '@shared/ports'
import type { ProcessDetail, ProcessSummary } from '@shared/processes'
import type { ServerProfile } from '@shared/server'
import type { SslNginxLink, SslOverview } from '@shared/ssl'
import type { ServerStatsSnapshot, SystemInfo } from '@shared/stats'
import type { SystemdUnit } from '@shared/systemd'
import type {
  Deployment,
  Relationship,
  TopologyEntity,
  TopologySnapshot
} from '@shared/topology'
import type { UsersListResponse } from '@shared/users'
import type {
  DeploymentsDeploymentHistoryEntry,
  DeploymentsHistorySummary
} from '@shared/ipc'
import { diffTopologyForDeployment } from './services/deployments/diff'
import { summarizeChanges } from './services/deployments/summarize'

export const SCREENSHOT_SERVER_ID = 'production'

export const SCREENSHOT_PROFILE: ServerProfile = {
  id: SCREENSHOT_SERVER_ID,
  name: 'Production',
  hostname: 'production.example.com',
  username: 'ubuntu',
  port: 22,
  auth: { type: 'ssh-agent' }
}

const DEMO_CONTAINERS: DockerContainer[] = [
  {
    id: 'a1b2c3d4',
    name: 'zvia-api',
    status: 'Up 3 days',
    state: 'running',
    image: 'zvia/api:latest',
    ports: '0.0.0.0:8080->8080/tcp',
    uptime: '3 days',
    cpuPercent: '2.4%',
    memoryUsage: '128MiB / 2GiB',
    memoryPercent: '6.25%',
    labels:
      'com.docker.compose.project=zvia-app,com.docker.compose.service=api,com.zvia.stack=demo',
    networks: 'zvia-app-net'
  },
  {
    id: 'e5f6g7h8',
    name: 'postgres',
    status: 'Up 3 days',
    state: 'running',
    image: 'postgres:16',
    ports: '5432/tcp',
    uptime: '3 days',
    cpuPercent: '0.8%',
    memoryUsage: '96MiB / 2GiB',
    memoryPercent: '4.69%',
    labels:
      'com.docker.compose.project=zvia-app,com.docker.compose.service=db,com.zvia.stack=demo',
    networks: 'zvia-app-net'
  },
  {
    id: 'i9j0k1l2',
    name: 'redis',
    status: 'Up 3 days',
    state: 'running',
    image: 'redis:7-alpine',
    ports: '6379/tcp',
    uptime: '3 days',
    cpuPercent: '0.3%',
    memoryUsage: '12MiB / 2GiB',
    memoryPercent: '0.59%',
    labels:
      'com.docker.compose.project=zvia-app,com.docker.compose.service=cache,com.zvia.stack=demo',
    networks: 'zvia-app-net'
  }
]

const DEMO_INFO: SystemInfo = {
  hostname: 'production.example.com',
  osName: 'Ubuntu',
  osVersion: '24.04 LTS',
  architecture: 'x86_64',
  uptimeSeconds: 259200
}

const DEMO_STATS: ServerStatsSnapshot = {
  timestamp: Date.now(),
  cpu: {
    totalUsagePercent: 24.6,
    coreCount: 4,
    cores: [
      { coreIndex: 0, usagePercent: 28.2 },
      { coreIndex: 1, usagePercent: 22.1 },
      { coreIndex: 2, usagePercent: 19.4 },
      { coreIndex: 3, usagePercent: 28.7 }
    ],
    loadAverage: [0.42, 0.38, 0.35]
  },
  memory: {
    totalBytes: 8 * 1024 ** 3,
    usedBytes: 3.2 * 1024 ** 3,
    freeBytes: 1.1 * 1024 ** 3,
    availableBytes: 4.4 * 1024 ** 3,
    usagePercent: 40,
    swapTotalBytes: 2 * 1024 ** 3,
    swapUsedBytes: 128 * 1024 ** 2,
    swapUsagePercent: 6.25
  },
  filesystems: [
    {
      mount: '/',
      device: '/dev/vda1',
      totalBytes: 80 * 1024 ** 3,
      usedBytes: 32 * 1024 ** 3,
      availableBytes: 45 * 1024 ** 3,
      usagePercent: 41.5
    },
    {
      mount: '/var',
      device: '/dev/vda2',
      totalBytes: 40 * 1024 ** 3,
      usedBytes: 12 * 1024 ** 3,
      availableBytes: 26 * 1024 ** 3,
      usagePercent: 31.2
    }
  ],
  network: [
    {
      name: 'eth0',
      rxBytesPerSec: 124_000,
      txBytesPerSec: 48_500,
      rxBytesTotal: 42_800_000_000,
      txBytesTotal: 18_200_000_000
    }
  ]
}

const DEMO_NGINX_STATUS: NginxStatus = {
  installed: true,
  version: '1.24.0',
  paths: {
    prefix: '/usr/share/nginx',
    confPath: '/etc/nginx/nginx.conf',
    configRoot: '/etc/nginx',
    errorLogPath: '/var/log/nginx/error.log',
    accessLogPath: '/var/log/nginx/access.log'
  },
  systemdAvailable: true,
  activeState: 'active',
  subState: 'running',
  mainPid: 1421,
  activeSince: 'Mon 2026-08-25 09:14:22 UTC',
  unitFileState: 'enabled',
  validation: {
    state: 'valid',
    output:
      'nginx: the configuration file /etc/nginx/nginx.conf syntax is ok\nnginx: configuration file /etc/nginx/nginx.conf test is successful'
  },
  canReload: true
}

const DEMO_NGINX_CONFIG_TREE: NginxConfigTree = {
  configRoot: '/etc/nginx',
  files: [
    { path: '/etc/nginx/nginx.conf', name: 'nginx.conf', group: 'root', size: 1440 },
    {
      path: '/etc/nginx/sites-available/default',
      name: 'default',
      group: 'sites-available',
      size: 2412,
      enabled: true
    },
    {
      path: '/etc/nginx/sites-enabled/default',
      name: 'default',
      group: 'sites-enabled',
      size: 2412
    }
  ]
}

const DEMO_SERVICES: SystemdUnit[] = [
  {
    unit: 'nginx.service',
    description: 'A high performance web server and a reverse proxy server',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  },
  {
    unit: 'ssh.service',
    description: 'OpenBSD Secure Shell server',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  },
  {
    unit: 'docker.service',
    description: 'Docker Application Container Engine',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  },
  {
    unit: 'postgresql.service',
    description: 'PostgreSQL RDBMS',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  },
  {
    unit: 'redis-server.service',
    description: 'Advanced key-value store',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  },
  {
    unit: 'cron.service',
    description: 'Regular background program processing daemon',
    loadState: 'loaded',
    activeState: 'active',
    subState: 'running',
    unitFileState: 'enabled'
  }
]

const DEMO_SSL_OVERVIEW: SslOverview = {
  nginx: { installed: true, running: true, version: '1.24.0' },
  certbot: {
    installed: true,
    version: '2.9.0',
    channel: 'apt',
    nginxPluginAvailable: true,
    installHint: null
  },
  certificates: [
    {
      id: 'production.example.com',
      primaryDomain: 'production.example.com',
      domains: ['production.example.com', 'www.production.example.com'],
      status: 'valid',
      issuer: "Let's Encrypt",
      issuedAt: '2026-05-28T10:00:00Z',
      expiresAt: '2026-08-26T10:00:00Z',
      daysRemaining: 89,
      certificatePath: '/etc/letsencrypt/live/production.example.com/fullchain.pem',
      privateKeyPath: '/etc/letsencrypt/live/production.example.com/privkey.pem',
      managedByCertbot: true,
      renewal: { method: 'systemd-timer', lastAttempt: null, lastResult: null },
      nginxSites: [
        {
          configPath: '/etc/nginx/sites-enabled/default',
          serverNames: ['production.example.com'],
          listensHttps: true,
          ports: [443]
        }
      ],
      inspectionError: null
    }
  ],
  autoRenewal: {
    configured: true,
    method: 'systemd-timer',
    detail: 'certbot.timer',
    nextRun: '2026-08-30T03:00:00Z',
    lastAttempt: '2026-08-29T03:00:00Z',
    lastResult: 'success',
    canEnable: false
  },
  opensslAvailable: true,
  capabilities: { systemd: true, cron: true, curl: true }
}

const DEMO_SSL_NGINX_SITES: SslNginxLink[] = DEMO_SSL_OVERVIEW.certificates[0].nginxSites

const DEMO_USERS: UsersListResponse = {
  users: [
    {
      username: 'ubuntu',
      uid: 1000,
      gid: 1000,
      gecos: 'Ubuntu',
      home: '/home/ubuntu',
      shell: '/bin/bash',
      kind: 'human',
      isAdmin: true,
      accountStatus: 'password',
      lastLogin: 'Aug 29 08:14',
      protected: true,
      protectedReason: 'Connected user'
    },
    {
      username: 'deploy',
      uid: 1001,
      gid: 1001,
      gecos: 'Deploy',
      home: '/home/deploy',
      shell: '/bin/bash',
      kind: 'human',
      isAdmin: false,
      accountStatus: 'password',
      lastLogin: 'Aug 28 14:02',
      protected: false
    },
    {
      username: 'www-data',
      uid: 33,
      gid: 33,
      gecos: 'www-data',
      home: '/var/www',
      shell: '/usr/sbin/nologin',
      kind: 'system',
      isAdmin: false,
      accountStatus: 'no-password',
      lastLogin: null,
      protected: false
    }
  ],
  connectedUsername: 'ubuntu',
  uidMin: 1000,
  adminGroup: 'sudo'
}

const DEMO_PROCESSES: ProcessSummary[] = [
  {
    pid: 1,
    user: 'root',
    cpuPercent: 0.1,
    memoryPercent: 0.2,
    rssBytes: 10_240_000,
    stat: 'S',
    elapsedSeconds: 259_200,
    comm: 'systemd',
    args: '/sbin/init'
  },
  {
    pid: 892,
    user: 'root',
    cpuPercent: 0.0,
    memoryPercent: 0.3,
    rssBytes: 8_192_000,
    stat: 'S',
    elapsedSeconds: 259_100,
    comm: 'sshd',
    args: 'sshd: /usr/sbin/sshd -D'
  },
  {
    pid: 1421,
    user: 'root',
    cpuPercent: 0.3,
    memoryPercent: 0.8,
    rssBytes: 32_128_000,
    stat: 'S',
    elapsedSeconds: 258_900,
    comm: 'nginx',
    args: 'nginx: master process /usr/sbin/nginx'
  },
  {
    pid: 2847,
    user: 'root',
    cpuPercent: 2.4,
    memoryPercent: 1.6,
    rssBytes: 131_072_000,
    stat: 'S',
    elapsedSeconds: 259_000,
    comm: 'dockerd',
    args: '/usr/bin/dockerd -H fd://'
  },
  {
    pid: 3104,
    user: 'ubuntu',
    cpuPercent: 1.2,
    memoryPercent: 2.1,
    rssBytes: 171_966_464,
    stat: 'S',
    elapsedSeconds: 86_400,
    comm: 'node',
    args: 'node /app/dist/server.js'
  }
]

const DEMO_PROCESS_DETAIL: ProcessDetail = {
  ...DEMO_PROCESSES[4],
  ppid: 3103,
  state: 'running',
  uid: 1000,
  cmdline: 'node /app/dist/server.js',
  exe: '/usr/bin/node',
  cwd: '/app',
  cgroupUnit: 'zvia-api.service',
  containerId: 'a1b2c3d4',
  containerName: 'zvia-api',
  unit: 'zvia-api.service',
  unitActiveState: 'active',
  listeningPorts: [{ protocol: 'tcp', address: '0.0.0.0', port: 8080 }],
  protected: false
}

const DEMO_PACKAGE_OVERVIEW: PackageOverview = {
  distro: 'Ubuntu 24.04 LTS',
  manager: 'apt',
  managerLabel: 'APT',
  installedCount: 842,
  updateCount: 12
}

const DEMO_INSTALLED_PACKAGES: InstalledPackage[] = [
  {
    name: 'curl',
    version: '8.5.0-2ubuntu10.6',
    architecture: 'amd64',
    description: 'command line tool for transferring data with URL syntax',
    status: 'installed'
  },
  {
    name: 'docker.io',
    version: '27.5.1-0ubuntu3',
    architecture: 'amd64',
    description: 'Linux container runtime',
    status: 'installed'
  },
  {
    name: 'nginx',
    version: '1.24.0-2ubuntu7.5',
    architecture: 'amd64',
    description: 'small, powerful, scalable web/proxy server',
    status: 'installed'
  },
  {
    name: 'openssh-server',
    version: '1:9.6p1-3ubuntu13.14',
    architecture: 'amd64',
    description: 'secure shell (SSH) server',
    status: 'installed'
  },
  {
    name: 'postgresql-16',
    version: '16.10-0ubuntu0.24.04.1',
    architecture: 'amd64',
    description: 'object-relational SQL database',
    status: 'installed'
  }
]

const DEMO_PACKAGE_UPDATES: PackageUpdate[] = [
  {
    name: 'libc6',
    installedVersion: '2.39-0ubuntu8.5',
    candidateVersion: '2.39-0ubuntu8.6',
    architecture: 'amd64'
  },
  {
    name: 'openssl',
    installedVersion: '3.0.13-0ubuntu3.5',
    candidateVersion: '3.0.13-0ubuntu3.6',
    architecture: 'amd64'
  }
]

const DEMO_LOG_ENTRIES: LogEntry[] = [
  {
    id: 'log-1',
    timestamp: Date.now() - 120_000,
    priority: 6,
    unit: 'nginx.service',
    message: 'Started A high performance web server and a reverse proxy server.',
    hostname: 'production.example.com'
  },
  {
    id: 'log-2',
    timestamp: Date.now() - 90_000,
    priority: 6,
    unit: 'docker.service',
    message: 'Docker Application Container Engine started.',
    hostname: 'production.example.com'
  },
  {
    id: 'log-3',
    timestamp: Date.now() - 60_000,
    priority: 6,
    unit: 'ssh.service',
    message: 'Accepted publickey for ubuntu from 203.0.113.42 port 52104 ssh2',
    hostname: 'production.example.com'
  },
  {
    id: 'log-4',
    timestamp: Date.now() - 30_000,
    priority: 4,
    unit: 'zvia-api.service',
    message: 'Listening on port 8080',
    hostname: 'production.example.com'
  },
  {
    id: 'log-5',
    timestamp: Date.now() - 10_000,
    priority: 6,
    unit: 'systemd',
    message: 'Started Session 42 of User ubuntu.',
    hostname: 'production.example.com'
  }
]

const DEMO_FILES: FilesListResponse = {
  path: '/home/ubuntu',
  entries: [
    {
      name: 'projects',
      path: '/home/ubuntu/projects',
      type: 'directory',
      size: 4096,
      modified: Date.now() - 86_400_000,
      permissions: 'drwxr-xr-x'
    },
    {
      name: 'deploy.sh',
      path: '/home/ubuntu/deploy.sh',
      type: 'file',
      size: 2048,
      modified: Date.now() - 3_600_000,
      permissions: '-rwxr-xr-x'
    },
    {
      name: '.bashrc',
      path: '/home/ubuntu/.bashrc',
      type: 'file',
      size: 3771,
      modified: Date.now() - 604_800_000,
      permissions: '-rw-r--r--'
    },
    {
      name: 'logs',
      path: '/home/ubuntu/logs',
      type: 'directory',
      size: 4096,
      modified: Date.now() - 1_800_000,
      permissions: 'drwxr-xr-x'
    },
    {
      name: 'README.md',
      path: '/home/ubuntu/README.md',
      type: 'file',
      size: 512,
      modified: Date.now() - 172_800_000,
      permissions: '-rw-r--r--'
    }
  ]
}

const DEMO_PORTS: PortsSnapshot = {
  listeners: [
    {
      protocol: 'tcp',
      address: '0.0.0.0',
      port: 22,
      pid: 892,
      process: 'sshd',
      exposure: 'bound-all',
      unit: 'ssh.service',
      containerId: null,
      containerName: null,
      firewall: 'allowed'
    },
    {
      protocol: 'tcp',
      address: '0.0.0.0',
      port: 80,
      pid: 1421,
      process: 'nginx',
      exposure: 'bound-all',
      unit: 'nginx.service',
      containerId: null,
      containerName: null,
      firewall: 'allowed'
    },
    {
      protocol: 'tcp',
      address: '0.0.0.0',
      port: 443,
      pid: 1421,
      process: 'nginx',
      exposure: 'bound-all',
      unit: 'nginx.service',
      containerId: null,
      containerName: null,
      firewall: 'allowed'
    },
    {
      protocol: 'tcp',
      address: '0.0.0.0',
      port: 8080,
      pid: 3104,
      process: 'docker-proxy',
      exposure: 'bound-all',
      unit: null,
      containerId: 'a1b2c3d4',
      containerName: 'zvia-api',
      firewall: 'allowed'
    }
  ],
  firewall: {
    backend: 'ufw',
    status: 'active',
    defaultIncoming: 'deny',
    editable: true,
    rules: [
      {
        id: '1',
        raw: '22/tcp ALLOW Anywhere',
        action: 'ALLOW',
        target: 'Anywhere',
        from: 'Anywhere',
        protocol: 'tcp',
        ports: [{ start: 22, end: 22 }]
      },
      {
        id: '2',
        raw: '80/tcp ALLOW Anywhere',
        action: 'ALLOW',
        target: 'Anywhere',
        from: 'Anywhere',
        protocol: 'tcp',
        ports: [{ start: 80, end: 80 }]
      },
      {
        id: '3',
        raw: '443/tcp ALLOW Anywhere',
        action: 'ALLOW',
        target: 'Anywhere',
        from: 'Anywhere',
        protocol: 'tcp',
        ports: [{ start: 443, end: 443 }]
      }
    ]
  },
  sshPort: 22,
  source: 'ss'
}

const DEMO_API_DOMAIN = 'domain:api.production.example.com'
const DEMO_WEB_DOMAIN = 'domain:production.example.com'
const DEMO_API_SITE = 'nginx:/etc/nginx/sites-enabled/api:10'
const DEMO_WEB_SITE = 'nginx:/etc/nginx/sites-enabled/web:20'
const DEMO_API_PORT = 'port:tcp:127.0.0.1:8080'
const DEMO_WEB_PORT = 'port:tcp:127.0.0.1:3000'
const DEMO_API_CONTAINER = 'container:a1b2c3d4'
const DEMO_REDIS_PORT = 'port:tcp:127.0.0.1:6379'
const DEMO_REDIS_CONTAINER = 'container:c9d0e1f2'

const DEMO_PROD_DEPLOYMENT_ID = 'deployment:production.example.com'
const DEMO_API_DEPLOYMENT_ID = 'deployment:api.production.example.com'

type DemoHealthStatus = 'healthy' | 'degraded' | 'failed'

interface DemoSnapshotOptions {
  scannedAt: string
  productionBackend: DemoHealthStatus
  includeApi: boolean
  apiContainerState?: 'running' | 'restarting'
  includeRedis?: boolean
}

function demoSnapshot(options: DemoSnapshotOptions): TopologySnapshot {
  const entities: Record<string, TopologyEntity> = {}
  const relationships: Relationship[] = []
  const deployments: Deployment[] = []

  const prodDomainStatus = options.productionBackend === 'healthy' ? 'healthy' : 'degraded'
  const prodNginxStatus = options.productionBackend === 'failed' ? 'degraded' : 'healthy'

  entities[DEMO_WEB_DOMAIN] = {
    id: DEMO_WEB_DOMAIN,
    kind: 'domain',
    label: 'production.example.com',
    status: prodDomainStatus,
    navigate: { tool: 'ssl', domain: 'production.example.com' }
  }
  entities[DEMO_WEB_SITE] = {
    id: DEMO_WEB_SITE,
    kind: 'nginx_site',
    label: 'production.example.com',
    status: prodNginxStatus,
    sourceRef: { configPath: '/etc/nginx/sites-enabled/web', startLineNumber: 20 },
    navigate: { tool: 'nginx', configPath: '/etc/nginx/sites-enabled/web' }
  }
  entities[DEMO_WEB_PORT] = {
    id: DEMO_WEB_PORT,
    kind: 'port',
    label: ':3000',
    status: options.productionBackend,
    sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 3000 },
    navigate: { tool: 'ports', port: 3000 }
  }

  relationships.push(
    {
      id: 'rel-web-domain-site',
      from: { kind: 'domain', id: DEMO_WEB_DOMAIN },
      to: { kind: 'nginx_site', id: DEMO_WEB_SITE },
      type: 'serves',
      confidence: 'confirmed',
      evidence: []
    },
    {
      id: 'rel-web-site-port',
      from: { kind: 'nginx_site', id: DEMO_WEB_SITE },
      to: { kind: 'port', id: DEMO_WEB_PORT },
      type: 'proxies_to',
      confidence: 'confirmed',
      label: 'proxy_pass',
      evidence: [
        {
          source: 'nginx-T',
          kind: 'directive',
          detail: 'proxy_pass http://127.0.0.1:3000',
          raw: 'proxy_pass http://127.0.0.1:3000;',
          location: '/etc/nginx/sites-enabled/web, line 18',
          observedAt: options.scannedAt
        }
      ]
    }
  )

  deployments.push({
    id: DEMO_PROD_DEPLOYMENT_ID,
    name: 'production.example.com',
    health: options.productionBackend,
    entityIds: [DEMO_WEB_DOMAIN, DEMO_WEB_SITE, DEMO_WEB_PORT],
    entrypoints: [{ kind: 'domain', id: DEMO_WEB_DOMAIN }],
    stackSummary: 'Nginx → :3000 → Node → zvia-web.service',
    componentStatus: {
      ssl: 'healthy',
      nginx: prodNginxStatus,
      backend: options.productionBackend,
      service: 'healthy'
    }
  })

  if (options.includeApi) {
    const apiContainerState = options.apiContainerState ?? 'running'
    const apiContainerStatus: DemoHealthStatus =
      apiContainerState === 'running' ? 'healthy' : 'degraded'

    entities[DEMO_API_DOMAIN] = {
      id: DEMO_API_DOMAIN,
      kind: 'domain',
      label: 'api.production.example.com',
      status: 'healthy',
      navigate: { tool: 'ssl', domain: 'api.production.example.com' }
    }
    entities[DEMO_API_SITE] = {
      id: DEMO_API_SITE,
      kind: 'nginx_site',
      label: 'api.production.example.com',
      status: 'healthy',
      sourceRef: { configPath: '/etc/nginx/sites-enabled/api', startLineNumber: 10 },
      navigate: { tool: 'nginx', configPath: '/etc/nginx/sites-enabled/api' }
    }
    entities[DEMO_API_PORT] = {
      id: DEMO_API_PORT,
      kind: 'port',
      label: ':8080',
      status: 'healthy',
      sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 8080 },
      navigate: { tool: 'ports', port: 8080 }
    }
    entities[DEMO_API_CONTAINER] = {
      id: DEMO_API_CONTAINER,
      kind: 'docker_container',
      label: 'zvia-api',
      status: apiContainerStatus,
      sourceRef: { state: apiContainerState },
      navigate: { tool: 'docker', containerId: 'a1b2c3d4' }
    }

    relationships.push(
      {
        id: 'rel-api-domain-site',
        from: { kind: 'domain', id: DEMO_API_DOMAIN },
        to: { kind: 'nginx_site', id: DEMO_API_SITE },
        type: 'serves',
        confidence: 'confirmed',
        evidence: []
      },
      {
        id: 'rel-api-site-port',
        from: { kind: 'nginx_site', id: DEMO_API_SITE },
        to: { kind: 'port', id: DEMO_API_PORT },
        type: 'proxies_to',
        confidence: 'confirmed',
        label: 'proxy_pass',
        evidence: [
          {
            source: 'nginx-T',
            kind: 'directive',
            detail: 'proxy_pass http://127.0.0.1:8080',
            raw: 'proxy_pass http://127.0.0.1:8080;',
            location: '/etc/nginx/sites-enabled/api, line 18',
            observedAt: options.scannedAt
          }
        ]
      },
      {
        id: 'rel-api-port-container',
        from: { kind: 'port', id: DEMO_API_PORT },
        to: { kind: 'docker_container', id: DEMO_API_CONTAINER },
        type: 'published_by',
        confidence: 'confirmed',
        evidence: []
      }
    )

    const apiEntityIds = [DEMO_API_DOMAIN, DEMO_API_SITE, DEMO_API_PORT, DEMO_API_CONTAINER]
    if (options.includeRedis) {
      entities[DEMO_REDIS_PORT] = {
        id: DEMO_REDIS_PORT,
        kind: 'port',
        label: ':6379',
        status: 'healthy',
        sourceRef: { protocol: 'tcp', address: '127.0.0.1', port: 6379 },
        navigate: { tool: 'ports', port: 6379 }
      }
      entities[DEMO_REDIS_CONTAINER] = {
        id: DEMO_REDIS_CONTAINER,
        kind: 'docker_container',
        label: 'redis',
        status: 'healthy',
        sourceRef: { state: 'running' },
        navigate: { tool: 'docker', containerId: 'c9d0e1f2' }
      }
      relationships.push({
        id: 'rel-redis-port-container',
        from: { kind: 'port', id: DEMO_REDIS_PORT },
        to: { kind: 'docker_container', id: DEMO_REDIS_CONTAINER },
        type: 'published_by',
        confidence: 'confirmed',
        evidence: []
      })
      apiEntityIds.push(DEMO_REDIS_PORT, DEMO_REDIS_CONTAINER)
    }

    deployments.push({
      id: DEMO_API_DEPLOYMENT_ID,
      name: 'api.production.example.com',
      health: apiContainerStatus,
      entityIds: apiEntityIds,
      entrypoints: [{ kind: 'domain', id: DEMO_API_DOMAIN }],
      stackSummary: 'Nginx → :8080 → Docker → zvia-api',
      componentStatus: { ssl: 'healthy', nginx: 'healthy', backend: 'healthy', container: apiContainerStatus }
    })
  }

  return {
    serverId: SCREENSHOT_SERVER_ID,
    scannedAt: options.scannedAt,
    scanDurationMs: 1240,
    entities,
    relationships,
    deployments,
    insights: [],
    warnings: []
  }
}

interface DemoHistoryEntry {
  snapshot: TopologySnapshot
  deploymentTags: Record<string, string[]>
}

/**
 * Ordered oldest → newest. A staged outage + recovery + a new regression, with
 * tags sprinkled so every compare path (snapshot↔snapshot, snapshot→current)
 * has something to show.
 */
const demoHistory: DemoHistoryEntry[] = [
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-24T10:00:00.000Z', productionBackend: 'healthy', includeApi: false }),
    deploymentTags: {}
  },
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-25T10:00:00.000Z', productionBackend: 'healthy', includeApi: true }),
    deploymentTags: { [DEMO_PROD_DEPLOYMENT_ID]: ['stable'], [DEMO_API_DEPLOYMENT_ID]: ['v1'] }
  },
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-26T10:00:00.000Z', productionBackend: 'degraded', includeApi: true }),
    deploymentTags: {}
  },
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-27T10:00:00.000Z', productionBackend: 'failed', includeApi: true }),
    deploymentTags: {}
  },
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-28T10:00:00.000Z', productionBackend: 'healthy', includeApi: true, includeRedis: true }),
    deploymentTags: { [DEMO_PROD_DEPLOYMENT_ID]: ['post-fix'], [DEMO_API_DEPLOYMENT_ID]: ['v2'] }
  },
  {
    snapshot: demoSnapshot({ scannedAt: '2026-08-29T12:00:00.000Z', productionBackend: 'healthy', includeApi: true, includeRedis: true, apiContainerState: 'restarting' }),
    deploymentTags: {}
  }
]

const DEMO_SNAPSHOT_LIVE = demoHistory[demoHistory.length - 1].snapshot

function demoHistoryList(): DeploymentsHistorySummary[] {
  return [...demoHistory].reverse().map((entry) => ({
    id: entry.snapshot.scannedAt,
    scannedAt: entry.snapshot.scannedAt,
    deploymentTags: entry.deploymentTags
  }))
}

function demoDeploymentHistory(deploymentId: string): DeploymentsDeploymentHistoryEntry[] {
  const entries: DeploymentsDeploymentHistoryEntry[] = []
  for (let index = 0; index < demoHistory.length; index += 1) {
    const snapshot = demoHistory[index].snapshot
    const tags = demoHistory[index].deploymentTags[deploymentId] ?? []
    const changes =
      index === 0
        ? []
        : diffTopologyForDeployment(demoHistory[index - 1].snapshot, snapshot, deploymentId)
    if (changes.length === 0 && tags.length === 0) continue
    entries.push({
      id: snapshot.scannedAt,
      scannedAt: snapshot.scannedAt,
      tags,
      changeCount: changes.length,
      summary: summarizeChanges(changes)
    })
  }
  return entries.reverse()
}

function demoSnapshotById(id: string): TopologySnapshot | undefined {
  return demoHistory.find((entry) => entry.snapshot.scannedAt === id)?.snapshot
}

const DEMO_CRON: CronListResponse = {
  jobs: [
    {
      id: 'user-1',
      raw: '0 3 * * * /usr/local/bin/backup.sh',
      schedule: '0 3 * * *',
      command: '/usr/local/bin/backup.sh',
      user: 'ubuntu',
      source: 'user-crontab',
      sourcePath: 'crontab',
      lineNumber: 1,
      description: 'At 03:00 daily',
      valid: true,
      target: 'user'
    },
    {
      id: 'user-2',
      raw: '*/15 * * * * /opt/zvia/healthcheck.sh',
      schedule: '*/15 * * * *',
      command: '/opt/zvia/healthcheck.sh',
      user: 'ubuntu',
      source: 'user-crontab',
      sourcePath: 'crontab',
      lineNumber: 2,
      description: 'Every 15 minutes',
      valid: true,
      target: 'user'
    },
    {
      id: 'system-1',
      raw: '0 0 * * * root /usr/sbin/logrotate /etc/logrotate.conf',
      schedule: '0 0 * * *',
      command: '/usr/sbin/logrotate /etc/logrotate.conf',
      user: 'root',
      source: 'system-crontab',
      sourcePath: '/etc/crontab',
      lineNumber: 18,
      description: 'At midnight daily',
      valid: true
    }
  ],
  crontabAvailable: true,
  canEditUser: true,
  canEditRoot: false
}

type ScreenshotStub = (payload: unknown) => Promise<unknown>

let screenshotWindow: BrowserWindow | null = null

export function setScreenshotMainWindow(window: BrowserWindow | null): void {
  screenshotWindow = window
}

function emitStatsUpdate(payload: unknown): void {
  const request = payload as { serverId: string }
  screenshotWindow?.webContents.send('stats:update', {
    serverId: request.serverId,
    info: DEMO_INFO,
    stats: DEMO_STATS
  })
}

function emitProcessesUpdate(payload: unknown): void {
  const request = payload as { serverId: string }
  screenshotWindow?.webContents.send('processes:update', {
    serverId: request.serverId,
    processes: DEMO_PROCESSES,
    capturedAt: new Date().toISOString()
  })
}

function emitLogsEntries(payload: unknown, reset = true): void {
  const request = payload as { serverId: string }
  screenshotWindow?.webContents.send('logs:status', {
    serverId: request.serverId,
    status: 'streaming'
  })
  screenshotWindow?.webContents.send('logs:entries', {
    serverId: request.serverId,
    entries: DEMO_LOG_ENTRIES,
    reset
  })
}

function paginateInstalledPackages(
  query?: string,
  offset = 0,
  limit = 500
): PaginatedResult<InstalledPackage> {
  const normalizedQuery = query?.trim().toLowerCase() ?? ''
  const filtered = normalizedQuery
    ? DEMO_INSTALLED_PACKAGES.filter(
        (pkg) =>
          pkg.name.toLowerCase().includes(normalizedQuery) ||
          pkg.description.toLowerCase().includes(normalizedQuery)
      )
    : DEMO_INSTALLED_PACKAGES

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    offset,
    limit
  }
}

const SCREENSHOT_STUBS: Partial<Record<IpcChannel, ScreenshotStub>> = {
  'profiles:list': async () => [SCREENSHOT_PROFILE],
  'connection:getState': async () => 'connected',
  'connection:connect': async () => undefined,
  'connection:disconnect': async () => undefined,
  'connection:test': async () => undefined,
  'docker:isAvailable': async () => true,
  'docker:listContainers': async () => DEMO_CONTAINERS,
  'stats:getInfo': async () => DEMO_INFO,
  'stats:subscribe': async (payload) => {
    emitStatsUpdate(payload)
    return undefined
  },
  'stats:unsubscribe': async () => undefined,
  'services:isAvailable': async () => true,
  'services:list': async () => DEMO_SERVICES,
  'nginx:status': async () => DEMO_NGINX_STATUS,
  'nginx:configTree': async () => DEMO_NGINX_CONFIG_TREE,
  'nginx:validate': async () => DEMO_NGINX_STATUS.validation,
  'nginx:logPaths': async () => ({
    accessLogs: ['/var/log/nginx/access.log'],
    errorLogs: ['/var/log/nginx/error.log']
  }),
  'ssl:overview': async () => DEMO_SSL_OVERVIEW,
  'ssl:nginxSites': async () => DEMO_SSL_NGINX_SITES,
  'users:isAvailable': async () => true,
  'users:list': async () => DEMO_USERS,
  'users:groups': async () => [
    { name: 'sudo', gid: 27, members: ['ubuntu'] },
    { name: 'docker', gid: 999, members: ['ubuntu', 'deploy'] },
    { name: 'www-data', gid: 33, members: [] }
  ],
  'processes:list': async () => DEMO_PROCESSES,
  'processes:get': async (payload) => {
    const request = payload as { pid: number }
    return request.pid === DEMO_PROCESS_DETAIL.pid
      ? DEMO_PROCESS_DETAIL
      : { ...DEMO_PROCESS_DETAIL, pid: request.pid, comm: `process-${request.pid}` }
  },
  'processes:subscribe': async (payload) => {
    emitProcessesUpdate(payload)
    return undefined
  },
  'processes:unsubscribe': async () => undefined,
  'processes:signal': async () => undefined,
  'packages:isAvailable': async () => ({ available: true }),
  'packages:overview': async () => DEMO_PACKAGE_OVERVIEW,
  'packages:list': async (payload) => {
    const request = payload as { query?: string; offset: number; limit: number }
    return paginateInstalledPackages(request.query, request.offset, request.limit)
  },
  'packages:updates': async () => DEMO_PACKAGE_UPDATES,
  'packages:search': async () => [],
  'packages:info': async (payload) => {
    const request = payload as { packageName: string }
    const installed = DEMO_INSTALLED_PACKAGES.find((pkg) => pkg.name === request.packageName)
    return {
      name: request.packageName,
      version: installed?.version ?? '1.0.0-1',
      candidateVersion: installed?.version ?? '1.0.0-1',
      availableVersions: installed?.version
        ? [installed.version, '1.0.0-1']
        : ['1.0.0-1', '0.9.0-1'],
      installedVersion: installed?.version ?? null,
      architecture: installed?.architecture ?? 'amd64',
      description: installed?.description ?? '',
      homepage: null,
      installed: Boolean(installed),
      dependencies: [],
      reverseDependencies: [],
      installedFiles: []
    }
  },
  'logs:start': async (payload) => {
    emitLogsEntries(payload)
    return undefined
  },
  'logs:stop': async () => undefined,
  'logs:setFilters': async (payload) => {
    emitLogsEntries(payload)
    return undefined
  },
  'files:list': async (payload) => {
    const request = payload as { path: string }
    if (request.path === '/' || request.path === '/home/ubuntu') {
      return DEMO_FILES
    }
    return { path: request.path, entries: [] }
  },
  'ports:list': async () => DEMO_PORTS,
  'deployments:scan': async () => DEMO_SNAPSHOT_LIVE,
  'deployments:getSnapshot': async () => DEMO_SNAPSHOT_LIVE,
  'deployments:historyList': async () => demoHistoryList(),
  'deployments:deploymentHistory': async (payload) =>
    demoDeploymentHistory((payload as { deploymentId: string }).deploymentId),
  'deployments:diff': async (payload) => {
    const request = payload as { baselineId: string | null; deploymentId: string }
    const baseline = request.baselineId ? demoSnapshotById(request.baselineId) : undefined
    if (!baseline) {
      return { changes: [], baselineId: request.baselineId, baselineScannedAt: null }
    }
    return {
      changes: diffTopologyForDeployment(baseline, DEMO_SNAPSHOT_LIVE, request.deploymentId),
      baselineId: baseline.scannedAt,
      baselineScannedAt: baseline.scannedAt
    }
  },
  'deployments:snapshotDiff': async (payload) => {
    const request = payload as { fromSnapshotId: string; toSnapshotId: string; deploymentId: string }
    const from = demoSnapshotById(request.fromSnapshotId)
    const to = demoSnapshotById(request.toSnapshotId)
    if (!from || !to) {
      return {
        changes: [],
        fromId: request.fromSnapshotId,
        fromScannedAt: from?.scannedAt ?? '',
        toId: request.toSnapshotId,
        toScannedAt: to?.scannedAt ?? ''
      }
    }
    return {
      changes: diffTopologyForDeployment(from, to, request.deploymentId),
      fromId: from.scannedAt,
      fromScannedAt: from.scannedAt,
      toId: to.scannedAt,
      toScannedAt: to.scannedAt
    }
  },
  'deployments:tag': async (payload) => {
    const request = payload as {
      snapshotId: string
      deploymentId: string
      tag: string
      remove?: boolean
    }
    const entry = demoHistory.find((item) => item.snapshot.scannedAt === request.snapshotId)
    if (!entry) return undefined
    const tags = entry.deploymentTags[request.deploymentId] ?? []
    entry.deploymentTags[request.deploymentId] = request.remove
      ? tags.filter((tag) => tag !== request.tag)
      : tags.includes(request.tag)
        ? tags
        : [...tags, request.tag]
    return undefined
  },
  'deployments:tagCurrent': async (payload) => {
    const request = payload as { deploymentId: string; tag: string }
    const entry = demoHistory[demoHistory.length - 1]
    const tags = entry.deploymentTags[request.deploymentId] ?? []
    if (!tags.includes(request.tag)) {
      entry.deploymentTags[request.deploymentId] = [...tags, request.tag]
    }
    return undefined
  },
  'cron:list': async () => DEMO_CRON,
  'terminal:open': async () => undefined,
  'terminal:write': async () => undefined,
  'terminal:resize': async () => undefined,
  'terminal:close': async () => undefined
}

export function isScreenshotMode(): boolean {
  return process.env.ZVIA_SCREENSHOT === '1'
}

export function getScreenshotTool(): string {
  return process.env.ZVIA_SCREENSHOT_TOOL ?? 'docker'
}

export function getScreenshotStub(channel: IpcChannel): ScreenshotStub | undefined {
  if (!isScreenshotMode()) return undefined
  return SCREENSHOT_STUBS[channel]
}
