# Plan-vs-code report

Generated: 2026-10-11T18:42:44.346Z
Plan: (none)
Revision: r-1791743702845

## completed

_(none)_

## incomplete

_(none)_

## unplanned

_(none)_

## violation

- **Dependency cycle** (static-detected)
  pkg:app:src/main/ssh → pkg:app:src/main/services → pkg:app:src/main/ssh
- **Dependency cycle** (static-detected)
  pkg:app:src/main/ssh → pkg:app:src/main/services → pkg:app:src/main/services/deployments → pkg:app:src/main/ssh
- **Dependency cycle** (static-detected)
  pkg:app:src/main/services → pkg:app:src/main/services/deployments → pkg:app:src/main/services
- **Dependency cycle** (static-detected)
  pkg:app:src/main/services → pkg:app:src/main/services/packages → pkg:app:src/main/services
- **Dependency cycle** (static-detected)
  pkg:app:src/main → pkg:app:src/main/ipc → pkg:app:src/main
- **Dependency cycle** (static-detected)
  pkg:landing:src → pkg:landing:src/pages → pkg:landing:src/components → pkg:landing:src
- **Dependency cycle** (static-detected)
  pkg:landing:src → pkg:landing:src/pages → pkg:landing:src
- **Dependency cycle** (static-detected)
  file:app/src/main/services/deployments/index.ts → file:app/src/main/services/deployments/TopologyService.ts → file:app/src/main/services/deployments/collector.ts → file:app/src/main/services/SystemdService.ts → file:app/src/main/services/deployments/index.ts
- **Dependency cycle** (static-detected)
  file:app/src/main/services/DockerService.ts → file:app/src/main/services/deployments/index.ts → file:app/src/main/services/deployments/TopologyService.ts → file:app/src/main/services/deployments/collector.ts → file:app/src/main/services/DockerService.ts
- **Dependency cycle** (static-detected)
  file:app/src/main/services/deployments/index.ts → file:app/src/main/services/deployments/TopologyService.ts → file:app/src/main/services/deployments/collector.ts → file:app/src/main/services/SSLService.ts → file:app/src/main/services/NginxService.ts → file:app/src/main/services/deployments/index.ts

## Limitations

- class node cap 280 reached
- discovered 3 packages, 4 system nodes, 280 classes, 349 source files
- static scan covers TS/JS imports only; dynamic requires are unknowns
