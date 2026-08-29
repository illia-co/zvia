# Ports Specification

View listening ports and manage firewall rules on the selected server.

## Display

- open ports and owning processes
- detail view per port binding

## Actions

- add or adjust firewall rules where supported (UFW-style workflows)
- validate user input before applying changes

## Behavior

- Requires appropriate permissions on the remote host
- Clear server context in the UI
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/ports/`
- Service: `app/src/main/services/PortService.ts`
