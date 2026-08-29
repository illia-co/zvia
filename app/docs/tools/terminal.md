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
