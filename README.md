<p align="center">
  <img src="shared/assets/relay-mark.png" width="72" height="72" alt="Relay" />
</p>

<h1 align="center">Relay</h1>

<p align="center">
  A native workspace for your Linux servers.
</p>

<p align="center">
  Connect over SSH and manage everything from one calm, server-scoped desktop app — stats, logs, Docker, Nginx, SSL, systemd, files, and a full terminal.
</p>

<p align="center">
  <a href="https://github.com/illia-co/relay/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/illia-co/relay/ci.yml?branch=main&label=CI" alt="CI" /></a>
  <a href="https://github.com/illia-co/relay/blob/main/LICENSE"><img src="https://img.shields.io/github/license/illia-co/relay?label=license" alt="License" /></a>
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
  <a href="https://github.com/illia-co/relay/releases"><strong>Download</strong></a>
  ·
  <a href="./docs/README.md">Documentation</a>
  ·
  <a href="https://github.com/illia-co/relay/issues">Issues</a>
  ·
  <a href="https://github.com/illia-co/relay/blob/main/CONTRIBUTING.md">Contributing</a>
</p>

<br />

<p align="center">
  <img src="landing/src/assets/screenshots/overview.png" width="880" alt="Relay overview panel showing server identity, connection status, and system metrics" />
</p>

<br />

## Why Relay

Most server work still means juggling a terminal, SFTP client, Docker CLI, `journalctl`, and a dozen tabs — with no clear sense of **which server** you're on.

Relay replaces that sprawl with one native desktop workspace:

| | |
|---|---|
| **Server-scoped** | Select Production → every tool operates on Production. No accidental cross-server context. |
| **Real SSH** | Standard SSH, SFTP, and PTY. No agent to install on the remote host. |
| **Native feel** | Calm, monochrome UI inspired by macOS utilities — not a web dashboard in a window. |
| **One workspace** | Open, split, and resize panels. Terminal and file browser live beside structured tools. |

<br />

## Features

<p>
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

**14 tools** across six groups — all scoped to the server you selected:

| Section | Tools |
|---------|-------|
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
2. **Connect** — Relay shows connection state clearly and verifies host keys.
3. **Pick a tool** — Overview, Terminal, Docker, or any panel from the sidebar.
4. **Work** — split panels, stream logs, edit files, run commands — without leaving server context.

<br />

## Screenshots

<table>
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

Relay is available for **macOS** and **Windows**. Linux builds (AppImage, deb) are also produced by electron-builder.

Download the latest release from **[GitHub Releases](https://github.com/illia-co/relay/releases)**.

Relay does not auto-update yet. To update manually, download a newer release from GitHub and install over your existing copy. Server profiles are preserved on the same machine.

<br />

## Development

**Requirements:** Node.js 20+, npm 10+

```bash
git clone https://github.com/illia-co/relay.git
cd relay
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
npm run dist:mac -w @relay/app
npm run dist:win -w @relay/app
npm run dist:linux -w @relay/app
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for pull request guidelines and [AGENTS.md](./AGENTS.md) for architecture and product rules.

<details>
<summary><strong>Repository structure</strong></summary>

<br />

```
/
├── app/          # Electron application (@relay/app)
├── landing/      # Marketing site (@relay/landing)
├── shared/       # Design tokens and brand assets
├── docs/         # Contributor documentation
└── package.json
```

</details>

<details>
<summary><strong>Architecture</strong></summary>

<br />

```
Renderer (React) → Preload (window.relay) → Main (IPC) → SSH → Remote server
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

Relay is an SSH client with a rich UI. Private keys stay in the main process; the renderer never receives raw key material.

Report vulnerabilities responsibly — see [SECURITY.md](./SECURITY.md).

<br />

## License

[MIT](./LICENSE) © 2026 Relay contributors
