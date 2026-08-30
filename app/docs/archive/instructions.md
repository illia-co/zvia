# Historical: original spec-generation instructions

> **Note:** This file is archived. The project structure has changed. Use the current documentation index at [docs/README.md](../../../docs/README.md).

The paths and file layout described below are **out of date**. Active documentation lives in:

- `AGENTS.md` (repo root)
- `app/docs/`
- `landing/docs/`
- `shared/docs/`

---

Yes. I’d structure this as a small **product specification repository** that you can hand to Claude Code/Codex/Cursor/etc. The important thing is to make the agents understand that this is **not a generic server dashboard** and that **everything is scoped to the currently selected server**.

I’d create these files:

```text
zvia/
├── AGENTS.md
├── PRODUCT.md
├── DESIGN.md
├── ARCHITECTURE.md
├── FUNCTIONALITY.md
├── SECURITY.md
├── ROADMAP.md
└── docs/
    ├── overview.md
    ├── terminal.md
    ├── files.md
    ├── docker.md
    └── logs.md
```

Below is the content for each file.

---

# `AGENTS.md`

```md
# Zvia — Coding Agent Instructions

## Product

Zvia is a native-feeling desktop application for managing remote Linux servers over SSH. macOS is the primary target; Windows and Linux builds are supported.

The product should feel like:

- OrbStack
- Finder
- VS Code
- Notion
- Apple system utilities

It is NOT a traditional web-based DevOps dashboard.

The core interaction model is:

    Select Server
        ↓
    Select Tool
        ↓
    Work in the Workspace

Everything in the application is scoped to the currently selected server.

---

# Critical Product Rule

## Everything is server-scoped

This is one of the most important architectural and UX rules.

If the user selects:

    Production

then every view must operate on Production.

Examples:

- Overview → Production
- Stats → Production
- Logs → Production
- Terminal → Production
- Files → Production
- Docker → Production

There must NOT be global views such as:

- "All Docker containers"
- "All images across servers"
- "All logs"
- "All services"

unless a future feature explicitly introduces a fleet-management mode.

The application should always make the current server obvious.

Example:

    PRODUCTION
    ubuntu@production.example.com
    ● Connected

---

# Current MVP

The first version contains exactly these primary tools:

1. Overview
2. Server Stats
3. Server Logs
4. Terminal
5. File Management
6. Docker

Do not add unnecessary features during MVP development.

Do not implement:

- Kubernetes
- database administration
- Nginx management
- SSL management
- user management
- firewall management
- cloud provisioning
- fleet dashboards
- deployment pipelines

These may come later.

---

# Technology

Preferred stack:

- Electron
- TypeScript
- React
- Vite
- xterm.js
- SSH2
- SFTP over SSH
- Zustand or equivalent lightweight state management
- Tailwind only if it can be configured to produce the intended design language

Avoid unnecessary dependencies.

Prefer well-maintained, focused libraries.

---

# Architecture Principle

The application is fundamentally an SSH client with a rich UI.

The server should NOT require a custom Zvia agent for the MVP.

Communication should happen through:

- SSH
- SSH PTY
- SFTP
- standard Linux commands
- Docker CLI / Docker socket through SSH

The remote server should remain a normal Ubuntu/Linux server.

---

# Security

Never expose raw SSH credentials to the renderer process.

Electron architecture must separate:

    Renderer
        ↓
    IPC
        ↓
    Main process
        ↓
    SSH connection
        ↓
    Remote server

The renderer must never receive private SSH keys.

Use the operating system credential store/keychain where appropriate.

Never execute arbitrary commands directly from renderer IPC without validation.

The terminal is an intentional exception: it must provide a fully interactive SSH shell.

---

# UX Principles

The UI should feel:

- native
- calm
- minimal
- monochrome
- technical
- precise
- responsive
- keyboard-friendly

Avoid:

- generic SaaS dashboards
- excessive cards
- colorful charts
- gradients
- glassmorphism
- excessive rounded rectangles
- huge typography
- unnecessary icons
- visual noise

Use:

- typography
- whitespace
- subtle separators
- floating rounded workspace panels
- monochrome surfaces
- SF Symbols-style iconography
- compact technical information

---

# Workspace Model

The application has three primary areas:

    Servers
    Server Navigation
    Workspace

Conceptually:

    WHERE → WHAT → WORK

Left sidebar:

    Servers

Second sidebar:

    Tools for selected server

Main area:

    Workspace

Workspace panels can be opened, closed, resized and split.

The application should feel similar to VS Code's workspace model, but visually closer to Notion and native macOS applications.

---

# Coding Style

Prefer:

- small composable components
- explicit types
- predictable state
- clear separation between UI and server communication
- testable services
- error handling
- graceful connection failures

Avoid:

- giant components
- global mutable state
- hidden side effects
- business logic inside React components
- coupling UI directly to SSH implementation

---

# Server Connection

A server should be represented as a persistent connection profile.

Example:

    {
      id: "production",
      name: "Production",
      hostname: "203.0.113.10",
      username: "ubuntu",
      port: 22,
      auth: "ssh-agent"
    }

The application should support connection states:

    disconnected
    connecting
    connected
    reconnecting
    error

The UI must clearly communicate connection state.

---

# Important

Do not optimize for feature count.

Optimize for:

1. Reliability
2. Native feeling
3. Excellent terminal
4. Excellent file manager
5. Excellent workspace
6. Server-scoped mental model

Zvia should feel like a serious desktop application, not a web dashboard wrapped in Electron.
```

