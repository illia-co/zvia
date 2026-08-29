# Security Policy

## Reporting a vulnerability

If you discover a security vulnerability in Relay, please report it responsibly.

**Do not** open a public GitHub issue for security bugs.

Instead:

1. Open a [private security advisory](https://github.com/illia-co/relay/security/advisories/new) on GitHub, or
2. Contact the maintainers through GitHub with minimal details and request a private channel.

We will acknowledge valid reports as quickly as we can and work on a fix before public disclosure when appropriate.

## Scope

Relay is a desktop SSH client. The primary security boundary is:

- **Local:** Electron main vs renderer separation, credential storage, IPC validation
- **Remote:** the SSH account and permissions on the connected Linux server

The embedded terminal intentionally allows arbitrary remote commands over SSH. That is expected behavior.

---

# Security model (contributors)

Relay is a remote server administration application. Security is critical.

## SSH credentials

Private keys must never be exposed to the renderer.

Use:

- macOS Keychain / Windows DPAPI / Linux libsecret via Electron `safeStorage`
- ssh-agent
- secure OS credential storage

Never store private keys in plaintext application state.

Never send private keys through IPC.

## Electron security

Renderer:

- no Node.js integration
- context isolation enabled
- sandbox where practical
- narrow preload API

Do not expose `child_process`, `fs`, `net`, or `ssh2` directly to the renderer.

## IPC

IPC APIs must be explicit and validated in the main process.

Prefer structured APIs such as `terminal.open()`, `files.list()`, and validated exec requests — not arbitrary command execution from the renderer (the terminal is the intentional exception for interactive shells).

## Host keys

Support standard SSH host key verification.

Never silently trust a changed host key. Require explicit user action when a host key changes.

## Server isolation

Every server has independent SSH connection, state, filesystem, Docker data, logs, and terminal sessions. Never mix server data across servers.

## Logging

Do not log private keys, passwords, authentication tokens, or terminal secrets.

## Updates

When automatic updates are added in the future, they must verify package integrity. Do not execute untrusted update payloads.
