<p align="center">
  <img src="shared/assets/zvia-mark.png" width="72" height="72" alt="Zvia" />
</p>

<h1 align="center">Zvia</h1>

<p align="center">
  See how your applications are wired.
</p>

<p align="center">
  Zvia connects over SSH and automatically discovers each server's deployment topology — nginx → ports → containers → services — then manages stats, logs, Docker, SSL, systemd, files, and a full terminal from one calm, server-scoped desktop app. No agent to install.
</p>

<p align="center">
  <a href="https://github.com/illia-co/zvia/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/illia-co/zvia/ci.yml?branch=main&label=CI" alt="CI" /></a>
  <a href="https://github.com/illia-co/zvia/blob/main/LICENSE"><img src="https://img.shields.io/github/license/illia-co/zvia?label=license" alt="License" /></a>
  <img src="https://img.shields.io/badge/Electron-44-47848F?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black" alt="React" />
  <br />
  <img src="https://img.shields.io/badge/platform-macOS-000000?logo=apple&logoColor=white" alt="macOS" />
  <img src="https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white" alt="Windows" />
  <img src="https://img.shields.io/badge/platform-Linux-FCC624?logo=linux&logoColor=black" alt="Linux" />
  <img src="https://img.shields.io/badge/SSH-SFTP%20%7C%20PTY-555" alt="SSH" />
  <img src="https://img.shields.io/badge/agent-none-555" alt="No remote agent" />
</p>

<p align="center">
  <a href="https://github.com/illia-co/zvia/releases"><strong>Download</strong></a>
  ·
  <a href="./docs/README.md">Documentation</a>
  ·
  <a href="https://github.com/illia-co/zvia/issues">Issues</a>
  ·
  <a href="https://github.com/illia-co/zvia/blob/main/CONTRIBUTING.md">Contributing</a>
</p>

<br />

<p align="center">
  <img src="landing/src/assets/screenshots/deployments-topology.png" width="880" alt="Zvia deployment topology canvas showing nginx, ports, and container connections" />
</p>

<br />

## Why Zvia

Most server work still means juggling a terminal, SFTP client, Docker CLI, `journalctl`, and a dozen tabs — with no clear sense of **which server** you're on.

Zvia replaces that sprawl with one native desktop workspace:

| | |
|---|---|
| **Server-scoped** | Select Production → every tool operates on Production. No accidental cross-server context. |
| **Real SSH** | Standard SSH, SFTP, and PTY. No agent to install on the remote host. |
| **Native feel** | Calm, monochrome UI inspired by macOS utilities — not a web dashboard in a window. |
| **One workspace** | Open, split, and resize panels. Terminal and file browser live beside structured tools. |

<br />

## Automatic deployment detection

The **Deployments** tool is where Zvia starts. Instead of guessing what runs on a server, it scans the machine and reconstructs how each application is wired — automatically, on the server you selected, with no agent to install.

<p align="center">
  <img src="landing/src/assets/screenshots/deployments.png" width="880" alt="Zvia Deployments panel listing discovered application topologies on a production server" />
</p>

A single scan correlates **nginx → SSL → ports → containers → services** — plus processes and systemd — into per-domain topologies, then explains every connection with evidence:

- **Server-scoped by design** — discovery runs only against the selected server; there are no fleet-wide views.
- **Domain → backend paths** — each deployment is grouped by primary nginx `server_name` and mapped down to its port, systemd service, and container.
- **Dependency mapping** — every relationship ships with its evidence: nginx directives, port bindings, process matches, and Docker output. Confirmed links are drawn solid; likely and unknown links are dashed and dotted, so you always know how confident Zvia is.
- **Container & Compose clustering** — containers sharing a Docker Compose project are grouped into a single visual cluster (`docker_compose_service`) via `member_of` relationships, so even deployments without nginx are discovered.
- **Health that follows the dependency path** — a deployment's status is the worst status along the confirmed path from entrypoint to backend, with per-component chips (SSL, Nginx, Backend, Service, Files, Container).
- **Shared-backend insight** — multiple domains proxying to the same port surface as cross-deployment insights instead of being merged.
- **Interactive topology** — a full-screen canvas with an inspector that shows structured entity details and the evidence behind each connection.

Deployments doubles as an on-demand inventory of every application on the machine — what it is, what it depends on, and why we know.

<br />

## Features

<p>
  <img src="https://img.shields.io/badge/Deployments-topology%20discovery-333?style=flat-square" alt="Deployments" />
  <img src="https://img.shields.io/badge/Overview-server%20identity-333?style=flat-square" alt="Overview" />
  <img src="https://img.shields.io/badge/Stats-live%20metrics-333?style=flat-square" alt="Stats" />
  <img src="https://img.shields.io/badge/Users-accounts%20%26%20keys-333?style=flat-square" alt="Users" />
  <img src="https://img.shields.io/badge/Processes-signals-333?style=flat-square" alt="Processes" />
  <img src="https://img.shields.io/badge/Packages-apt-333?style=flat-square" alt="Packages" />
  <img src="https://img.shields.io/badge/Logs-journalctl-333?style=flat-square" alt="Logs" />
  <br />
  <img src="https://img.shields.io/badge/Terminal-full%20SSH%20shell-333?style=flat-square" alt="Terminal" />
  <img src="https://img.shields.io/badge/Files-SFTP-333?style=flat-square" alt="Files" />
  <img src="https://img.shields.io/badge/Docker-containers-333?style=flat-square" alt="Docker" />
  <img src="https://img.shields.io/badge/Ports-firewall-333?style=flat-square" alt="Ports" />
  <img src="https://img.shields.io/badge/Nginx-config-333?style=flat-square" alt="Nginx" />
  <img src="https://img.shields.io/badge/SSL-certificates-333?style=flat-square" alt="SSL" />
  <img src="https://img.shields.io/badge/Services-systemd-333?style=flat-square" alt="Services" />
  <img src="https://img.shields.io/badge/Cron-schedules-333?style=flat-square" alt="Cron" />
