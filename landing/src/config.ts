import cronImg from './assets/screenshots/cron.png'
import deploymentsImg from './assets/screenshots/deployments.png'
import deploymentsInspectorImg from './assets/screenshots/deployments-inspector.png'
import deploymentsTopologyImg from './assets/screenshots/deployments-topology.png'
import dockerImg from './assets/screenshots/docker.png'
import filesImg from './assets/screenshots/files.png'
import logsImg from './assets/screenshots/logs.png'
import nginxImg from './assets/screenshots/nginx.png'
import overviewImg from './assets/screenshots/overview.png'
import packagesImg from './assets/screenshots/packages.png'
import portsImg from './assets/screenshots/ports.png'
import processesImg from './assets/screenshots/processes.png'
import servicesImg from './assets/screenshots/services.png'
import sslImg from './assets/screenshots/ssl.png'
import statsImg from './assets/screenshots/stats.png'
import usersImg from './assets/screenshots/users.png'
import { DEFAULT_DOWNLOADS, GITHUB_REPO } from './lib/downloads'

const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://illia-co.github.io/zvia').replace(
  /\/$/,
  ''
)

export const SITE = {
  title: 'Zvia — Open-source SSH client for Linux server management',
  description:
    'Open-source desktop app for managing Linux servers over SSH. Discover deployment topologies, inspect nginx → ports → containers → services, and manage stats, logs, Docker, SSL, files, and terminal — all server-scoped.',
  canonical: siteUrl,
  ogImage: `${siteUrl}/og-image.png`,
  github: GITHUB_REPO,
  releases: DEFAULT_DOWNLOADS.releases,
  downloadMac: DEFAULT_DOWNLOADS.downloadMac,
  downloadWindows: DEFAULT_DOWNLOADS.downloadWindows,
  downloadLinux: DEFAULT_DOWNLOADS.downloadLinux
} as const

export const DOC_PAGE_META = {
  title: 'Documentation — Zvia SSH server management',
  description:
    'Learn how to install Zvia, connect to Linux servers over SSH, and use tools for Docker, Nginx, SSL, systemd, logs, files, and terminal access.'
} as const

export const IMPRESSUM_PAGE_META = {
  title: 'Legal Notice — Zvia',
  description: 'Legal notice and provider identification for the Zvia website.'
} as const

export const DATENSCHUTZ_PAGE_META = {
  title: 'Privacy Policy — Zvia',
  description:
    'Privacy policy for the Zvia website and information about the local desktop application.'
} as const

/**
 * Legal provider details for the Legal Notice and Privacy Policy pages.
 * Replace placeholders before publishing.
 */
export const LEGAL = {
  providerName: 'Illia Tatarchenko',
  address: {
    street: 'Luisenstr. 45',
    postalCode: '76137',
    city: 'Karlsruhe',
    country: 'Germany'
  },
  contactEmail: null as string | null,
  githubContact: `${GITHUB_REPO}/issues`,
  hosting: {
    provider: 'GitHub Pages (GitHub, Inc.)',
    website: 'https://pages.github.com'
  }
} as const

export interface HeroScreenshot {
  src: string
  alt: string
  label: string
}

export const HERO_SCREENSHOTS: HeroScreenshot[] = [
  {
    src: deploymentsImg,
    alt: 'Zvia Deployments panel listing discovered application topologies on a production server',
    label: 'Deployments'
  },
  {
    src: deploymentsTopologyImg,
    alt: 'Zvia deployment topology canvas showing nginx, ports, and container connections',
    label: 'Topology'
  },
  {
    src: deploymentsInspectorImg,
    alt: 'Zvia deployment inspector showing entity details and evidence-backed connections',
    label: 'Inspector'
  },
  {
    src: overviewImg,
    alt: 'Zvia overview panel with server identity, connection status, and system metrics',
    label: 'Overview'
  },
  {
    src: nginxImg,
    alt: 'Zvia Nginx panel showing web server status and configuration',
    label: 'Nginx'
  }
]

