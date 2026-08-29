# Stats Specification

Stats provides live resource metrics for the currently selected server.

## Display

**CPU**

- usage
- core count
- load average
- per-core usage when practical

**Memory**

- used, available, total
- swap

**Disk**

- filesystem
- used, available, percentage

**Network**

- RX / TX
- interface information

**Uptime**

- system uptime alongside other summary metrics

## Behavior

- Poll periodically; avoid expensive remote commands
- Clear metrics when the server disconnects
- Never aggregate across servers

## Implementation

- Panel: `app/src/renderer/tools/stats/`
- Service: `app/src/main/services/StatsService.ts`, `LinuxStatsService.ts`
