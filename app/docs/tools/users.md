# Users Specification

Manage Linux user accounts on the selected server.

## Display

- user list with name, UID, groups, shell, home directory
- detail view for a selected user

## Actions

- create user
- edit user properties
- manage groups and sudo where supported
- manage SSH authorized keys where supported

## Behavior

- Operations run over SSH with validated commands in the main process
- Handle `Permission denied` without automatic privilege escalation
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/users/`
- Service: `app/src/main/services/UserService.ts`
