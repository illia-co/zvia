# Zvia Functional Requirements

> App package documentation. See [tools/](./tools/) for per-tool specifications.

## Server Selection

User can:

- add server
- remove server
- edit server
- connect
- disconnect
- reconnect

Server list displays:

- name
- connection state
- hostname

Selecting a server changes the complete application context.

---

# Overview

See [tools/overview.md](./tools/overview.md).

---

# Stats

See [tools/stats.md](./tools/stats.md).

---

# Logs

See [tools/logs.md](./tools/logs.md).

---

# Terminal

See [tools/terminal.md](./tools/terminal.md).

---

# Files

See [tools/files.md](./tools/files.md).

---

# Docker

See [tools/docker.md](./tools/docker.md).

---

# Users, Processes, Packages

See [tools/users.md](./tools/users.md), [tools/processes.md](./tools/processes.md), [tools/packages.md](./tools/packages.md).

---

# Ports, Nginx, SSL

See [tools/ports.md](./tools/ports.md), [tools/nginx.md](./tools/nginx.md), [tools/ssl.md](./tools/ssl.md).

---

# Services, Cron

See [tools/services.md](./tools/services.md), [tools/cron.md](./tools/cron.md).

---

# Loading

Loading states must be contextual.

Avoid full-screen spinners.

Prefer:

    Connecting…

    Loading containers…

    Reading directory…

    Streaming logs…

---

# Confirmation

Require confirmation for:

- deleting files
- deleting Docker containers
- deleting Docker images
- deleting Docker volumes
- destructive commands initiated through UI

Terminal commands are not intercepted.

The terminal is intentionally unrestricted.

---

# Permissions

The remote user may not have sufficient permissions.

The application must handle:

    Permission denied

gracefully.

Do not automatically escalate privileges.

If sudo is required, let the terminal/user handle it.

---

# Docker Availability

If Docker is missing:

    Docker

    Docker is not available on this server.

    Install Docker from the terminal to enable
    Docker management.

Do not install software automatically.
