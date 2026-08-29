# Relay Design Language

## Design Goal

Relay should feel like a native macOS utility created by Apple.

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
