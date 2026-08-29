# Logs Specification

Server Logs provide a server-scoped view of systemd journal output on the selected server.

Logs are scoped to the currently selected server. There must be no global or cross-server log view.

---

# Data Source

The implementation uses systemd journal where available.

Primary command:

    journalctl

Live streaming uses `journalctl -f`. Recent (snapshot) mode uses a one-shot `journalctl` query without `-f`.

---

# View Modes

## Live

- Streams new journal entries as they arrive (`journalctl -f`)
- Supports pause, resume, and jump to latest
- Auto-scrolls while the viewport is near the bottom (~80px)
- Scrolling up pauses auto-scroll and shows a **New logs below** indicator

## Recent

- Fetches the last N lines as a snapshot (no follow)
- Stream completion with exit code 0 is treated as success (status returns to idle)
- **Refresh** re-runs the query with the current filters
- Auto-scrolls once when results load

Line count presets: 100, 500, 1k, 2k, 5k (100–5000).

---

# Filters

Filters auto-apply on change (no Apply button).

| Filter | Type | Notes |
|--------|------|-------|
| Search | Client-side | Filters the loaded buffer only |
| Time range | Preset | Last 15m, 1h, 6h, 24h, Today, All time |
| Severity | Preset | Emergency through Debug (`journalctl -p`) |
| Unit | Searchable picker | From `services:list` plus units seen in the buffer |

Time presets map to journalctl `--since` values (e.g. `15 minutes ago`, `today`). Live mode never passes `--until`.

---

# Performance

The UI must handle large log streams without freezing.

Never load an unlimited amount of logs into React state.

Use:

- streaming (live mode)
- bounded snapshot queries (recent mode)
- virtualization
- bounded buffers (5000 entries)

---

# UI

Logs should feel like macOS Console.

Dense but readable. Monochrome surfaces. Design-system `Input` and Radix `Select` controls (no native `<select>`).

Two-row toolbar:

1. Mode (Live / Recent), line presets, status, actions (Pause/Resume or Refresh, Jump to latest, Copy, Clear filters)
2. Search, time range, severity, unit picker

Show server context clearly:

    PRODUCTION — Logs

Header subline reflects mode and paused state.

---

# Disconnected State

When the server is disconnected:

- stop live streaming
- show disconnected state
- preserve visible log content if useful
- do not pretend new logs are arriving

---

# Error Handling

If journalctl is unavailable or permission is denied:

    Logs unavailable

    systemd journal could not be accessed on this server.

Provide actionable guidance. Do not fail silently.

Recent mode snapshot completion (exit 0) is not an error.