---

# `PRODUCT.md`

```md
# Zvia Product Specification

## Vision

Zvia is a cross-platform desktop application for managing remote Linux servers over SSH. It provides a native-feeling interface for server administration on macOS, Windows, and Linux.

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
```

---

# `DESIGN.md`

```md
# Zvia Design Language

## Design Goal

Zvia should feel like a native macOS utility created by Apple.

The design combines:

- macOS
- Finder
- Activity Monitor
- Terminal
- Xcode
- VS Code workspace architecture
- Notion's monochrome editorial language
- OrbStack's approachable machine-centric UX

---

# Core Feeling

The application should feel:

    Quiet
    Precise
    Technical
    Premium
    Native
    Calm

It should NOT feel:

    SaaS
    Enterprise dashboard
    Web admin panel
    DevOps control panel
    Docker management website

---

# Visual Language

Primary palette:

Light:

    background: #FFFFFF
    secondary background: #F7F7F7
    primary text: #111111
    secondary text: #777777
    tertiary text: #A0A0A0
    divider: #E8E8E8

Dark:

    background: #111111
    secondary background: #181818
    primary text: #F5F5F5
    secondary text: #999999
    tertiary text: #666666
    divider: #292929

Avoid pure black and pure white for large surfaces where possible.

---

# Color

Color should be extremely restrained.

Status:

    healthy → subtle green
    warning → subtle orange
    error → subtle red

Do not create colorful status badges.

Prefer:

    ● Running

over:

    [ RUNNING ]

---

# Typography

Use SF Pro where possible.

Technical information may use a monospace font.

Examples:

    ubuntu@production

    /etc/nginx/nginx.conf

    systemctl status nginx

    192.168.1.10

Typography should carry hierarchy.

Avoid oversized headings.

---

# Layout

The application uses three major columns.

    Server Sidebar
    Tool Sidebar
    Workspace

Example:

    ┌──────────┬───────────────┬───────────────────────────────┐
    │ Servers  │ Server Tools  │ Workspace                     │
    └──────────┴───────────────┴───────────────────────────────┘

---

# Server Sidebar

The first sidebar answers:

    WHERE?

Example:

    SERVERS

    ● Production
    ● Staging
    ○ Development

This sidebar should be narrow.

Server status is represented with a subtle dot.

---

# Tool Sidebar

The second sidebar answers:

    WHAT?

Example:

    PRODUCTION

    Overview

    System
      Stats
      Logs

    Files
      File Manager

    Containers
      Docker

    Terminal

Navigation is contextual to the selected server.

---

# Workspace

The workspace answers:

    WHAT AM I DOING?

The workspace should resemble VS Code.

Users can:

- open views
- open tabs
- split panels
- resize panels
- close panels
- focus panels

The workspace should not look like one giant dashboard.

---

# Floating Panels

Panels are lightweight surfaces floating inside the workspace.

Use:

- subtle background difference
- small rounded corners
- minimal borders
- extremely subtle shadows
- generous internal spacing

Example:

    ╭──────────────────────────────╮
    │ SERVICES                     │
    │                              │
    │ nginx                  ●     │
    │ postgres               ●     │
    │ redis                  ●     │
    ╰──────────────────────────────╯

Do not make every component a card.

Panels should be used for meaningful workspace units.

---

# Borders

Prefer subtle separators.

Avoid heavy borders.

Do not outline everything.

Whitespace should establish hierarchy.

---

# Radius

Use restrained rounding.

Recommended:

    8px
    10px
    12px

Avoid extreme pill-shaped UI except for small controls where appropriate.

---

# Icons

Use SF Symbols-style icons.

Icons should support hierarchy, not replace text.

Avoid colorful iconography.

---

# Toolbar

Toolbars should be minimal.

Example:

    Production
    ● Connected

                         +    ⌘K

Do not fill the toolbar with controls.

---

# Context

Every major workspace view should clearly identify the current server.

Example:

    Production
    ubuntu@production.example.com

or:

    PRODUCTION /etc/nginx/nginx.conf

The user should never wonder which server they are modifying.

---

# Terminal

Terminal is intentionally dark even in light mode.

It should resemble a premium macOS terminal.

No unnecessary decoration.

---

# File Manager

File Manager should feel closer to Finder than a web file manager.

Use:

- breadcrumbs
- sidebar
- file list
- keyboard navigation
- contextual menus
- drag/drop
- quick preview where practical

---

# Logs

Logs should feel like macOS Console.

Dense but readable.

Use monospace typography.

Avoid giant colorful log cards.

---

# Animations

Animations should be:

- fast
- subtle
- purposeful

Avoid:

- excessive spring animations
- bouncing
- large transitions

Preferred duration:

    100–200ms

---

# Empty States

Empty states should be quiet.

Example:

    No Docker containers

    Docker is installed, but this server currently
    has no containers.

Avoid illustrations unless necessary.

---

# Design Rule

If a component looks like it belongs in a generic SaaS dashboard, redesign it.
```

