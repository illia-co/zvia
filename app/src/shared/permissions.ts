/**
 * Capability-based privilege catalog. The app owns the mapping from
 * capability → exact sudoers command lines; the user only toggles
 * capabilities and never types commands. Dynamic parts (config root, unit
 * names) are interpolated at snippet-generation time from server discovery.
 */

export type PermissionDanger = 'low' | 'medium' | 'high' | 'critical'

/** Presentation tier: read-only → service control → operational → root-equivalent. */
export type PermissionCategory =
  | 'read-only'
  | 'service-control'
  | 'operational'
  | 'root-equivalent'

/** Mirrors the privilege granularity: password-sudo can never elevate via `-n`. */
export type SudoKind = 'root' | 'nopasswd' | 'password' | 'none'

export type PermissionGroup =
  | 'Nginx'
  | 'SSL'
  | 'Services'
  | 'Processes'
  | 'Packages'
  | 'Users'
  | 'Firewall'
  | 'Cron'

export interface PermissionCapability {
  id: string
  group: PermissionGroup
  /** Presentation tier driving section order and emphasis. */
  category: PermissionCategory
  label: string
  description: string
  danger: PermissionDanger
  defaultEnabled: boolean
  /**
   * Privileged operations this capability unlocks, as `Service.method`
   * references. Documents the middle layer: capability → operation → the
   * exact sudoers command below.
   */
  operations: string[]
  /**
   * Exact sudoers command specs. `{configRoot}` is replaced with the detected
   * nginx config root; `{units}` expands per chosen unit; `{action}` expands
   * per whitelisted systemctl action.
   */
  commands: string[]
  /** True when the capability needs per-unit selection in the UI. */
  needsUnits?: boolean
  /** Shown instead of a toggle for flows that cannot be tight sudoers lines. */
  terminalOnly?: string
}

/** Whitelisted systemctl actions for unit control. Never arbitrary. */
export const SERVICE_CONTROL_ACTIONS = [
  'start',
  'stop',
  'restart',
  'reload',
  'enable',
  'disable'
] as const

