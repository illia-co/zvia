#!/usr/bin/env bash
# demo-restore.sh — Undo all demo-changes.sh modifications and restore clean baseline.
set -euo pipefail

STACK_DIR="/opt/zvia-demo"
COMPOSE_PROJECT="zvia-demo"
NGINX_FULLSTACK="/etc/nginx/sites-available/zvia-fullstack"
NGINX_BACKUP="/etc/nginx/sites-available/zvia-fullstack.bak"

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

echo "==> Restoring demo state..."

# Remove ad-hoc containers
echo "  • Removing standalone demo containers..."
sudo docker rm -f zvia-demo-redis zvia-demo-standalone 2>/dev/null || true

# Restore nginx config
if [[ -f "$NGINX_BACKUP" ]]; then
  echo "  • Restoring nginx upstream config..."
  sudo cp "$NGINX_BACKUP" "$NGINX_FULLSTACK"
  sudo rm -f "$NGINX_BACKUP"
  sudo nginx -t && sudo systemctl reload nginx
else
  echo "  • No nginx backup found, reloading..."
  sudo systemctl reload nginx
fi

# Restore fullstack
if [[ -f "${STACK_DIR}/docker-compose.yml" ]]; then
  echo "  • Restarting compose stack..."
  compose up -d --build
fi

# Wait for health
echo "  • Waiting for services..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1 && \
     curl -sf http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "  ✓ All services healthy"
    break
  fi
  [[ "$i" -eq 30 ]] && echo "  ⚠ Services not ready"
  sleep 2
done

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  RESTORED — All deployments should be healthy again."
echo "  Wait ~60s for Zvia to scan, or hit Refresh."
echo "════════════════════════════════════════════════════════════"
