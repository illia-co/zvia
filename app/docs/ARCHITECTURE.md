# Relay Architecture

> App package documentation. See [README.md](./README.md) for the full index.

## High Level

Relay consists of four major layers:

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

# ServerContext

`ServerContext` is a fundamental concept in the codebase.

Conceptually:

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

Every feature gets its server from that context.

The selected server should be the application's equivalent of the "current directory" in Finder.

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
