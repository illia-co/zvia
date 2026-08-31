# OrbStack Integration Test Stack

OrbStack provides a local Ubuntu VM (`orb`) for integration-testing Zvia against a realistic Linux server without cloud infrastructure.

## Quick start

```bash
# Basic stack (nginx, docker, cron, systemd, SSL, UFW)
npm run orbstack:provision

# Full stack for Deployments topology testing
npm run orbstack:provision:fullstack

# Run integration tests over SSH (includes topology pipeline when fullstack is provisioned)
npm run orbstack:test

# Run only Deployments topology integration tests
npm run test:integration:topology

# Optional: verify failed health when the API container is stopped
npm run test:integration:topology:break
```

Reprovision from scratch:

```bash
FORCE=1 npm run orbstack:provision:fullstack
```

## Stacks

### Basic (`ZVIA_FULLSTACK` unset)

| Component | Details |
|-----------|---------|
| Docker | `zvia-web` nginx container on `127.0.0.1:8080` |
| Nginx | `zvia-test.local`, `admin.zvia-test.local` → `:8080` |
| TLS | Self-signed cert at `/etc/ssl/zvia-test/` |
| Cron | User + system cron jobs |
| Systemd | `zvia-heartbeat.timer` |

### Fullstack (`ZVIA_FULLSTACK=1`)

Adds a multi-tier deployment at `/opt/zvia-demo/`:

```
shop.zvia-test.local (host nginx :443)
  → proxy_pass 127.0.0.1:3000 (frontend container, nginx static)

api.zvia-test.local (host nginx :443)
  → proxy_pass 127.0.0.1:3001 (api container, Node.js)
  → postgres:5432 (internal Docker network)
```

Docker Compose project name: `zvia-demo`.

Containers: `zvia-demo-frontend-1`, `zvia-demo-api-1`, `zvia-demo-postgres-1`.

Cron jobs additionally poll `http://127.0.0.1:3001/health` every 5–10 minutes.

## Manual Deployments testing

1. Provision fullstack: `npm run orbstack:provision:fullstack`
2. Add the OrbStack VM as a server in Zvia (`ssh default@orb` or `127.0.0.1:32222`)
3. Open **Deployments** — expect two deployments:
   - `shop.zvia-test.local` — Nginx → :3000 → Docker (frontend)
   - `api.zvia-test.local` — Nginx → :3001 → Node → Postgres
4. Click each row to inspect the topology canvas and evidence

Add to `/etc/hosts` on macOS for browser testing:

```
127.0.0.1 shop.zvia-test.local api.zvia-test.local zvia-test.local
```

Or use curl with `--resolve`:

```bash
orb curl -sk --resolve shop.zvia-test.local:443:127.0.0.1 https://shop.zvia-test.local/
orb curl -sk --resolve api.zvia-test.local:443:127.0.0.1 https://api.zvia-test.local/health
```

## Break scenarios

Use `break-stack.sh` inside the VM to simulate failures and verify Zvia Deployments health:

```bash
# Via orb from repo root
orb bash app/scripts/orbstack/break-stack.sh stop-api
orb bash app/scripts/orbstack/break-stack.sh restore
```

| Command | What breaks | Expected Zvia status |
|---------|-------------|---------------------|
| `stop-api` | API container stopped | **api.*** deployment failed — backend :3001 not listening, container exited. **shop.*** unaffected. |
| `stop-db` | Postgres container stopped | **api.*** degraded/failed — :3001 listening but DB unreachable; postgres container failed. **shop.*** unaffected. |
| `stop-frontend` | Frontend container stopped | **shop.*** failed — :3000 not listening, container exited. **api.*** unaffected. |
| `break-nginx-upstream shop` | Nginx points shop to dead port :3999 | **shop.*** failed — backend port not listening; containers still running. |
| `break-nginx-upstream api` | Nginx points api to dead port :3998 | **api.*** failed — same pattern at nginx layer. |
| `restore` | `docker compose up -d` + nginx config reset | All deployments return to healthy. |

After each break, re-scan in Zvia Deployments (or wait for the 60s cache TTL).

Automated topology health checks use `npm run test:integration:topology:break`, which stops the API container over SSH, asserts `api.*` is failed and `shop.*` stays healthy, then restores the stack. Manual `break-stack.sh` runs remain useful for UI verification.

## Files

```
app/scripts/orbstack/
├── provision.sh              # Main provision script
├── run-provision.mjs         # Runs provision inside orb VM
├── integration-test.mjs      # SSH-based integration tests
├── break-stack.sh            # Failure injection for Deployments
├── fixtures/fullstack/
│   ├── docker-compose.yml
│   ├── api/                  # Node.js API with /health + Postgres
│   └── frontend/             # nginx static site
└── README.md
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ZVIA_FULLSTACK` | `0` | Deploy compose stack + shop/api nginx sites |
| `ZVIA_DOMAIN` | `zvia-test.local` | Base domain for certs and nginx |
| `ZVIA_APP_PORT` | `8080` | Basic stack backend port |
| `FORCE` | `0` | Reprovision even if marker exists |
| `ZVIA_SSH_HOST` | `127.0.0.1` | Integration test SSH host |
| `ZVIA_SSH_PORT` | `32222` | OrbStack SSH port |
| `ZVIA_SSH_USER` | `default` | SSH username |
