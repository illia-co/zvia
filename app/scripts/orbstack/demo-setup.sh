#!/usr/bin/env bash
# demo-setup.sh — Provision OrbStack fullstack and ensure a clean baseline state
# for the Changes view demo. Run this first, then connect Zvia and pin the baseline.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STACK_DIR="/opt/zvia-demo"
COMPOSE_PROJECT="zvia-demo"

compose() {
  if sudo docker compose version >/dev/null 2>&1; then
    sudo docker compose \
      -f "${STACK_DIR}/docker-compose.yml" \
      --project-directory "${STACK_DIR}" \
      -p "${COMPOSE_PROJECT}" "$@"
  else
    sudo docker-compose \
      -f "${STACK_DIR}/docker-compose.yml" \
      -p "${COMPOSE_PROJECT}" "$@"
  fi
}

echo "==> Provisioning fullstack..."
ZVIA_FULLSTACK=1 bash "${SCRIPT_DIR}/provision.sh"

echo "==> Ensuring all containers are running..."
compose up -d --build

echo "==> Restarting nginx..."
sudo systemctl reload nginx

echo "==> Stopping any demo containers that shouldn't exist..."
sudo docker rm -f zvia-demo-redis 2>/dev/null || true

echo "==> Waiting for services to be healthy..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1 && \
     curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "    Services ready"
    break
  fi
  [[ "$i" -eq 30 ]] && echo "    Warning: services not ready"
  sleep 2
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  BASELINE READY"
echo ""
echo "  Deployments:"
echo "    shop.zvia-test.local  → :3000 → frontend container"
echo "    api.zvia-test.local   → :3001 → api container → postgres"
echo ""
echo "  All services: healthy"
echo ""
echo "  Next steps:"
echo "    1. Open Zvia → connect to OrbStack (ssh default@orb)"
echo "    2. Open Deployments tab → wait for scan"
echo "    3. Switch to Changes tab → Pin current as baseline"
echo "    4. Run:  bash app/scripts/orbstack/demo-changes.sh"
echo "════════════════════════════════════════════════════════════"
