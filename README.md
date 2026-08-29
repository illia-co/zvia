# Relay

Native desktop SSH workspace for remote Linux servers.

Relay is an open-source Electron application for macOS and Windows (Linux builds supported) that connects to Linux servers over SSH and provides server-scoped tools for administration. Everything in the UI operates on the currently selected server — there are no fleet-wide or cross-server views.

**Website:** landing site in `landing/` (deploy from `landing/dist/`)  
**Documentation:** `/documentation` on the landing site, source in `landing/src/docs/`  
**Repository:** https://github.com/illia-co/relay

## Features

Relay includes **14 server-scoped tools**:

| Section | Tools |
|---------|-------|
| General | Overview |
| System | Stats, Users, Processes, Packages, Logs |
| Workspace | Terminal, Files |
| Containers | Docker |
| Network | Ports, Nginx, SSL |
| Daemons | Services, Cron |

## Repository structure

This is an npm workspaces monorepo:

```
/
├── app/          # Electron application (@relay/app)
├── landing/      # Marketing site (@relay/landing)
├── shared/       # Design tokens and brand assets (@relay/shared)
├── docs/         # Contributor documentation
└── package.json  # Workspace root scripts
```

- **`shared/`** — Design tokens (`design/tokens.css`) and brand assets only. Not IPC code.
- **`app/src/shared/`** — IPC contracts, validators, and shared types for the Electron app.
- **`landing/`** — Static Vite site. No Electron dependencies. Deploys independently.

## Requirements

- Node.js 20+
- npm 10+
- macOS (primary development and testing target)
- Windows and Linux builds are supported via electron-builder

## Development

```bash
npm install
npm run dev          # Electron app
npm run dev:landing  # Marketing site
```

### ELECTRON_RUN_AS_NODE

Some terminals (including Cursor) set `ELECTRON_RUN_AS_NODE=1`, which breaks `require('electron')` in Electron 44+. The `dev` and `preview` scripts unset this variable automatically. The main process also deletes it on startup as a safeguard.

If you launch Electron manually, clear it first:

```bash
unset ELECTRON_RUN_AS_NODE
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron app in development mode |
| `npm run build` | Build main, preload, and renderer |
| `npm run typecheck` | TypeScript check (main + renderer) |
| `npm test` | Run Vitest unit tests |
| `npm run dev:landing` | Start landing page dev server |
| `npm run build:landing` | Build static landing site to `landing/dist/` |

App-specific scripts (run from `app/` or via `-w @relay/app`):

| Command | Description |
|---------|-------------|
| `npm run dist` | Build and package for current platform |
| `npm run dist:mac` | Build macOS dmg + zip |
| `npm run dist:win` | Build Windows nsis + portable |
| `npm run dist:linux` | Build Linux AppImage + deb |
| `npm run capture:screenshots` | Regenerate landing page screenshots from the built app |

## Architecture

```
Renderer (React) → Preload (window.relay) → Main (IPC) → SSH → Remote server
```

- Every IPC request requires a `serverId`
- SSH credentials never reach the renderer
- Two SSH connections per server: control (exec/SFTP) and interactive (PTY)
- Passphrases stored via Electron `safeStorage` (OS keychain)

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘/Ctrl+K | Command palette |
| ⌘/Ctrl+W | Close focused workspace tab |
| ⌘/Ctrl+1–9 | Open tools by sidebar position |
| ⌘/Ctrl+0 | Open Ports |
| ⌘/Ctrl+Shift+L | Cycle theme |

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup and pull request guidelines.

For security issues, see [SECURITY.md](./SECURITY.md).

## License

[MIT](./LICENSE) — Copyright (c) 2026 Relay contributors
