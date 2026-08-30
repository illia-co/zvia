export interface DocNavItem {
  id: string
  label: string
}

export interface DocNavGroup {
  label: string
  items: DocNavItem[]
}

export interface DocBlock {
  type: 'paragraph' | 'list' | 'subheading'
  content: string | string[]
}

export interface DocSection {
  id: string
  eyebrow?: string
  title: string
  blocks: DocBlock[]
}

export const DOC_NAV: DocNavGroup[] = [
  {
    label: 'Start',
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'getting-started', label: 'Getting started' },
      { id: 'updates', label: 'Updating Zvia' }
    ]
  },
  {
    label: 'Core concepts',
    items: [
      { id: 'servers', label: 'Servers & connection' },
      { id: 'workspace', label: 'Workspace' },
      { id: 'keyboard-shortcuts', label: 'Keyboard shortcuts' }
    ]
  },
  {
    label: 'Tools',
    items: [
      { id: 'tool-overview', label: 'Overview' },
      { id: 'tool-stats', label: 'Stats' },
      { id: 'tool-users', label: 'Users' },
      { id: 'tool-processes', label: 'Processes' },
      { id: 'tool-packages', label: 'Packages' },
      { id: 'tool-logs', label: 'Logs' },
      { id: 'tool-terminal', label: 'Terminal' },
      { id: 'tool-files', label: 'Files' },
      { id: 'tool-docker', label: 'Docker' },
      { id: 'tool-ports', label: 'Ports' },
      { id: 'tool-nginx', label: 'Nginx' },
      { id: 'tool-ssl', label: 'SSL' },
      { id: 'tool-services', label: 'Services' },
      { id: 'tool-cron', label: 'Cron' }
    ]
  },
  {
    label: 'Infrastructure',
    items: [
      { id: 'architecture', label: 'Architecture' },
      { id: 'security', label: 'Security' },
      { id: 'requirements', label: 'Requirements' }
    ]
  }
]

