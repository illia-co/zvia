# Overview Specification

The Overview panel provides a high-level representation of the currently selected server.

Overview is server-scoped. It must never aggregate data across multiple servers.

---

# Purpose

The Overview answers:

    What is this server?
    Is it healthy?
    What are the basics?

It is a concise at-a-glance view, not a full monitoring system.

---

# Display

Show:

- server name
- hostname
- Linux distribution
- Linux version
- architecture
- connection status
- uptime
- CPU summary
- memory summary
- disk summary
- network activity summary

---

# Data Sources

Prefer efficient remote commands and `/proc` where appropriate.

Examples:

- OS info from `/etc/os-release`
- uptime from `/proc/uptime` or `uptime`
- CPU/memory from `/proc/stat`, `/proc/meminfo`
- disk from `df`
- network from `/proc/net/dev` or `ip`

Do not poll aggressively. A 1–5 second refresh interval is sufficient for summary metrics.

---

# Connection State

The Overview must clearly reflect connection state.

When disconnected:

- show disconnected status
- disable or gray out live metrics
- offer reconnect
- do not display stale metrics as current

Example header:

    PRODUCTION
    ubuntu@production.example.com
    ● Connected

---

# Layout

Keep the layout calm and minimal.

Use typography and whitespace for hierarchy.

Avoid dashboard-style cards and colorful charts.

Prefer compact technical readouts similar to Activity Monitor's summary feel.

---

# Relationship to Stats

Overview shows summary information.

Stats provides detailed live metrics in a separate view.

Do not duplicate the full Stats experience inside Overview.
