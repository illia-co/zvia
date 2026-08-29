# Packages Specification

Search, install, update, and remove system packages on the selected server.

## Package manager

- Primary support: **apt** on Debian and Ubuntu
- Detect package manager via `app/src/main/services/packages/detectPackageManager.ts`

## Tabs

- **Installed** — packages on the system
- **Updates** — available upgrades
- **Search** — find and install packages

## Actions

- install, remove, upgrade with progress feedback
- show operation output and errors clearly

## Behavior

- Do not assume root; surface permission errors
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/packages/`
- Service: `app/src/main/services/PackageService.ts`