export const DOC_SECTIONS: DocSection[] = [
  {
    id: 'introduction',
    eyebrow: 'Documentation',
    title: 'Zvia documentation',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Zvia is a native desktop application for managing remote Linux servers over SSH. It provides a calm, server-scoped workspace for system administration — stats, logs, Docker, Nginx, SSL, systemd, files, and a full terminal — without installing a custom agent on the remote machine.'
      },
      {
        type: 'paragraph',
        content:
          'Everything in Zvia is scoped to the server you select. When Production is selected, every tool, panel, and command operates on Production. There are no global fleet views in the current release.'
      },
      {
        type: 'list',
        content: [
          'Select a server from the left sidebar',
          'Choose a tool from the server navigation',
          'Work in the workspace — open, split, and resize panels as needed'
        ]
      }
    ]
  },
  {
    id: 'getting-started',
    eyebrow: 'Start',
    title: 'Getting started',
    blocks: [
      {
        type: 'subheading',
        content: 'Install Zvia'
      },
      {
        type: 'paragraph',
        content:
          'Download Zvia for macOS or Windows from the landing page. Linux builds are also available as AppImage or deb packages. See Requirements for minimum system specs before installing. For updates after installation, see Updating Zvia.'
      },
      {
        type: 'subheading',
        content: 'macOS: "damaged" or blocked on first open'
      },
      {
        type: 'paragraph',
        content:
          'Zvia is not distributed through the Mac App Store and is not yet notarized with an Apple Developer ID. macOS may block the app after download and show a message like "Zvia is damaged and can\'t be opened." The app is not actually corrupted — Gatekeeper is rejecting an unsigned download.'
      },
      {
        type: 'list',
        content: [
          'Open the .dmg, drag Zvia to Applications, then run: xattr -cr /Applications/Zvia.app',
          'Alternatively, right-click Zvia in Applications and choose Open (confirm once in the dialog)',
          'If needed, open System Settings → Privacy & Security and click Open Anyway next to the Zvia prompt'
        ]
      },
      {
        type: 'subheading',
        content: 'Add a server'
      },
      {
        type: 'paragraph',
        content:
          'Open the server sidebar and add a connection profile with a display name, hostname, SSH username, port (default 22), and authentication method.'
      },
      {
        type: 'list',
        content: [
          'SSH agent — uses keys already loaded in your system SSH agent',
          'Key file — path to a private key on disk, with an optional passphrase stored in the OS credential store'
        ]
      },
      {
        type: 'subheading',
        content: 'Connect and work'
      },
      {
        type: 'paragraph',
        content:
          'Select the server, then connect. Zvia shows connection state clearly — disconnected, connecting, connected, reconnecting, or error. Pick a tool from the sidebar or press a keyboard shortcut to open a panel in the workspace.'
      }
    ]
  },
  {
    id: 'updates',
    eyebrow: 'Start',
    title: 'Updating Zvia',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Zvia does not check for or install updates automatically. When a new version is released, download the latest installer from the Zvia website or GitHub Releases and install it over your existing copy.'
      },
      {
        type: 'subheading',
        content: 'Where to get new versions'
      },
      {
        type: 'list',
        content: [
          'GitHub Releases — https://github.com/illia-co/zvia/releases',
          'Zvia landing page — use the Download button and pick macOS or Windows'
        ]
      },
      {
        type: 'subheading',
        content: 'How to update'
      },
      {
        type: 'list',
        content: [
          'macOS — download the new .dmg or .zip, quit Zvia, then drag the app into Applications (or replace the existing app)',
          'Windows — download the new installer (.exe) and run it, or replace the portable build if you use that format',
          'Linux — download the new AppImage or .deb and install it over the previous version'
        ]
      },
      {
        type: 'subheading',
        content: 'What is preserved'
      },
      {
        type: 'paragraph',
        content:
          'Server profiles and saved connection settings are stored locally in your user data folder and are kept when you install a newer version on the same machine. You do not need to re-add servers after updating.'
      },
      {
        type: 'subheading',
        content: 'Checking your version'
      },
      {
        type: 'paragraph',
        content:
          'Compare the version shown in the app (or the release tag on GitHub, e.g. v0.1.0-beta) with the latest release on GitHub. If they match, you are up to date.'
      }
    ]
  },
  {
    id: 'servers',
    eyebrow: 'Core concepts',
    title: 'Servers & connection',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Each server is a persistent connection profile stored locally. Profiles include identity (name, hostname, username, port) and authentication settings. Private keys and passphrases never reach the renderer process.'
      },
      {
        type: 'subheading',
        content: 'Connection states'
      },
      {
        type: 'list',
        content: [
          'Disconnected — no active SSH session',
          'Connecting — handshake in progress',
          'Connected — ready for tools and terminal',
          'Reconnecting — restoring a dropped session',
          'Error — connection failed; retry from the error surface'
        ]
      },
      {
        type: 'subheading',
        content: 'Host key verification'
      },
      {
        type: 'paragraph',
        content:
          'On first connect to a host, Zvia prompts you to accept or reject the SSH host key. If a known host key changes, Zvia warns you before proceeding — the same trust model as OpenSSH.'
      },
      {
        type: 'subheading',
        content: 'Remote requirements'
      },
      {
        type: 'paragraph',
        content:
          'The remote machine remains a normal Linux server. Zvia connects with standard SSH, SFTP, and remote command execution. No Zvia agent or custom daemon is required on the VPS.'
      }
    ]
  },
  {
    id: 'workspace',
    eyebrow: 'Core concepts',
    title: 'Workspace',
    blocks: [
      {
        type: 'paragraph',
        content:
          'The workspace is the main area where tools open as panels. You can open multiple panels, focus between them, split the layout, and close panels you no longer need. Each server has its own workspace state — switching servers switches context entirely.'
      },
      {
        type: 'subheading',
        content: 'Panels and tabs'
      },
      {
        type: 'list',
        content: [
          'Open a tool from the server sidebar or command palette',
          'Split panels horizontally or vertically to compare views',
          'Focus a panel to send keyboard input and shortcuts to it',
          'Close the focused panel with the keyboard shortcut or tab control'
        ]
      },
      {
        type: 'subheading',
        content: 'Command palette'
      },
      {
        type: 'paragraph',
        content:
          'Press ⌘K on macOS or Ctrl+K on Windows and Linux to open the command palette. Search for tools and actions without leaving the keyboard.'
      }
    ]
  },
  {
    id: 'keyboard-shortcuts',
    eyebrow: 'Core concepts',
    title: 'Keyboard shortcuts',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Zvia is keyboard-friendly. Shortcuts use ⌘ on macOS and Ctrl on Windows and Linux unless noted otherwise.'
      },
      {
        type: 'list',
        content: [
          '⌘K / Ctrl+K — open command palette',
          '⌘W / Ctrl+W — close focused panel',
          '⌘1–⌘9 — open Overview through Docker',
          '⌘0 — open Ports',
          '⌘⇧L / Ctrl+Shift+L — cycle appearance preference'
        ]
      }
    ]
  },
  {
    id: 'tool-overview',
    eyebrow: 'General',
    title: 'Overview',
    blocks: [
      {
        type: 'paragraph',
        content:
          'The Overview tool is the starting point for a connected server. It shows server identity, connection status, and key system facts — hostname, OS, kernel, uptime, and a summary of resource health.'
      }
    ]
  },
  {
    id: 'tool-stats',
    eyebrow: 'System',
    title: 'Stats',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Stats provides live CPU, memory, disk, and network metrics for the selected server. Use it to understand load and capacity without running manual commands.'
      }
    ]
  },
  {
    id: 'tool-users',
    eyebrow: 'System',
    title: 'Users',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Manage Linux user accounts from a structured panel. View users and groups, inspect account details, and perform common administration tasks such as creating users, editing properties, and managing SSH authorized keys where supported.'
      }
    ]
  },
  {
    id: 'tool-processes',
    eyebrow: 'System',
    title: 'Processes',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Inspect running processes with live CPU and memory usage. Filter and sort the process list, open detail views, and send signals when you need to stop or restart a process.'
      }
    ]
  },
  {
    id: 'tool-packages',
    eyebrow: 'System',
    title: 'Packages',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Search, install, update, and remove system packages. Zvia detects the package manager on Debian and Ubuntu systems (apt) and surfaces installed packages, available updates, and search results in dedicated tabs.'
      }
    ]
  },
  {
    id: 'tool-logs',
    eyebrow: 'System',
    title: 'Logs',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Stream journal logs from systemd via journalctl. Apply filters by unit, priority, and time range, and follow logs in real time while troubleshooting.'
      }
    ]
  },
  {
    id: 'tool-terminal',
    eyebrow: 'Workspace',
    title: 'Terminal',
    blocks: [
      {
        type: 'paragraph',
        content:
          'A full interactive SSH shell embedded in the workspace. Zvia allocates a PTY on the remote host so programs like vim, htop, and interactive prompts behave as they would in a native terminal. Terminal sessions are server-scoped and tied to the active SSH connection.'
      }
    ]
  },
  {
    id: 'tool-files',
    eyebrow: 'Workspace',
    title: 'Files',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Browse the remote filesystem over SFTP. Navigate directories, preview and edit text files, upload and download files, and perform common file operations without leaving the server context.'
      }
    ]
  },
  {
    id: 'tool-docker',
    eyebrow: 'Containers',
    title: 'Docker',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Manage Docker on the remote host through the Docker CLI over SSH. Inspect containers, images, volumes, and networks; view container logs; exec into running containers; and perform start, stop, and remove actions from structured panels.'
      }
    ]
  },
  {
    id: 'tool-ports',
    eyebrow: 'Network',
    title: 'Ports',
    blocks: [
      {
        type: 'paragraph',
        content:
          'See which ports are listening on the server and which processes own them. Manage firewall rules where supported, with detail views for individual port bindings.'
      }
    ]
  },
  {
    id: 'tool-nginx',
    eyebrow: 'Network',
    title: 'Nginx',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Inspect Nginx status and configuration on the server. Browse the config tree, validate configuration before reload, reload the service, and stream access or error logs from the panel.'
      }
    ]
  },
  {
    id: 'tool-ssl',
    eyebrow: 'Network',
    title: 'SSL',
    blocks: [
      {
        type: 'paragraph',
        content:
          'View TLS certificates installed on the server. Enable HTTPS through Certbot when available, inspect certificate details and expiry, and manage automatic renewal settings.'
      }
    ]
  },
  {
    id: 'tool-services',
    eyebrow: 'Daemons',
    title: 'Services',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Manage systemd units — start, stop, restart, enable, and disable services. Open unit detail views and jump to related logs when diagnosing service failures.'
      }
    ]
  },
  {
    id: 'tool-cron',
    eyebrow: 'Daemons',
    title: 'Cron',
    blocks: [
      {
        type: 'paragraph',
        content:
          'View and edit cron schedules on the server. Inspect crontab entries per user or system source and manage scheduled tasks from a structured editor.'
      }
    ]
  },
  {
    id: 'architecture',
    eyebrow: 'Infrastructure',
    title: 'Architecture',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Zvia is an Electron application with a clear separation between UI and remote access. The renderer process handles React UI and state; the main process owns SSH connections, credential access, and command execution.'
      },
      {
        type: 'subheading',
        content: 'Communication flow'
      },
      {
        type: 'list',
        content: [
          'Renderer — React UI, Zustand state, workspace layout',
          'Preload bridge — typed IPC surface exposed as window.zvia',
          'Main process — connection manager, services, SSH2 client',
          'Remote server — standard SSH, SFTP, PTY, and Linux commands'
        ]
      },
      {
        type: 'subheading',
        content: 'Services'
      },
      {
        type: 'paragraph',
        content:
          'Each tool maps to a main-process service that runs validated commands over SSH. Stats, logs, Docker, Nginx, SSL, ports, users, processes, packages, systemd, and cron each have dedicated parsers that turn command output into typed data for the UI. Connection loss clears per-server caches and closes active streams.'
      }
    ]
  },
  {
    id: 'security',
    eyebrow: 'Infrastructure',
    title: 'Security',
    blocks: [
      {
        type: 'paragraph',
        content:
          'Zvia follows Electron security best practices for a desktop SSH client.'
      },
      {
        type: 'list',
        content: [
          'Private SSH keys and passphrases stay in the main process — the renderer never receives raw key material',
          'Passphrases are stored with Electron safeStorage (macOS Keychain, Windows DPAPI, Linux libsecret)',
          'IPC requests are validated before execution in the main process',
          'The terminal is an intentional exception: it provides a fully interactive remote shell via PTY',
          'Host key changes are surfaced explicitly before reconnecting'
        ]
      }
    ]
  },
  {
    id: 'requirements',
    eyebrow: 'Infrastructure',
    title: 'Requirements',
    blocks: [
      {
        type: 'subheading',
        content: 'Install Zvia'
      },
      {
        type: 'paragraph',
        content:
          'Zvia runs on your desktop. You need a 64-bit computer with enough memory and disk space for a native Electron application, plus network access to reach your servers over SSH.'
      },
      {
        type: 'list',
        content: [
          'macOS 13 (Ventura) or later — Intel or Apple Silicon',
          'Windows 10 or later — 64-bit (x64 or ARM64)',
          'Linux — 64-bit Ubuntu, Debian, or Fedora on a supported release (AppImage or deb)',
          '4 GB RAM minimum',
          'About 300 MB free disk space for the application',
          'Outbound network access for SSH (port 22 by default)'
        ]
      },
      {
        type: 'subheading',
        content: 'Desktop platforms'
      },
      {
        type: 'list',
        content: [
          'macOS — primary target; polished native experience (dmg or zip)',
          'Windows — supported cross-platform build (installer or portable)',
          'Linux — AppImage and deb packages from electron-builder'
        ]
      },
      {
        type: 'subheading',
        content: 'Remote server'
      },
      {
        type: 'list',
        content: [
          'Any normal Linux VPS or bare-metal host reachable over SSH',
          'Ubuntu and Debian are the primary targets for package management features',
          'Docker, Nginx, Certbot, and systemd features require the respective tools on the remote host',
          'No Zvia agent or inbound ports beyond SSH'
        ]
      }
    ]
  }
]
