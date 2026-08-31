# Deployments

Server-scoped tool that discovers application topologies from nginx, SSL, ports, processes, systemd, and Docker — then presents them in a table with evidence-backed relationship explanations.

## Purpose

Answer:

- What applications are running on this server?
- How is each one wired together?
- Why do we think these resources are connected?

The discovery model is the product; the UI is a deployment list with a full-screen topology detail view.

## Data sources

| Collector | Source |
|-----------|--------|
| Nginx topology | `nginx -T` (proxy_pass, root, upstream) |
| SSL | `SSLService.getOverview()` |
| Ports | `PortService.list()` |
| Processes | Lazy `ProcessService.get(pid)` for listener PIDs |
| Systemd | `SystemdService.listUnits()` |
| Docker | `DockerService.listContainers()` |

## Clustering

- **One deployment per primary domain** (`server_name`)
- **No auto-merge** when domains share the same backend
- Shared backends surface as cross-deployment insights (e.g. "2 domains → same backend :3000")

## UI

### List view — deployment table

Table columns (same list→detail pattern as Ports and Services):

- **Domain** — primary domain with health dot; topology insights shown inline (e.g. shared-backend annotations)
- **Status** — overall health chip plus inline issue summary for degraded/failed components
- **Components** — per-component status chips (SSL, Nginx, Backend, Service, Files, Container) with color-coded health

Click a row to open the deployment detail subpage.

### Detail view — topology canvas

Full-screen subpage with Back button, deployment header, and a topology canvas that fills the workspace. Per-deployment interactive graph (React Flow + dagre layout) showing entities as nodes and relationships as edges. Edge style reflects confidence (solid, dashed, dotted). Canvas uses a subtle dotted grid background.

Click an edge to open the **Why?** inspector; click a node for structured entity details. The right inspector panel is resizable (drag separator, same as Files editor split), closable via **×**, and shows status, connections, dependencies, and evidence.

## Indicators

### Deployment health

Overall deployment health is the **worst status** along the confirmed path from domain entrypoint to terminal backend.

| Status | Dot | List behavior |
|--------|-----|---------------|
| `healthy` | Green | "Healthy" in Status column |
| `degraded` | Amber | Warning icon + component issue summary (e.g. "Backend degraded") |
| `failed` | Red | Error icon + component issue summary (e.g. "Container failed") |
| `discovering` | Gray pulse | "Discovering…" while scan is in progress |
| `unknown` | Gray | "Unknown" when health cannot be determined |

### Component chips

Per-deployment chips in the Components column reflect individual layers:

| Chip | Source |
|------|--------|
| SSL | Certificate validity for the domain |
| Nginx | Nginx site / reverse proxy health |
| Backend | Listening port or upstream target |
| Service | systemd unit managing the backend |
| Files | Static file root when nginx serves files directly |
| Container | Docker container publishing the backend port |

Chip colors mirror entity health: neutral for healthy, amber for degraded, red for failed.

### Topology canvas nodes

Nodes use kind labels (Domain, Nginx, Port, Service, Container, etc.) and status-colored borders:

- **Entrypoint** domains use a stronger border emphasis
- **Shared backend** ports (cross-deployment insights) are marked on the node
- Node border color reflects entity status (green / amber / red)

### Edge confidence

| Confidence | Edge style |
|------------|------------|
| `confirmed` | Solid line |
| `likely` | Dashed line |
| `unknown` | Dotted line |
| `conflicting` | Dotted line (conflicting evidence) |

### Shared backend insights

When multiple domains proxy to the same backend port, deployments are **not merged**. Instead, an inline insight appears under the domain row (e.g. "2 domains → same backend :3000") with evidence in the topology inspector.

## Scan vs snapshot

| Action | Behavior |
|--------|----------|
| **Open / poll** | `deployments:getSnapshot` returns cached topology (60s TTL) |
| **Scan** | `deployments:scan` forces full rediscovery; progress streams via `deployments:scanProgress` |

Polling interval matches `TOPOLOGY_CACHE_TTL_MS` in `@shared/topology`.

## IPC

| Channel | Description |
|---------|-------------|
| `deployments:scan` | Force full topology scan |
| `deployments:getSnapshot` | Return cached snapshot (60s TTL) |
| `deployments:lookup` | Search cached snapshot for port/container/domain/nginx site |
| `deployments:scanProgress` | Event stream during explicit scans |

Cache TTL is defined as `TOPOLOGY_CACHE_TTL_MS` in `@shared/topology` (60 seconds).

Phase 2 clustering plans: [deployments-phase2.md](./deployments-phase2.md).

## Navigation

`TopologyEntity.navigate` maps to `openWithIntent` for nginx, ssl, ports, processes, services, docker, and files.

## Health

Conservative Phase 1 rules: deployment health is the worst status along the confirmed path from domain entrypoint to terminal backend.

## Out of scope (Phase 1)

- Docker Compose / PM2 grouping
- Fleet-wide topology
- HTTP health checks