export interface DeploymentScreenshot {
  id: string
  label: string
  headline: string
  description: string
  bullets: string[]
  src: string
  alt: string
}

export const DEPLOYMENT_SCREENSHOTS: DeploymentScreenshot[] = [
  {
    id: 'list',
    label: 'List',
    headline: 'Every domain, one row.',
    description:
      'Deployments scans the selected server and groups resources by primary domain. Health dots, component chips, and shared-backend insights surface problems before you open a detail view.',
    bullets: [
      'One deployment per primary nginx server_name',
      'Health reflects the worst status along the confirmed path to the backend',
      'Shared backends appear as cross-deployment insights'
    ],
    src: deploymentsImg,
    alt: 'Zvia Deployments table with domain, status, and component chips'
  },
  {
    id: 'topology',
    label: 'Topology',
    headline: 'Follow the path from domain to backend.',
    description:
      'Open a deployment to see an interactive topology canvas. Nodes represent domains, nginx sites, ports, services, processes, and containers. Edge style reflects how confident Zvia is about each connection.',
    bullets: [
      'Solid edges — confirmed relationships with direct evidence',
      'Dashed or dotted edges — likely or unknown connections',
      'Click any node or edge to inspect details'
    ],
    src: deploymentsTopologyImg,
    alt: 'Zvia deployment topology canvas with connected nodes and edges'
  },
  {
    id: 'inspector',
    label: 'Inspector',
    headline: 'Evidence for every connection.',
    description:
      'The inspector panel shows structured entity details, dependencies, and the evidence behind each relationship — nginx directives, port bindings, process matches, and Docker output.',
    bullets: [
      'Entity inspector — status, connections, and jump links to related tools',
      'Why? inspector — evidence snippets with source and location'
    ],
    src: deploymentsInspectorImg,
    alt: 'Zvia deployment inspector with entity status and connection evidence'
  }
]

export interface ToolInfo {
  id: string
  label: string
  section: string
  description: string
  /** Screenshot asset; omitted when visual is 'terminal'. */
  screenshot?: string
  visual?: 'screenshot' | 'terminal'
}

export interface FeatureGroup {
  id: string
  label: string
  headline: string
  description: string
  tools: ToolInfo[]
  screenshot?: string
  visual?: 'screenshot' | 'terminal'
}

