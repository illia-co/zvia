# Relay Product Specification

## Vision

Relay is a macOS application that provides a beautiful native interface for working with remote Linux servers.

The goal is to make remote server administration feel as natural as working with a local computer.

Instead of:

    Terminal
    SSH
    scp
    SFTP client
    Docker CLI
    journalctl
    htop
    systemctl

the user gets one coherent workspace.

---

# Core Concept

A server is the primary object.

Everything else belongs to that server.

Example:

    Production
        ├── Overview
        ├── Stats
        ├── Logs
        ├── Terminal
        ├── Files
        └── Docker

Selecting another server changes the entire context.

---

# MVP

## 1. Overview

The Overview panel provides a high-level representation of the selected server.

Display:

- server name
- hostname
- Linux distribution
- Linux version
- architecture
- connection status
- uptime
- CPU
- memory
- disk
- network activity

The Overview should be concise.

It is not intended to replace a monitoring system.

---

# 2. Server Stats

Provide more detailed live statistics.

CPU:

- total usage
- core count
- load average
- per-core usage if practical

Memory:

- total
- used
- available
- swap

Disk:

- filesystem
- total
- used
- available
- percentage

Network:

- received
- transmitted
- interface information

Processes may be shown later but are not required for MVP.

Stats should update periodically.

Do not create unnecessarily expensive polling.

---

# 3. Server Logs

Logs are server-scoped.

The initial implementation should use systemd journal where available.

Example command:

    journalctl

Support:

- live mode
- pause
- search
- filtering
- time filtering
- severity filtering
- service/unit filtering when possible

The UI should be optimized for large streams of logs.

Never load an unlimited amount of logs into React state.

Use:

- streaming
- pagination
- virtualization
- bounded buffers

The user should be able to:

- search
- copy
- pause live output
- resume
- clear filters
- jump to latest

---

# 4. Terminal

The terminal must be a REAL SSH terminal.

This is not a simulated command executor.

It must support:

- interactive shells
- stdin
- stdout
- stderr
- ANSI colors
- cursor movement
- terminal resizing
- Ctrl+C
- Ctrl+D
- Ctrl+Z
- tab completion
- vim
- nano
- top
- htop
- less
- interactive installers
- sudo
- apt
- Docker CLI
- arbitrary Linux commands

Example:

    sudo apt update

must work normally.

Example:

    sudo apt install nginx

must work normally.

Example:

    vim /etc/nginx/nginx.conf

must work normally.

Use xterm.js with a real SSH PTY.

The terminal is one of the most important components of the application.

It must never be treated as a secondary feature.

---

# 5. File Management

The File Manager should feel like a modern Finder-like remote file browser.

It operates over SFTP.

Features:

- browse directories
- back/forward navigation
- breadcrumbs
- list view
- icon view if practical
- file metadata
- sorting
- search within current directory
- create folder
- create file
- rename
- move
- copy
- delete
- upload
- download
- drag and drop
- multi-selection
- permissions display
- file editor

Initial root navigation:

    /

Important directories:

    /etc
    /var
    /home
    /opt
    /tmp
    /usr

The UI should not pretend remote files are local files.

Show remote context clearly.

Example:

    PRODUCTION /etc/nginx/sites-enabled

---

# 6. Docker

Docker is scoped to the selected server.

The Docker view should expose:

    Containers
    Images
    Volumes
    Networks

MVP container functionality:

- list containers
- running/stopped status
- container name
- image
- ports
- uptime
- CPU
- memory
- start
- stop
- restart
- remove
- inspect
- logs
- terminal/exec

Images:

- repository
- tag
- image ID
- size
- created date
- remove

Volumes:

- name
- driver
- mount information
- remove

Networks:

- name
- driver
- scope
- connected containers

Docker functionality should use the remote server's Docker installation.

Do not install Docker automatically.

If Docker is unavailable:

    Docker is not installed on this server.

Provide a clear explanation.

---

# Connection Model

A server profile contains:

- ID
- name
- hostname
- port
- username
- authentication method
- SSH key reference
- optional connection settings

Connection must be tested before the server is considered online.

---

# Error Handling

Errors must be understandable.

Bad:

    Error: ECONNRESET

Better:

    Connection lost

    The SSH connection to Production was interrupted.

    [Reconnect]

Technical details may be available behind:

    Show details

---

# Offline Behavior

When disconnected:

- preserve the UI
- show disconnected state
- disable operations requiring connection
- allow reconnect
- don't silently fail

Never pretend stale information is current.

---

# Future

Possible future modules:

- Nginx
- SSL
- systemd services
- deployment
- databases
- process manager
- firewall
- cron
- server provisioning
- fleet management

Do not implement these in MVP.
