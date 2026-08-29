# Relay Functional Requirements

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

Display:

- server name
- hostname
- OS
- OS version
- architecture
- uptime
- CPU
- memory
- disk
- network

Overview must never aggregate multiple servers.

---

# Stats

Display live:

CPU:

- usage
- cores
- load average

Memory:

- used
- available
- total
- swap

Disk:

- filesystem
- used
- available
- percentage

Network:

- RX
- TX

---

# Logs

Requirements:

- stream logs
- pause
- resume
- search
- filter
- time range
- severity
- service/unit
- clear
- copy
- jump to latest

Performance:

- virtualized list
- bounded memory
- incremental streaming

---

# Terminal

Must support:

- interactive shell
- sudo
- apt
- vim
- nano
- top
- htop
- Docker
- arbitrary commands
- ANSI
- colors
- Unicode
- resize
- Ctrl+C
- Ctrl+D
- Ctrl+Z
- tab completion

Terminal should support multiple sessions.

---

# Files

Requirements:

- browse
- breadcrumbs
- list
- sorting
- create directory
- create file
- rename
- move
- copy
- delete
- upload
- download
- drag/drop
- permissions
- file size
- modified date

File operations should provide progress for large transfers.

Destructive operations require confirmation.

---

# Docker

## Containers

Display:

- name
- status
- image
- ports
- created
- uptime
- CPU
- memory

Actions:

- start
- stop
- restart
- remove
- inspect
- logs
- exec terminal

## Images

Display:

- repository
- tag
- ID
- size
- created

Actions:

- remove

## Volumes

Display:

- name
- driver
- mount information

Actions:

- inspect
- remove

## Networks

Display:

- name
- driver
- scope
- containers

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
