#!/usr/bin/env bash
# demo-changes.sh — Apply all edge-case changes for the Changes view demo.
#
# Run AFTER you've pinned the baseline in Zvia Changes tab.
# Wait ~60s for Zvia to scan again, then open the Changes tab to see all diffs.
#
# What this creates:
#   shop.zvia-test.local  — FAILED  (frontend stopped + nginx upstream broken)
#   api.zvia-test.local   — DEGRADED (postgres stopped, API still running but unhealthy)
#   zvia-test.local       — CHANGED  (SSL cert regenerated, nginx config tweaked)
#   Standalone entities   — ADDED    (new redis container on :6380, new process)
#
# Covers: entity_modified, entity_added, relationship_removed, status transitions
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

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  APPLYING ALL DEMO CHANGES"
echo "════════════════════════════════════════════════════════════"
echo ""

# ───────────────────────────────────────────────────────────
# 1. ENTITY MODIFIED: shop deployment — frontend stopped
#    Entity: docker_container healthy→failed
#    Entity: port :3000 healthy→failed
# ───────────────────────────────────────────────────────────
echo "▸ [1/7] Stopping frontend container (shop deployment)..."
compose stop frontend
echo "  ✓ Frontend stopped — shop backend :3000 will fail"

# ───────────────────────────────────────────────────────────
# 2. RELATIONSHIP REMOVED: shop nginx → dead port
#    Nginx upstream for shop changed to :3999 (nothing listening)
#    Relationship: nginx_site → port :3000 removed
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [2/7] Breaking shop nginx upstream → :3999..."
if [[ ! -f "$NGINX_BACKUP" ]]; then
  sudo cp "$NGINX_FULLSTACK" "$NGINX_BACKUP"
fi
sudo sed -i '/server_name shop\.zvia-test\.local;/,/^[[:space:]]*}/ s|proxy_pass http://127\.0\.0\.1:[0-9]*;|proxy_pass http://127.0.0.1:3999;|' "$NGINX_FULLSTACK"
sudo nginx -t && sudo systemctl reload nginx
echo "  ✓ Shop nginx now points to dead port :3999"

# ───────────────────────────────────────────────────────────
# 3. ENTITY MODIFIED: api deployment — postgres stopped
#    postgres container: healthy→failed
#    api container: still running but degraded (DB unreachable)
#    Deployment health: healthy→degraded
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [3/7] Stopping postgres container (api deployment)..."
compose stop postgres
echo "  ✓ Postgres stopped — api deployment degraded"

# ───────────────────────────────────────────────────────────
# 4. ENTITY ADDED: new standalone redis container on :6380
#    Adds: container entity, port entity (:6380)
#    Not part of any deployment → "Other changes" section
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [4/7] Starting new redis:alpine container on :6380..."
sudo docker rm -f zvia-demo-redis 2>/dev/null || true
sudo docker run -d --name zvia-demo-redis \
  -p 127.0.0.1:6380:6379 \
  redis:7-alpine
echo "  ✓ Redis running on :6380 (unaffiliated entity)"

# ───────────────────────────────────────────────────────────
# 5. ENTITY MODIFIED: SSL certificate regenerated
#    Different expiry → sourceRef changed
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [5/7] Regenerating SSL certificate (new expiry)..."
sudo openssl req -x509 -nodes -days 30 -newkey rsa:2048 \
  -keyout /etc/ssl/zvia-test/privkey.pem \
  -out /etc/ssl/zvia-test/fullchain.pem \
  -subj "/CN=zvia-test.local/O=Zvia Demo Updated/C=US" \
  -addext "subjectAltName=DNS:zvia-test.local,DNS:shop.zvia-test.local,DNS:api.zvia-test.local,DNS:localhost" \
  2>/dev/null
sudo systemctl reload nginx
echo "  ✓ New SSL cert (30-day, different subject)"

# ───────────────────────────────────────────────────────────
# 6. ENTITY MODIFIED: zvia-web nginx config tweak
#    Adds a new header to the proxy config
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [6/7] Modifying zvia-web nginx config..."
sudo tee /etc/nginx/sites-available/zvia-test >/dev/null <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name zvia-test.local localhost;

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name zvia-test.local localhost;

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    add_header X-Demo-Changed "true" always;

    access_log /var/log/nginx/zvia-test.access.log;
    error_log /var/log/nginx/zvia-test.error.log;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/zvia-test /etc/nginx/sites-enabled/zvia-test
sudo nginx -t && sudo systemctl reload nginx
echo "  ✓ Nginx config updated (added X-Demo-Changed header)"

# ───────────────────────────────────────────────────────────
# 7. ENTITY ADDED: standalone background process
#    A simple sleep process on port :9999 (unaffiliated)
# ───────────────────────────────────────────────────────────
echo ""
echo "▸ [7/7] Starting standalone demo process on :9999..."
# Start a simple python HTTP server as a standalone process
sudo docker run -d --name zvia-demo-standalone \
  -p 127.0.0.1:9999:9999 \
  python:3-alpine \
  python3 -m http.server 9999
echo "  ✓ Standalone HTTP server on :9999 (unaffiliated entity)"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ALL CHANGES APPLIED"
echo ""
echo "  shop.zvia-test.local  → FAILED"
echo "    • Frontend container stopped"
echo "    • Nginx upstream → dead port :3999"
echo ""
echo "  api.zvia-test.local   → DEGRADED"
echo "    • Postgres container stopped"
echo "    • API container running but DB unreachable"
echo ""
echo "  zvia-test.local       → CHANGED"
echo "    • SSL cert regenerated (30-day)"
echo "    • Nginx config updated (new header)"
echo ""
echo "  Unaffiliated          → ADDED"
echo "    • Redis container on :6380"
echo "    • Python HTTP server on :9999"
echo ""
echo "  Wait ~60s for Zvia to scan, then check the Changes tab."
echo "════════════════════════════════════════════════════════════"
