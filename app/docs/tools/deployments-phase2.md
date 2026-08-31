# Deployments — Phase 2 clustering strategy

This document describes planned extensions to the Deployments topology model. None of these are implemented in the current release.

## Docker Compose grouping

- Introduce `docker_compose_service` entities linked via `member_of` relationships
- Group containers that share a compose project label into a single visual cluster
- Preserve domain-centric deployments as the primary navigation unit

## Non-nginx deployments

- Detect systemd-only stacks (no nginx `server_name`) as first-class deployments
- Surface raw port listeners that serve traffic without a reverse proxy
- Label these as inferred deployments with lower confidence

## Shared infrastructure insights

- **`shared_upstream`** — multiple deployments proxy to the same named upstream block
- **`shared_dependency`** — deployments share a database, cache, or queue endpoint

## Merge vs annotate

| Scenario | Phase 2 behavior |
|----------|------------------|
| Same backend port, different domains | Annotate only (current `shared_backend` insight) |
| Compose project with web + worker | Merge into one deployment with compose grouping |
| Shared Redis/Postgres across apps | `shared_dependency` insight, no auto-merge |
| Duplicate nginx `server_name` blocks | Keep separate deployments; flag conflicting evidence |

## When to revisit

Re-evaluate clustering after:

- Compose project detection ships
- Non-nginx deployment discovery proves reliable in integration tests
- Users request fleet-wide dependency views (out of scope until fleet mode exists)

See also: [deployments.md](./deployments.md)
