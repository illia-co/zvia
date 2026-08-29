# Services Specification

Manage systemd units on the selected server.

## Display

- unit list with name, load state, active state, description
- detail view for a selected unit

## Actions

- start, stop, restart
- enable, disable
- jump to related logs

## Behavior

- Use `systemctl` and journal integration over SSH
- Handle missing permissions gracefully
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/services/`
- Service: `app/src/main/services/SystemdService.ts`