---

# `ARCHITECTURE.md`

```md
# Zvia Architecture

## High Level

Zvia consists of four major layers:

    UI
      ↓
    Application State
      ↓
    Server Services
      ↓
    SSH / SFTP
      ↓
    Linux Server

---

# Electron

Electron Main Process:

- SSH connections
- SFTP
- PTY
- remote command execution
- server discovery
- metrics collection
- Docker communication
- secure credential access

Electron Renderer:

- UI
- workspace
- navigation
- terminal rendering
- file browser
- logs rendering
- Docker UI

---

# IPC

Never expose SSH libraries directly to the renderer.

Expose explicit operations:

    connectServer()
    disconnectServer()
    getServerInfo()
    getStats()
    executeCommand()
    openTerminal()
    readDirectory()
    uploadFile()
    downloadFile()
    dockerListContainers()
    dockerListImages()
    streamLogs()

IPC should be typed.

---

# SSH Layer

Use one connection manager per server.

Conceptually:

    ServerConnectionManager

        Production
        Staging
        Development

Each connection owns:

- SSH connection
- SFTP client
- PTY sessions
- command sessions
- connection state

---

# Connection Lifecycle

    disconnected
         ↓
    connecting
         ↓
    connected
         ↓
    reconnecting
         ↓
    connected

Failures:

    connected
         ↓
       error
         ↓
    reconnecting

The UI must receive connection-state events.

---

# Terminal

Terminal architecture:

    xterm.js
        ↓
    IPC
        ↓
    Electron Main
        ↓
    SSH PTY
        ↓
    remote shell

PTY dimensions must be synchronized with xterm.js.

Support:

    cols
    rows

Resize events must reach the remote PTY.

---

# SFTP

File manager uses SFTP.

Do not use shell commands for basic file operations when SFTP provides the operation.

Use SFTP for:

- stat
- list
- read
- write
- mkdir
- rename
- delete
- upload
- download

---

# Remote Commands

Shell commands are used for:

- system statistics
- logs
- Docker
- Linux metadata

Commands should be centralized.

Do not scatter shell strings throughout React components.

Example:

    LinuxStatsService
    DockerService
    LogService

---

# Stats

Prefer efficient commands.

Possible sources:

    /proc/stat
    /proc/meminfo
    /proc/loadavg
    df
    ip

Avoid expensive commands every second.

Recommended update interval:

    1–5 seconds

depending on metric.

---

# Logs

Logs should be streamed.

Do not continuously execute:

    journalctl

from scratch.

Use journalctl streaming where available.

Example conceptual command:

    journalctl -f

Support filters.

---

# Docker

Docker commands run remotely.

Possible commands:

    docker ps
    docker ps -a
    docker images
    docker volume ls
    docker network ls

For details:

    docker inspect

For logs:

    docker logs

For terminal:

    docker exec -it

Do not parse human-oriented Docker output if a structured format is available.

Prefer:

    --format
    JSON

where appropriate.

---

# State

Application state should distinguish:

    Connection state
    Server state
    UI state
    Workspace state

Do not mix these together.

Example:

Server state:

    cpu
    memory
    disk

UI state:

    selected server
    selected tool
    open tabs
    split layout

---

# Server Scoping

Every server-related operation must receive a server ID.

Bad:

    getDockerContainers()

Good:

    getDockerContainers(serverId)

Bad:

    getLogs()

Good:

    getLogs(serverId, filters)

This prevents accidental cross-server behavior.

---

# Workspace

Workspace state should support:

- open panels
- tabs
- split panes
- active panel
- panel size

Example:

    Workspace
      ├── Terminal
      ├── nginx.conf
      └── Logs

Future workspaces may be persisted.

---

# Error Model

Errors should be typed.

Examples:

    ConnectionError
    AuthenticationError
    PermissionError
    SFTPError
    CommandError
    DockerUnavailableError

The UI should map technical errors to human-readable messages.
```