export const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'applications',
    label: 'Applications',
    headline: 'Discover how apps are deployed.',
    description:
      'Deployments correlates nginx, SSL, ports, processes, systemd, and Docker into per-domain topologies with evidence-backed explanations — scoped to the server you selected.',
    tools: [
      {
        id: 'deployments',
        label: 'Deployments',
        section: 'Applications',
        description:
          'Topology discovery from domain to backend, with health indicators and interactive inspection.',
        screenshot: deploymentsImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'general',
    label: 'General',
    headline: 'See what your server is doing.',
    description:
      'Start with a clear picture of the machine you are connected to — identity, connection state, and the metrics that matter most.',
    tools: [
      {
        id: 'overview',
        label: 'Overview',
        section: 'General',
        description:
          'Server identity, connection status, and key system facts at a glance.',
        screenshot: overviewImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'system',
    label: 'System',
    headline: 'Understand load, users, and logs.',
    description:
      'Monitor resource usage, inspect running processes, manage accounts, and stream journal logs — all scoped to the server you selected.',
    tools: [
      {
        id: 'stats',
        label: 'Stats',
        section: 'System',
        description: 'CPU, memory, disk, network, and uptime in real time.',
        screenshot: statsImg,
        visual: 'screenshot'
      },
      {
        id: 'users',
        label: 'Users',
        section: 'System',
        description: 'Manage accounts, groups, sudo, and SSH keys.',
        screenshot: usersImg,
        visual: 'screenshot'
      },
      {
        id: 'processes',
        label: 'Processes',
        section: 'System',
        description: 'Live CPU and memory view, inspect processes, send signals.',
        screenshot: processesImg,
        visual: 'screenshot'
      },
      {
        id: 'packages',
        label: 'Packages',
        section: 'System',
        description: 'Search, install, update, and remove system packages.',
        screenshot: packagesImg,
        visual: 'screenshot'
      },
      {
        id: 'logs',
        label: 'Logs',
        section: 'System',
        description: 'Stream journalctl logs with filters and live follow.',
        screenshot: logsImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'workspace',
    label: 'Workspace',
    headline: 'Work without leaving the server context.',
    description:
      'A full SSH shell and SFTP file browser live inside the same workspace. No tab switching, no separate terminal app.',
    tools: [
      {
        id: 'terminal',
        label: 'Terminal',
        section: 'Workspace',
        description: 'Full interactive SSH shell embedded in the workspace.',
        visual: 'terminal'
      },
      {
        id: 'files',
        label: 'Files',
        section: 'Workspace',
        description: 'Browse, edit, upload, and download files over SFTP.',
        screenshot: filesImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'containers',
    label: 'Containers',
    headline: 'Manage Docker without memorizing flags.',
    description:
      'Inspect containers, images, volumes, and networks. View logs and exec into running containers from a structured panel.',
    tools: [
      {
        id: 'docker',
        label: 'Docker',
        section: 'Containers',
        description: 'Containers, images, volumes, networks, logs, and exec.',
        screenshot: dockerImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'network',
    label: 'Network',
    headline: 'See what is listening and serving traffic.',
    description:
      'Check open ports, inspect Nginx configuration, validate changes, and manage SSL certificates — all from one place.',
    tools: [
      {
        id: 'ports',
        label: 'Ports',
        section: 'Network',
        description: "See what's listening and manage firewall rules.",
        screenshot: portsImg,
        visual: 'screenshot'
      },
      {
        id: 'nginx',
        label: 'Nginx',
        section: 'Network',
        description:
          'Inspect configuration, validate changes, reload, and stream access logs.',
        screenshot: nginxImg,
        visual: 'screenshot'
      },
      {
        id: 'ssl',
        label: 'SSL',
        section: 'Network',
        description: 'View certificates, enable HTTPS via Certbot, manage renewal.',
        screenshot: sslImg,
        visual: 'screenshot'
      }
    ]
  },
  {
    id: 'daemons',
    label: 'Daemons',
    headline: 'Keep services and schedules under control.',
    description:
      'Start, stop, and inspect systemd units. View and edit cron entries without leaving the workspace.',
    tools: [
      {
        id: 'services',
        label: 'Services',
        section: 'Daemons',
        description: 'systemd units: start, stop, restart, enable, view logs.',
        screenshot: servicesImg,
        visual: 'screenshot'
      },
      {
        id: 'cron',
        label: 'Cron',
        section: 'Daemons',
        description: 'View and edit crontab entries for scheduled tasks.',
        screenshot: cronImg,
        visual: 'screenshot'
      }
    ]
  }
]

export interface ZviaToolGroup {
  label: string
  tools: string[]
}

export const ZVIA_TOOL_GROUPS: ZviaToolGroup[] = [
  { label: 'Applications', tools: ['Deployments'] },
  { label: 'General', tools: ['Overview'] },
  { label: 'System', tools: ['Stats', 'Users', 'Processes', 'Packages', 'Logs'] },
  { label: 'Workspace', tools: ['Terminal', 'Files'] },
  { label: 'Containers', tools: ['Docker'] },
  { label: 'Network', tools: ['Ports', 'Nginx', 'SSL'] },
  { label: 'Daemons', tools: ['Services', 'Cron'] }
]

export const TOOL_SECTIONS = FEATURE_GROUPS.map((group) => ({
  name: group.label,
  tools: group.tools
}))

export const PROBLEM_COMMANDS = [
  'ssh',
  'systemctl',
  'journalctl',
  'docker',
  'nginx',
  'ss',
  'ps',
  'top',
  'apt',
  'cron',
  'scp'
] as const