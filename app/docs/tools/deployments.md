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

- **One deployment per primary domain** (`server_name`) for reverse-proxied apps
- **Non-nginx deployments** — systemd-only stacks and raw port listeners group as inferred deployments (lower confidence)
- **Container & Compose clustering** — containers sharing a Docker Compose project are grouped via `docker_compose_service` entities and `member_of` relationships
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
| `deployments:historyList` | List stored snapshots for a server (newest first) |
| `deployments:tag` | Add/remove a deployment tag on a snapshot |
| `deployments:deploymentHistory` | Per-deployment snapshot list with scoped change summaries |
| `deployments:diff` | Diff current topology against a snapshot, scoped to one deployment |
| `deployments:snapshotDiff` | Diff two stored snapshots, scoped to one deployment |

Cache TTL is defined as `TOPOLOGY_CACHE_TTL_MS` in `@shared/topology` (60 seconds).

Clustering model (Compose grouping, non-nginx deployments, shared-backend insights): [deployments-phase2.md](./deployments-phase2.md).

## Navigation

`TopologyEntity.navigate` maps to `openWithIntent` for nginx, ssl, ports, processes, services, docker, and files.

## Health

Conservative Phase 1 rules: deployment health is the worst status along the confirmed path from domain entrypoint to terminal backend.

## Change tracking

Every scan records a snapshot **automatically** into a persistent per-server history store (`userData/topologyHistory.json`, capped at 10 entries per server), but only when the scan produced a meaningful change. Snapshots can be tagged per deployment (e.g. `stable`), and any stored snapshot can be diffed against the live state or against another snapshot.

**Automatic snapshotting:** `TopologyService` records a snapshot whenever the diff against the last recorded snapshot contains a significant change. Pure *process PID churn* is excluded: a process entity that disappears and reappears with the same runtime (`comm`) is treated as a restart, not a structural change, and never triggers a snapshot. Structural changes (nginx sites, ports, containers, services, SSL, domains, files, relationships) and genuine add/removals always trigger one.

**Every diff is scoped to one deployment.** `diffTopologyForDeployment` (in `main/services/deployments/diff.ts`) diffs two `TopologySnapshot` objects and returns only the changes whose entities/relationships belong to the selected deployment. Ownership reuses the same `Deployment.entityIds` membership built by `clusterDeployments` (the grouping the main Deployments list uses), so a diff for deployment A never contains, counts, or references a change that only affected deployment B — even when both changed in the same scan pair.

**UI flow:**

- **Deployments list rows** show the latest tag badge (if any) and a **Show snapshots** button.
- Clicking the **tag badge** jumps directly to the diff detail view, comparing that tag's snapshot against the live state for that deployment only.
- **Show snapshots** opens a per-deployment snapshot table: timestamp, tags, and a change summary (e.g. "3 changes" or "Nginx config, Port") computed against the previous snapshot. It only lists snapshots that changed this deployment (or are tagged for it). Each row has a **Compare to current** quick action; a **Compare** bar above the table lets you diff any two snapshots or a snapshot against **Current state**.
- Clicking a changed component in the diff detail view opens a right-side panel with the exact before/after for that component (field/sourceRef diff, or full entity state for add/remove).

**Entity fingerprint for modified detection:** Each `TopologyEntity` carries a `sourceRef: Record<string, unknown>` of identifying attributes (port number, container ID, systemd unit, state, compose project, etc.). A change in `sourceRef` or `status` triggers an `entity_modified` change. Removed entities/relationships resolve their ownership against the "before" snapshot so deletions still surface in a deployment-scoped diff.

**Rolling history:** Snapshots are capped at 10 per server; when exceeded, the oldest untagged snapshot is dropped. Tagged snapshots are never auto-pruned.

**Persistence:** Snapshots are stored locally in `userData/topologyHistory.json` (same pattern as `userData/profiles.json`). Snapshots contain only entity labels, IDs, health status, and sourceRef — no credentials or secrets. When a server profile is removed, its history is purged.

## Out of scope

- Fleet-wide topology
- HTTP health checks
