# Relay — Coding Agent Instructions

## Repository

This is an npm workspaces monorepo:

- **`app/`** — Electron application (`@relay/app`). All application code lives under `app/src/`.
- **`landing/`** — Static marketing site (`@relay/landing`). No Electron dependencies; deploys independently.
- **`shared/`** — Design tokens and brand assets (`@relay/shared`). Not IPC code.

The IPC contracts and validators remain in **`app/src/shared/`** — do not confuse with root `shared/`.

Root scripts: `npm run dev` (app), `npm run dev:landing` (site), `npm run build`, `npm test`.

---

## Product

Relay is a native-feeling macOS desktop application for managing remote Linux servers over SSH.

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

The server should NOT require a custom Relay agent for the MVP.

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

Relay should feel like a serious Mac application, not a web dashboard wrapped in Electron.

---

# Platform Strategy

Relay is **macOS-first** but **cross-platform by design**.

- Ship and test primarily on macOS.
- Do not use macOS-only APIs in non-UI code (`app/src/main`, `app/src/shared`, services).
- UI may use platform-appropriate conventions (e.g. ⌘ shortcuts on macOS, Ctrl on Windows/Linux).
- Credential encryption uses Electron `safeStorage` (macOS Keychain, Windows DPAPI, Linux libsecret) — never platform-specific secret stores directly.
- Distribution targets are configured in `app/electron-builder.yml` for macOS (dmg/zip), Windows (nsis/portable), and Linux (AppImage/deb). Windows and Linux builds are expected to compile; macOS is the polished target.
- The main process clears `ELECTRON_RUN_AS_NODE` on startup because some IDE terminals set it and break Electron 44+.