</p>

**15 tools** across seven groups — all scoped to the server you selected:

| Section | Tools |
|---------|-------|
| Applications | **Deployments** |
| General | Overview |
| System | Stats · Users · Processes · Packages · Logs |
| Workspace | Terminal · Files |
| Containers | Docker |
| Network | Ports · Nginx · SSL |
| Daemons | Services · Cron |

<br />

## How it works

```
Select server  →  Select tool  →  Work in the workspace
```

1. **Add a server** — hostname, user, port, SSH key or agent.
2. **Connect** — Zvia shows connection state clearly and verifies host keys.
3. **Discover** — Deployments opens automatically and scans the server, mapping each application from domain to backend.
4. **Work** — split panels, stream logs, edit files, run commands — without leaving server context.

<br />

## Screenshots

<table>
  <tr>
    <td width="50%">
      <img src="landing/src/assets/screenshots/deployments-topology.png" alt="Deployments topology canvas" />
      <br /><sub><b>Deployments</b> — automatic topology discovery from domain to backend</sub>
    </td>
    <td width="50%">
      <img src="landing/src/assets/screenshots/deployments-inspector.png" alt="Deployments inspector" />
      <br /><sub><b>Deployments inspector</b> — evidence-backed relationships and dependencies</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="landing/src/assets/screenshots/docker.png" alt="Docker panel" />
      <br /><sub><b>Docker</b> — containers, images, logs, exec</sub>
    </td>
    <td width="50%">
      <img src="landing/src/assets/screenshots/nginx.png" alt="Nginx panel" />
      <br /><sub><b>Nginx</b> — config, validation, reload, logs</sub>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <img src="landing/src/assets/screenshots/logs.png" alt="Logs panel" />
      <br /><sub><b>Logs</b> — journalctl with filters and live follow</sub>
    </td>
    <td width="50%">
      <img src="landing/src/assets/screenshots/stats.png" alt="Stats panel" />
      <br /><sub><b>Stats</b> — CPU, memory, disk, network</sub>
    </td>
  </tr>
</table>

<br />

## Download

Zvia is available for **macOS** and **Windows**. Linux builds (AppImage, deb) are also produced by electron-builder.

Download the latest release from **[GitHub Releases](https://github.com/illia-co/zvia/releases)**.

### macOS install note

Zvia is not notarized yet. After downloading the `.dmg`, if macOS says the app is **damaged** or refuses to open it, run:

```bash
xattr -cr /Applications/Zvia.app
```

Then open Zvia from Applications (or right-click → **Open** the first time). This removes the download quarantine flag — the app is not actually corrupted.

Zvia does not auto-update yet. To update manually, download a newer release from GitHub and install over your existing copy. Server profiles are preserved on the same machine.

<br />

## Development

**Requirements:** Node.js 20+, npm 10+

```bash
git clone https://github.com/illia-co/zvia.git
cd zvia
npm install
npm run dev          # Electron app
npm run dev:landing  # Marketing site
```

```bash
npm run typecheck    # TypeScript
npm test             # Vitest
npm run build        # Build app
npm run build:landing
```

Package for distribution:

```bash
npm run dist:mac -w @zvia/app
npm run dist:win -w @zvia/app
npm run dist:linux -w @zvia/app
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for pull request guidelines, [AGENTS.md](./AGENTS.md) for product rules, and [docs/README.md](./docs/README.md) for the full documentation index.

<details>
<summary><strong>Repository structure</strong></summary>

<br />

```
/
├── app/          # Electron application (@zvia/app)
│   └── docs/     # Architecture, tools, roadmap
├── landing/      # Marketing site (@zvia/landing)
│   └── docs/     # Product vision
├── shared/       # Design tokens and brand assets
│   └── docs/     # Design language and UI rules
├── docs/         # Documentation index
└── package.json
```

</details>

<details>
<summary><strong>Architecture</strong></summary>

<br />

```
Renderer (React) → Preload (window.zvia) → Main (IPC) → SSH → Remote server
```

- Every IPC request requires a `serverId`
- SSH credentials never reach the renderer
- Passphrases stored via Electron `safeStorage` (OS keychain)

</details>

<details>
<summary><strong>Keyboard shortcuts</strong></summary>

<br />

| Shortcut | Action |
|----------|--------|
| `⌘/Ctrl+K` | Command palette |
| `⌘/Ctrl+W` | Close focused panel |
| `⌘/Ctrl+1–9` | Open tools by sidebar position |
| `⌘/Ctrl+0` | Open Ports |
| `⌘/Ctrl+Shift+L` | Cycle theme |

</details>

<br />

## Security

Zvia is an SSH client with a rich UI. Private keys stay in the main process; the renderer never receives raw key material.

Report vulnerabilities responsibly — see [SECURITY.md](./SECURITY.md).

<br />

## License

[MIT](./LICENSE) © 2026 Zvia contributors
