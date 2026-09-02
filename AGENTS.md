# Zvia — Coding Agent Instructions

Desktop SSH workspace for remote Linux servers (Electron + React + TypeScript). npm workspaces monorepo: `app/` (Electron app), `landing/` (marketing site), `shared/` (design tokens).

## Commands

Run from repo root. There is **no linter or formatter configured** — verification is exactly what CI does, in this order: `typecheck → test → build → build:landing`.

| Command | What |
|---------|------|
| `npm run dev` | Electron app dev (`-w @zvia/app`) |
| `npm run dev:demo` | Interactive demo app on seeded topology/snapshot stubs (no SSH) |
| `npm run dev:landing` | Landing site dev |
| `npm run typecheck` | `tsc --noEmit` on both `app/tsconfig.node.json` and `app/tsconfig.web.json` |
| `npm test` | Vitest unit tests in `app/test/**` (node env; integration tests auto-skip) |
| `npm run build` / `build:landing` | electron-vite build / landing build |

- Single test: `npm run test -w @zvia/app -- test/shared/cron.test.ts`
- Integration tests need OrbStack: provision once with `npm run orbstack:provision -w @zvia/app`, then `npm run test:integration -w @zvia/app`. Gated by `ZVIA_ORB_INTEGRATION=1` (`describe.skipIf`); see `app/scripts/orbstack/README.md`.
- Installers: `npm run dist:mac|dist:win|dist:linux -w @zvia/app` (config `app/electron-builder.yml`).

## Layout and aliases

- `app/src/main` — SSH layer (`ssh/`, one `ConnectionManager`), services (`services/`), IPC handlers (`ipc/registry.ts`), persistence (`store/`).
- `app/src/renderer` — React UI. One folder per tool in `tools/`, Zustand stores in `state/`.
- `app/src/shared` — **IPC contracts and validators** (alias `@shared`). Not to be confused with root `shared/` = design tokens (`@zvia/shared`). This mix-up is the easiest mistake here.
- `app/test` — mirrors src: `main/`, `shared/`, `renderer/`, `integration/`.
- Other aliases: `@renderer`, `@main` (vitest config only).

## IPC wiring (how almost every feature travels)

    renderer → window.zvia → preload allowlist → main/ipc/registry.ts → Service → SSH

- Renderer only talks to main through the `window.zvia` bridge in `app/src/preload/index.ts`; the channel/event allowlists there derive from `app/src/shared/ipcChannels.ts` (single source of truth).
- Contracts live in `app/src/shared/ipc.ts`; every request payload is validated by a function in `app/src/shared/validate.ts`, called in `registry.ts`. Unvalidated renderer input must never reach a service.
- Shell command strings belong in `app/src/main/services/*`; never in React components. Prefer SFTP over shell for file ops, and structured output (`--format json`) over parsing human-readable output.
- Adding an IPC operation = add the channel to `app/src/shared/ipcChannels.ts` (registry unregistration and the preload allowlist consume this list), the req/res contract in `app/src/shared/ipc.ts`, a validator in `app/src/shared/validate.ts`, a handler in `registry.ts`, then the renderer call.

## Product rules (review-enforced)

1. **Everything is server-scoped.** Every server operation takes a `serverId`; every view operates on the selected server. No fleet-wide views (all containers/logs/services across servers) unless a fleet mode is explicitly designed. The app ships 15 tools; per-tool specs in `app/docs/tools/`. Do not build without product intent: Kubernetes, DB admin UIs, cloud provisioning, deployment pipelines, monitoring/alerting.
2. **No agent on the server.** Only SSH/SFTP/PTY + standard Linux commands + Docker CLI against stock Ubuntu servers.
3. **Renderer never sees SSH credentials or private keys.** Secrets are encrypted in main with Electron `safeStorage` (`app/src/main/store/secrets.ts`). The terminal is the intentional exception to command validation: it is a fully interactive SSH shell.
4. Design: monochrome, minimal, native macOS feel; not a SaaS dashboard. Binding rules are in `shared/docs/UI.md` and `shared/docs/DESIGN.md` — follow them rather than inventing new visual patterns.

## Docs to update when behavior changes

- Tool behavior/architecture → `app/docs/` (per-tool: `app/docs/tools/<tool>.md`)
- User-facing guides → `landing/src/docs/content.ts` (served at `/documentation`)
- Commands/structure/rules here → this file

## Environment and release quirks

- `ELECTRON_RUN_AS_NODE=1` (set by some IDE terminals) breaks Electron 44+. The `dev`/`preview` scripts strip it (`env -u`) **and** `app/src/main/index.ts` deletes it before importing the app. Preserve both.
- macOS-first but must compile on Windows/Linux; no macOS-only APIs outside UI code. CI uses Node 24.
- Release: push a `v*` tag → CI builds mac/Windows/Linux installers and publishes a GitHub release. Landing deploys to GitHub Pages on push to main (base path `/zvia/`, `VITE_BASE_PATH`).
