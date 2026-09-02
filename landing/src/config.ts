import cronImg from './assets/screenshots/cron.png'
import deploymentsInspectorImg from './assets/screenshots/deployments-inspector.png'
import deploymentsTopologyImg from './assets/screenshots/deployments-topology.png'
import deploymentsSnapshotsImg from './assets/screenshots/deployments-snapshots.png'
import deploymentsDiffImg from './assets/screenshots/deployments-diff.png'
import dockerImg from './assets/screenshots/docker.png'
import filesImg from './assets/screenshots/files.png'
import logsImg from './assets/screenshots/logs.png'
import nginxImg from './assets/screenshots/nginx.png'
import packagesImg from './assets/screenshots/packages.png'
import portsImg from './assets/screenshots/ports.png'
import processesImg from './assets/screenshots/processes.png'
import servicesImg from './assets/screenshots/services.png'
import sslImg from './assets/screenshots/ssl.png'
import usersImg from './assets/screenshots/users.png'
import { DEFAULT_DOWNLOADS, GITHUB_REPO } from './lib/downloads'

const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://illia-co.github.io/zvia').replace(
  /\/$/,
  ''
)

export const SITE = {
  title: 'Zvia — See how your server is actually wired',
  description:
    'Open-source desktop app for Linux servers over plain SSH. Zvia discovers each server’s deployment topology — nginx → SSL → ports → processes → containers — with evidence for every connection, plus tagged snapshots and diffs. No agent on the server, no credentials stored anywhere.',
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

export const SCREENSHOTS = {
  topology: deploymentsTopologyImg,
  inspector: deploymentsInspectorImg,
  snapshots: deploymentsSnapshotsImg,
  diff: deploymentsDiffImg
} as const

/**
 * Compact "everything you'd expect" tool grid. One line per tool — reassurance,
 * not persuasion. The `command` field is monospace and echoes the product UI.
 * `screenshot` is omitted for Terminal (a live shell), which renders a preview.
 */
export interface FeatureTool {
  id: string
  command: string
  label: string
  detail: string
  description: string
  screenshot?: string
}

export const FEATURE_TOOLS: FeatureTool[] = [
  {
    id: 'docker',
    command: 'docker',
    label: 'Docker',
    detail: 'Containers, images, logs, exec',
    description:
      'Inspect containers, images, volumes, and networks. View logs and exec into running containers from a structured panel.',
    screenshot: dockerImg
  },
  {
    id: 'nginx',
    command: 'nginx -T',
    label: 'Nginx',
    detail: 'Config, validation, reload',
    description:
      'Browse the config tree, validate changes before reload, and stream access and error logs.',
    screenshot: nginxImg
  },
  {
    id: 'ssl',
    command: 'certbot',
    label: 'SSL',
    detail: 'Certs, expiry, HTTPS',
    description:
      'View TLS certificates, check expiry, and enable HTTPS through Certbot with managed renewal.',
    screenshot: sslImg
  },
  {
    id: 'processes',
    command: 'ps',
    label: 'Processes',
    detail: 'Live load, inspect, signals',
    description:
      'Live CPU and memory view with filtering, per-process detail, and signals to stop or restart.',
    screenshot: processesImg
  },
  {
    id: 'ports',
    command: 'ss',
    label: 'Ports',
    detail: 'Listeners and firewall',
    description:
      'See what\u2019s listening and which process owns each port, with firewall rules where supported.',
    screenshot: portsImg
  },
  {
    id: 'users',
    command: 'passwd',
    label: 'Users',
    detail: 'Accounts, groups, keys',
    description:
      'Manage accounts, groups, sudo access, and SSH authorized keys without leaving the workspace.',
    screenshot: usersImg
  },
  {
    id: 'packages',
    command: 'apt',
    label: 'Packages',
    detail: 'Search, install, update',
    description:
      'Search, install, update, and remove apt packages — with installed, updates, and search tabs.',
    screenshot: packagesImg
  },
  {
    id: 'cron',
    command: 'crontab',
    label: 'Cron',
    detail: 'View and edit schedules',
    description: 'View and edit user and system crontabs from a structured editor.',
    screenshot: cronImg
  },
  {
    id: 'logs',
    command: 'journalctl',
    label: 'Logs',
    detail: 'Journal with live follow',
    description:
      'Stream journalctl output with filters by unit, priority, and time range, plus live follow.',
    screenshot: logsImg
  },
  {
    id: 'files',
    command: 'sftp',
    label: 'Files',
    detail: 'Browse, edit, upload',
    description:
      'Browse the remote filesystem over SFTP — edit, upload, and download files in place.',
    screenshot: filesImg
  },
  {
    id: 'terminal',
    command: 'ssh',
    label: 'Terminal',
    detail: 'Full interactive shell',
    description:
      'A full interactive SSH shell with a PTY — vim, htop, and prompts behave exactly like native.'
  },
  {
    id: 'services',
    command: 'systemctl',
    label: 'Services',
    detail: 'Start, stop, restart',
    description:
      'Manage systemd units — start, stop, restart, enable, and jump to related logs.',
    screenshot: servicesImg
  }
] as const

/**
 * Attribute comparison. Generic competitor categories only — no product names.
 */
export interface ComparisonRow {
  attribute: string
  zvia: string
  sshGuis: string
  dashboards: string
}

export const COMPARISON_HEADINGS = {
  zvia: 'Zvia',
  sshGuis: 'SSH clients',
  dashboards: 'Self-hosted dashboards'
} as const

export const COMPARISON_ROWS: ComparisonRow[] = [
  {
    attribute: 'Runs on',
    zvia: 'macOS · Windows · Linux',
    sshGuis: 'Desktop or web',
    dashboards: 'Browser, self-hosted'
  },
  {
    attribute: 'Agent on server',
    zvia: 'None — standard SSH',
    sshGuis: 'None',
    dashboards: 'Install a daemon / agent'
  },
  {
    attribute: 'Credentials',
    zvia: 'OS keychain only — nothing stored',
    sshGuis: 'Stored in the app or its cloud',
    dashboards: 'Stored on the panel itself'
  },
  {
    attribute: 'Deployment topology',
    zvia: 'Automatic, evidence-backed',
    sshGuis: '—',
    dashboards: '—'
  },
  {
    attribute: 'Tagged snapshots & diff',
    zvia: 'Per-deployment, before/after',
    sshGuis: '—',
    dashboards: '—'
  },
  {
    attribute: 'License & cost',
    zvia: 'MIT — free',
    sshGuis: 'Proprietary / freemium',
    dashboards: 'Open, but you host it'
  }
] as const