---

# `FUNCTIONALITY.md`

```md
# Zvia Functional Requirements

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
```

---

# `SECURITY.md`

```md
# Zvia Security Model

Zvia is a remote server administration application.

Security is critical.

---

# SSH Credentials

Private keys must never be exposed to the renderer.

Use:

- macOS Keychain
- ssh-agent
- secure OS credential storage

Never store private keys in plaintext application state.

Never send private keys through IPC.

---

# Electron Security

Renderer:

- no Node.js integration
- context isolation enabled
- sandbox where practical
- narrow preload API

Do not expose:

    child_process
    fs
    net
    ssh2

directly to renderer.

---

# IPC

IPC APIs must be explicit.

Do not expose:

    executeArbitraryNodeCode()

Prefer:

    terminal.open()
    terminal.write()
    terminal.resize()

and:

    files.list()
    files.read()
    files.write()

---

# Terminal Security

The terminal intentionally permits arbitrary remote commands.

This is expected.

The security boundary is the SSH server account.

The application must clearly indicate:

    You are connected to Production.

before allowing destructive operations.

---

# Host Keys

Support standard SSH host key verification.

Never silently trust a changed host key.

If the host key changes:

    WARNING

    The host key for Production has changed.

    This may indicate a server rebuild or a
    potential security problem.

Require explicit user action.

---

# Passwords

Do not store passwords in plaintext.

Prefer:

- SSH keys
- ssh-agent

Password authentication may be supported but should use secure storage.

---

# Server Isolation

Every server has independent:

- SSH connection
- state
- filesystem
- Docker data
- logs
- terminal sessions

Never mix server data.

---

# Logging

Do not log:

- private keys
- passwords
- authentication tokens
- terminal secrets

Be careful with terminal output because users may execute commands containing secrets.

---

# Updates

Electron auto-update must verify package integrity.

Do not execute untrusted update payloads.
```

---

# `ROADMAP.md`

```md
# Zvia Roadmap

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

The application must feel like a native desktop application.

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
```

---

# `docs/terminal.md`