export const PERMISSION_CAPABILITIES: PermissionCapability[] = [
  {
    id: 'nginx.read_config',
    group: 'Nginx',
    category: 'read-only',
    label: 'View Nginx configuration',
    description: 'Read the running Nginx config for topology, SSL linkage and log paths.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['NginxService.getConfigDump', 'NginxService.getConfigTree', 'NginxService.getLogPaths'],
    commands: ['/usr/sbin/nginx -T']
  },
  {
    id: 'nginx.test_config',
    group: 'Nginx',
    category: 'read-only',
    label: 'Test Nginx configuration',
    description: 'Validate configuration with nginx -t before reload. Read-only; may still need root when configs reference root-only files.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['NginxService.validate'],
    commands: ['/usr/sbin/nginx -t']
  },
  {
    id: 'nginx.reload',
    group: 'Nginx',
    category: 'service-control',
    label: 'Reload Nginx',
    description: 'Apply configuration changes without dropping connections. systemctl is the primary mechanism; the direct signal is a fallback for hosts without systemd.',
    danger: 'medium',
    defaultEnabled: true,
    operations: ['NginxService.runAction(reload)'],
    commands: ['/usr/bin/systemctl reload nginx', '/usr/sbin/nginx -s reload']
  },
  {
    id: 'nginx.restart',
    group: 'Nginx',
    category: 'service-control',
    label: 'Restart Nginx',
    description: 'Full service restart. Active connections may be temporarily interrupted.',
    danger: 'medium',
    defaultEnabled: false,
    operations: ['NginxService.runAction(restart)'],
    commands: ['/usr/bin/systemctl restart nginx', '/usr/sbin/service nginx restart']
  },
  {
    id: 'nginx.start_stop',
    group: 'Nginx',
    category: 'service-control',
    label: 'Start and stop Nginx',
    description: 'Start or stop the web server. Sites stop responding while stopped.',
    danger: 'high',
    defaultEnabled: false,
    operations: ['NginxService.runAction(start)', 'NginxService.runAction(stop)'],
    commands: [
      '/usr/bin/systemctl start nginx',
      '/usr/bin/systemctl stop nginx',
      '/usr/sbin/service nginx start',
      '/usr/sbin/service nginx stop'
    ]
  },
  {
    id: 'nginx.write_config',
    group: 'Nginx',
    category: 'root-equivalent',
    label: 'Write Nginx configuration',
    description:
      'Copy staged config files into place with root ownership. Effectively root file write; invalid configs are still gated by nginx -t.',
    danger: 'critical',
    defaultEnabled: false,
    operations: ['NginxService.writeConfig'],
    commands: [
      '/bin/cp -- /tmp/zvia-nginx-* {configRoot}/*',
      '/bin/chmod 644 -- {configRoot}/*'
    ]
  },
  {
    id: 'ssl.read_certificates',
    group: 'SSL',
    category: 'read-only',
    label: 'View SSL certificates',
    description: 'List Certbot certificates and their status on the SSL screen.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['SSLService.runDiscovery'],
    commands: ['/usr/bin/certbot certificates']
  },
  {
    id: 'ssl.inspect_keys',
    group: 'SSL',
    category: 'read-only',
    label: 'Inspect certificate details',
    description:
      'Run one exact read-only openssl inspection per certificate. Flags and the live-dir path pattern are fixed; nothing can be written. Certificates in world-readable paths are inspected without sudo at all.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['SSLService.inspectCertificate'],
    commands: [
      '/usr/bin/openssl x509 -noout -subject -issuer -dates -serial -ext subjectAltName -in /etc/letsencrypt/live/*/fullchain.pem'
    ]
  },
  {
    id: 'ssl.read_renewal',
    group: 'SSL',
    category: 'read-only',
    label: 'View certificate renewal config',
    description: 'Inspect Certbot renewal configuration and schedules.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['SSLService.runDiscovery', 'SSLService.getRenewalLog'],
    commands: ['/bin/ls -1 /etc/letsencrypt/*', '/bin/cat -- /etc/letsencrypt/renewal/*']
  },
  {
    id: 'ssl.read_logs',
    group: 'SSL',
    category: 'read-only',
    label: 'View renewal logs',
    description: 'Read the Certbot renewal log for diagnostics.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['SSLService.getRenewalLog'],
    commands: ['/bin/tail -n 200 /var/log/letsencrypt/letsencrypt.log']
  },
  {
    id: 'ssl.renew',
    group: 'SSL',
    category: 'operational',
    label: 'Renew certificates',
    description: 'Run certbot renew for a certificate chosen in the UI. Requests new certificates from the CA.',
    danger: 'medium',
    defaultEnabled: false,
    operations: ['SSLService.renew', 'SSLService.testRenewal'],
    commands: ['/usr/bin/certbot renew --cert-name *']
  },
  {
    id: 'services.control_unit',
    group: 'Services',
    category: 'service-control',
    label: 'Control selected services',
    description:
      'Whitelisted actions (start, stop, restart, reload, enable, disable) on the units picked below. Protected SSH/network units stay blocked app-side.',
    danger: 'medium',
    defaultEnabled: false,
    operations: ['SystemdService.runAction'],
    commands: ['/usr/bin/systemctl {action} {units}'],
    needsUnits: true
  },
  {
    id: 'process.signal_other',
    group: 'Processes',
    category: 'operational',
    label: 'Signal other users’ processes',
    description:
      'Send TERM/KILL to processes owned by other users, including security software or databases. App-side PID checks are convenience, not a boundary: anyone with this sudoers entry can signal any PID.',
    danger: 'high',
    defaultEnabled: false,
    operations: ['ProcessService.signal'],
    commands: ['/bin/kill -TERM *', '/bin/kill -KILL *']
  },
  {
    id: 'firewall.read',
    group: 'Firewall',
    category: 'read-only',
    label: 'View firewall rules',
    description: 'Read ufw / nftables / iptables rulesets.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['PortService.list'],
    commands: [
      '/usr/sbin/ufw status verbose',
      '/usr/sbin/ufw status numbered',
      '/usr/sbin/nft list ruleset',
      '/usr/sbin/iptables -S'
    ]
  },
  {
    id: 'firewall.write',
    group: 'Firewall',
    category: 'operational',
    label: 'Change firewall rules',
    description:
      'Allow, deny and delete firewall rules. Misconfiguration can lock out SSH; the app-side lockout guards are convenience, not a boundary.',
    danger: 'high',
    defaultEnabled: false,
    operations: ['PortService.setRule', 'PortService.deleteRule'],
    commands: [
      '/usr/sbin/ufw allow *',
      '/usr/sbin/ufw deny *',
      '/usr/sbin/ufw --force delete *'
    ]
  },
  {
    id: 'cron.read_root',
    group: 'Cron',
    category: 'read-only',
    label: 'View root crontab',
    description: 'Read the root crontab source.',
    danger: 'low',
    defaultEnabled: true,
    operations: ['CronService.getSource'],
    commands: ['/usr/bin/crontab -u root -l']
  },
  {
    id: 'cron.write_root',
    group: 'Cron',
    category: 'root-equivalent',
    label: 'Edit root crontab',
    description:
      'Root-equivalent: installs root crontabs, which execute arbitrary commands as root on schedule. Staged through app-generated temp files only.',
    danger: 'critical',
    defaultEnabled: false,
    operations: ['CronService.installCrontab'],
    commands: ['/usr/bin/crontab -u root /tmp/.zvia-crontab-*']
  },
  {
    id: 'packages.manage',
    group: 'Packages',
    category: 'root-equivalent',
    label: 'Install and upgrade packages',
    description:
      'Root-equivalent: package install scripts execute as root, so any package name means arbitrary root code execution. Critical system packages stay warning-gated in the UI. May need SETENV for the noninteractive frontend.',
    danger: 'critical',
    defaultEnabled: false,
    operations: ['PackageService.install', 'PackageService.remove', 'PackageService.upgrade'],
    commands: [
      '/usr/bin/apt-get install *',
      '/usr/bin/apt-get remove *',
      '/usr/bin/apt-get install --only-upgrade *',
      '/usr/bin/apt-get upgrade -y'
    ]
  },
  {
    id: 'users.manage',
    group: 'Users',
    category: 'root-equivalent',
    label: 'Manage users and groups',
    description:
      'Root-equivalent: controls system authentication and authorization (members, shells, locks, passwords). Root, the connected user and system accounts stay blocked app-side.',
    danger: 'critical',
    defaultEnabled: false,
    operations: ['UserService.createUser', 'UserService.deleteUser', 'UserService.setLocked', 'UserService.changeShell', 'UserService.setPassword'],
    commands: [
      '/usr/sbin/useradd *',
      '/usr/sbin/usermod *',
      '/usr/sbin/userdel *',
      '/usr/bin/gpasswd *',
      '/usr/bin/chpasswd *',
      '/usr/bin/install *'
    ]
  }
]

