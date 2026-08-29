# Processes Specification

Inspect and manage running processes on the selected server.

## Display

- live process list with CPU and memory usage
- filters and sort
- detail view for a selected process

## Actions

- send signals (e.g. terminate, kill) with confirmation where appropriate
- protect critical processes (e.g. PID 1) from accidental signals

## Behavior

- Refresh on an interval while the panel is open
- Clear state on disconnect
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/processes/`
- Service: `app/src/main/services/ProcessService.ts`
