# Tool specifications

Each tool operates on the **currently selected server** only. There are no cross-server or fleet views.

| ID | Tool | Spec |
|----|------|------|
| `overview` | Overview | [overview.md](./overview.md) |
| `stats` | Stats | [stats.md](./stats.md) |
| `users` | Users | [users.md](./users.md) |
| `processes` | Processes | [processes.md](./processes.md) |
| `packages` | Packages | [packages.md](./packages.md) |
| `logs` | Logs | [logs.md](./logs.md) |
| `terminal` | Terminal | [terminal.md](./terminal.md) |
| `files` | Files | [files.md](./files.md) |
| `docker` | Docker | [docker.md](./docker.md) |
| `ports` | Ports | [ports.md](./ports.md) |
| `nginx` | Nginx | [nginx.md](./nginx.md) |
| `ssl` | SSL | [ssl.md](./ssl.md) |
| `services` | Services | [services.md](./services.md) |
| `cron` | Cron | [cron.md](./cron.md) |

Implementation entry points:

- Tool registry: `app/src/renderer/lib/tools.ts`
- Tool panels: `app/src/renderer/tools/`
- Main-process services: `app/src/main/services/`
