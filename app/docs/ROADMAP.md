# Relay Roadmap

## Shipped

### Foundation

- Electron app, React, TypeScript
- Server profiles, SSH connection, secure credentials
- macOS, Windows, and Linux packaging via electron-builder

### Workspace

- Server sidebar, tool sidebar, workspace
- Tabs, split panes, panel resizing, command palette

### Tools (14)

- **General:** Overview
- **System:** Stats, Users, Processes, Packages, Logs
- **Workspace:** Terminal, Files
- **Containers:** Docker
- **Network:** Ports, Nginx, SSL
- **Daemons:** Services, Cron

### Landing

- Marketing site with documentation page (`/documentation`)

---

## In progress / next

- GitHub Releases distribution pipeline
- Code signing and notarization (macOS)
- In-app auto-update (optional future phase)

---

## Future (not planned for current release)

- Fleet management across servers
- Kubernetes
- Database administration UIs
- Cloud API integrations
- Deployment automation
- Monitoring alerts and paging
- Server provisioning

---

## Quality bar

**Terminal** — interactive SSH PTY: sudo, apt, vim, htop, docker CLI, long-running processes.

**Files** — reliable SFTP transfers for large files.

**Logs** — streaming and virtualization without freezing the UI.

**Docker** — reflects the remote server's actual state.

**Connection** — graceful reconnect after network failures.

**UX** — native, calm, server context always visible.

---

## Product principle

Reliability beats feature count. A focused server-scoped workspace that feels excellent beats a sprawling unreliable dashboard.
