# App documentation

Documentation for the Electron desktop application (`@relay/app`).

## Core

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Main/renderer/preload, IPC, SSH, and services |
| [FUNCTIONALITY.md](./FUNCTIONALITY.md) | Functional requirements across the app |
| [ROADMAP.md](./ROADMAP.md) | Delivery phases and future scope |

## Tools

Per-tool specifications for the 14 server-scoped tools:

| Section | Tools |
|---------|-------|
| General | [Overview](./tools/overview.md) |
| System | [Stats](./tools/stats.md) · [Users](./tools/users.md) · [Processes](./tools/processes.md) · [Packages](./tools/packages.md) · [Logs](./tools/logs.md) |
| Workspace | [Terminal](./tools/terminal.md) · [Files](./tools/files.md) |
| Containers | [Docker](./tools/docker.md) |
| Network | [Ports](./tools/ports.md) · [Nginx](./tools/nginx.md) · [SSL](./tools/ssl.md) |
| Daemons | [Services](./tools/services.md) · [Cron](./tools/cron.md) |

See [tools/README.md](./tools/README.md) for the full index.

## Code layout

```
app/src/
├── shared/     IPC contracts, validators, types
├── main/       SSH, services, IPC handlers
├── preload/    window.relay bridge
└── renderer/   React UI, stores, tools/
```

## Archive

| Document | Description |
|----------|-------------|
| [archive/instructions.md](./archive/instructions.md) | Original spec-generation prompt (historical) |
