# Relay Roadmap

## Phase 1 — Foundation

- Electron app
- React
- TypeScript
- macOS window
- application shell
- server profiles
- SSH connection
- secure credential handling

---

## Phase 2 — Workspace

- server sidebar
- tool sidebar
- workspace
- tabs
- split panes
- panel resizing
- command palette

---

## Phase 3 — Terminal

- xterm.js
- SSH PTY
- resize
- multiple sessions
- reconnect
- terminal persistence

Terminal quality is critical.

---

## Phase 4 — Files

- SFTP
- directory navigation
- breadcrumbs
- list view
- file operations
- upload/download
- drag/drop
- editor

---

## Phase 5 — Stats

- CPU
- memory
- disk
- network
- uptime
- OS information

---

## Phase 6 — Logs

- journal streaming
- search
- filters
- live mode
- pause
- resume
- virtualization

---

## Phase 7 — Docker

- containers
- images
- volumes
- networks
- container logs
- container exec
- start/stop/restart

---

# Explicitly Out of MVP

Do not implement:

- Nginx manager
- SSL manager
- PostgreSQL UI
- Redis UI
- Kubernetes
- firewall
- user administration
- cloud APIs
- deployment automation
- monitoring alerts
- fleet-wide dashboards

These belong to future versions.

---

# Quality Bar

Before calling MVP complete:

## Terminal

It must be possible to:

    ssh into server
    sudo
    apt install
    vim
    nano
    htop
    docker
    long-running processes

without unexpected behavior.

## Files

Large files must transfer reliably.

## Logs

Large log streams must not freeze the UI.

## Docker

Docker operations must clearly reflect the remote server.

## Connection

Temporary network failures must recover gracefully.

## UX

The application must feel like a native Mac application.

---

# Product Principle

Reliability beats feature count.

A small application that makes:

    SSH
    Files
    Logs
    Docker
    Stats

feel fantastic is better than a huge application with unreliable features.
