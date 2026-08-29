# Cron Specification

View and edit scheduled tasks on the selected server.

## Display

- crontab entries by user or system source
- job detail view with schedule expression and command

## Actions

- add, edit, remove cron jobs
- select crontab source (user vs system paths) when applicable

## Behavior

- Validate cron expressions in the UI where possible
- Confirm destructive edits
- Server-scoped only

## Implementation

- Panel: `app/src/renderer/tools/cron/`
- Service: `app/src/main/services/CronService.ts`