export interface TerminalOnlyFlow {
  id: string
  group: PermissionGroup
  label: string
  reason: string
}

/** Flows that cannot be tight sudoers lines; guided to Terminal instead. */
export const TERMINAL_ONLY_FLOWS: TerminalOnlyFlow[] = [
  {
    id: 'ssl.install',
    group: 'SSL',
    label: 'Install Certbot',
    reason: 'Runs a compound apt-get update && install command that cannot be one sudoers entry.'
  },
  {
    id: 'ssl.enable_https',
    group: 'SSL',
    label: 'Enable HTTPS for a site',
    reason: 'Takes a dynamic domain and email that would need over-broad wildcards.'
  }
]

export const PERMISSION_GROUPS: PermissionGroup[] = [
  'Nginx',
  'SSL',
  'Services',
  'Processes',
  'Packages',
  'Users',
  'Firewall',
  'Cron'
]

export const PERMISSION_CATEGORIES: Array<{
  id: PermissionCategory
  title: string
  blurb: string
}> = [
  { id: 'read-only', title: 'Read-only', blurb: 'Inspect without changing anything.' },
  {
    id: 'service-control',
    title: 'Service control',
    blurb: 'Restart or reload services. Active connections may be interrupted.'
  },
  {
    id: 'operational',
    title: 'Operational',
    blurb: 'Day-to-day changes with mostly reversible effects.'
  },
  {
    id: 'root-equivalent',
    title: 'System administration',
    blurb: 'Effectively root. Only enable for full server administration.'
  }
]

/** Builds the sudoers line for the enabled capabilities. */
export function buildSudoersEntry(
  username: string,
  enabledIds: Set<string>,
  options?: { configRoot?: string | null; units?: string[] }
): string {
  const lines: string[] = []
  for (const capability of PERMISSION_CAPABILITIES) {
    if (!enabledIds.has(capability.id)) continue
    for (const command of capability.commands) {
      if (command.includes('{units}')) {
        const actions = command.includes('{action}') ? [...SERVICE_CONTROL_ACTIONS] : ['']
        for (const unit of options?.units ?? []) {
          const clean = unit.trim()
          if (!clean) continue
          for (const action of actions) {
            lines.push(
              command.replace('{action}', action).replace('{units}', clean)
            )
          }
        }
        continue
      }
      lines.push(command.replace('{configRoot}', options?.configRoot ?? '/etc/nginx'))
    }
  }
  return `${username} ALL=(root) NOPASSWD: ${lines.join(', ')}`
}

/**
 * Matches a `sudo -l` granted entry against a capability command pattern
 * where `*` matches any characters.
 */
export function sudoersEntryMatches(granted: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`).test(granted.trim())
}

/**
 * Parses `sudo -l` output into granted entries. sudo wraps long lines
 * (backslash continuations when piped, plain wrapping otherwise): unfold
 * first, or every grant past the wrap point is silently lost and the
 * capability reads as denied despite being granted.
 */
export function parseSudoListGrants(output: string): string[] {
  const grants: string[] = []
  const unfolded = output.replace(/\\\r?\n[ \t]*/g, '')
  let current: string | null = null
  const flush = (): void => {
    if (current === null) return
    for (const part of current.split(/,\s*/)) {
      const entry = part.trim()
      if (entry) grants.push(entry)
    }
    current = null
  }
  let inList = false
  for (const rawLine of unfolded.split('\n')) {
    const line = rawLine.trim()
    if (/may run the following commands/i.test(line)) {
      inList = true
      continue
    }
    if (!inList || !line) continue
    const match = /^\([^)]*\)\s*(NOPASSWD:\s*)?(.+)$/.exec(line)
    if (match) {
      flush()
      // ponytail: password-gated entries must never count as granted
      if (!/NOPASSWD:/.test(rawLine)) continue
      current = match[2]
    } else if (current !== null) {
      current += ` ${line}`
    }
  }
  flush()
  return grants
}

export interface PrivilegeProbeResult {
  username: string
  isRoot: boolean
  sudoKind: SudoKind
  /** Capability id → true when every command line is granted NOPASSWD. */
  granted: Record<string, boolean>
  /** True when the server grants unrestricted NOPASSWD (`ALL`) — the draft changes nothing. */
  unrestricted: boolean
}