```md
# Terminal Specification

The terminal is a first-class component.

It must provide a genuine interactive SSH session.

Architecture:

    xterm.js
        ↓
    IPC
        ↓
    SSH PTY
        ↓
    Remote Shell

---

## Requirements

Support:

- bash
- zsh
- sh
- fish
- vim
- nano
- less
- top
- htop
- tmux
- sudo
- interactive prompts
- ANSI escape codes
- colors
- Unicode
- terminal resize

---

## PTY

Allocate a PTY.

Initial dimensions should match xterm.js.

On resize:

    xterm resize
        ↓
    IPC
        ↓
    SSH PTY resize

---

## Input

Terminal input should be sent directly to the PTY.

Do not parse ordinary shell input.

Do not attempt to implement a shell in JavaScript.

---

## Output

Remote PTY output should stream into xterm.js.

Avoid buffering large output unnecessarily.

---

## Reconnection

If connection drops:

    Connection lost

Allow:

    Reconnect

Do not silently create a new shell without user awareness.

---

## Multiple Terminals

Support multiple terminal tabs.

Example:

    Terminal 1
    Terminal 2
    Terminal 3

All belong to the currently selected server.
```

---

# `docs/files.md`

```md
# File Manager Specification

The File Manager provides Finder-like remote file management over SFTP.

---

# Navigation

Support:

- root
- home
- directories
- breadcrumbs
- back
- forward

Example:

    PRODUCTION /var/www/myapp

---

# Views

MVP:

    List view

Future:

    Icon view
    Columns
    Preview

---

# File Information

Display:

- name
- type
- size
- modified
- permissions where useful

---

# Operations

Support:

- open
- download
- upload
- rename
- move
- copy
- delete
- create directory
- create file

---

# Transfers

Large transfers must provide:

- progress
- speed
- remaining time
- cancel

Example:

    Uploading app.tar.gz

    67%

    412 MB / 612 MB

---

# Editor

Opening a text file should show an editor.

Use:

- syntax highlighting
- line numbers
- search
- save
- save as

The editor must clearly indicate:

    REMOTE FILE

because saving changes the actual server.

---

# Safety

Deleting files requires confirmation.

Never recursively delete without explicit user action.

The terminal remains unrestricted.
```

---

# `docs/docker.md`

```md
# Docker Specification

Docker is scoped to the selected server.

If:

    Production

is selected, Docker displays only Docker resources on Production.

Never aggregate Docker data across servers.

---

# Navigation

Docker contains:

    Containers
    Images
    Volumes
    Networks

---

# Containers

List:

- name
- status
- image
- ports
- uptime

Actions:

- start
- stop
- restart
- remove
- inspect
- logs
- terminal

---

# Container Logs

Use:

    docker logs

Support:

- live
- pause
- search
- copy
- timestamps

---

# Container Terminal

Use:

    docker exec -it

Provide an interactive terminal using the same terminal infrastructure.

---

# Images

Display:

- repository
- tag
- image ID
- size
- created

Allow removal with confirmation.

---

# Volumes

Display:

- name
- driver
- mountpoint

Allow inspection and deletion.

Deletion must require confirmation.

---

# Networks

Display:

- name
- driver
- scope
- connected containers

---

# Docker Missing

If Docker cannot be executed:

    Docker unavailable

    Docker is not installed or the current SSH
    user does not have permission to access Docker.

Provide:

    Open Terminal

Do not automatically modify the server.
```

---

## One architectural decision I'd make from day one

I'd make **`ServerContext` a fundamental concept** in the codebase.

Something conceptually like:

```text
App
│
├── ServerStore
│
└── ServerContext
     │
     ├── connection
     ├── stats
     ├── logs
     ├── terminal
     ├── files
     └── docker
```

Then every feature gets its server from that context.

That makes it much harder for an agent to accidentally build something like:

```text
Docker
├── Production containers
├── Staging containers
└── Development containers
```

when your intended UX is:

```text
Production
└── Docker
    ├── Containers
    ├── Images
    ├── Volumes
    └── Networks
```

**The selected server should be the application's equivalent of the "current directory" in Finder.**

And I would put that rule at the top of essentially every coding-agent specification, because it's one of the things an AI coding agent is most likely to accidentally violate as the project grows.
