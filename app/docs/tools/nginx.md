# Nginx Specification

Inspect and manage Nginx on the selected server.

## Tabs

- **Overview** — service status and summary
- **Config** — browse configuration tree, validate, reload
- **Logs** — stream access or error logs

## Actions

- validate configuration before reload
- reload Nginx after validated changes
- open related paths in Files or Terminal when useful

## Behavior

If Nginx is not installed, show a clear empty state — do not install automatically.

## Implementation

- Panel: `app/src/renderer/tools/nginx/`
- Service: `app/src/main/services/NginxService.ts`
