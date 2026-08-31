#!/usr/bin/env bash
# Break or restore components of the Zvia fullstack demo for Deployments testing.
#
# Usage (inside OrbStack VM or via `orb bash app/scripts/orbstack/break-stack.sh <cmd>`):
#   break-stack.sh stop-api
#   break-stack.sh stop-db
#   break-stack.sh stop-frontend
#   break-stack.sh break-nginx-upstream [shop|api]
#   break-stack.sh restore
set -euo pipefail

ZVIA_DOMAIN="${ZVIA_DOMAIN:-zvia-test.local}"
STACK_DIR="/opt/zvia-demo"
SHOP_DOMAIN="shop.${ZVIA_DOMAIN}"
API_DOMAIN="api.${ZVIA_DOMAIN}"
NGINX_SITE="/etc/nginx/sites-available/zvia-fullstack"
NGINX_BACKUP="/etc/nginx/sites-available/zvia-fullstack.bak"
COMPOSE_PROJECT="zvia-demo"

FULLSTACK_PROVISION_HINT="Fullstack stack not provisioned. From the repo root run:
  npm run orbstack:provision:fullstack
  or: FORCE=1 npm run orbstack:provision:fullstack"

compose() {
  if sudo docker compose version >/dev/null 2>&1; then
    sudo docker compose \
      -f "${STACK_DIR}/docker-compose.yml" \
      --project-directory "${STACK_DIR}" \
      -p "${COMPOSE_PROJECT}" \
      "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    sudo docker-compose \
      -f "${STACK_DIR}/docker-compose.yml" \
      --project-directory "${STACK_DIR}" \
      -p "${COMPOSE_PROJECT}" \
      "$@"
  else
    echo "docker compose not available" >&2
    exit 1
  fi
}

require_fullstack() {
  if [[ ! -f "${STACK_DIR}/docker-compose.yml" ]]; then
    echo "Stack not found at ${STACK_DIR}."
    echo "$FULLSTACK_PROVISION_HINT"
    exit 1
  fi
}

container_id() {
  local service="$1"
  local id role

  # -a includes stopped containers (needed after a prior break)
  id="$(compose ps -aq "$service" 2>/dev/null | head -1 || true)"
  if [[ -n "$id" ]]; then
    echo "$id"
    return 0
  fi

  id="$(sudo docker ps -aq \
    --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}" \
    --filter "label=com.docker.compose.service=${service}" 2>/dev/null | head -1 || true)"
  if [[ -n "$id" ]]; then
    echo "$id"
    return 0
  fi

  role="$service"
  [[ "$service" == "postgres" ]] && role="database"
  id="$(sudo docker ps -aq \
    --filter "label=com.zvia.stack=demo" \
    --filter "label=com.zvia.role=${role}" 2>/dev/null | head -1 || true)"
  if [[ -n "$id" ]]; then
    echo "$id"
    return 0
  fi

  sudo docker ps -aq --filter "name=${COMPOSE_PROJECT}-${service}" 2>/dev/null | head -1 || true
}

container_not_found() {
  local service="$1"
  local label
  label="$(tr '[:lower:]' '[:upper:]' <<< "${service:0:1}")${service:1}"
  echo "${label} container not found."
  echo "$FULLSTACK_PROVISION_HINT"
  echo ""
  echo "Debug (compose ps -a):"
  compose ps -a 2>/dev/null || echo "  (compose unavailable or stack empty)"
  exit 1
}

print_expectation() {
  cat <<'EOF'

── Expected Zvia Deployments status ──────────────────────────────────
EOF
  echo "$1"
  echo "────────────────────────────────────────────────────────────────────"
}

cmd_stop_api() {
  require_fullstack
  local id
  id="$(container_id api)"
  if [[ -z "$id" ]]; then
    container_not_found api
  fi
  sudo docker stop "$id"
  echo "Stopped API container ($id)"
  print_expectation "$(cat <<EXPECT
api.${ZVIA_DOMAIN} deployment:
  • Overall health: failed or degraded
  • Domain (api.${ZVIA_DOMAIN}): healthy (nginx still serves TLS)
  • Nginx site: healthy (config valid, process running)
  • Backend :3001: failed (port not listening)
  • Docker container (zvia-demo-api): failed (exited/stopped)
  • Postgres: healthy (still running; API cannot reach it)

shop.${ZVIA_DOMAIN} deployment: unaffected (healthy)
EXPECT
)"
}

cmd_stop_db() {
  require_fullstack
  local id
  id="$(container_id postgres)"
  if [[ -z "$id" ]]; then
    container_not_found postgres
  fi
  sudo docker stop "$id"
  echo "Stopped Postgres container ($id)"
  print_expectation "$(cat <<EXPECT
api.${ZVIA_DOMAIN} deployment:
  • Overall health: degraded or failed
  • Domain: healthy
  • Nginx site: healthy
  • Backend :3001: degraded (port listening but /health returns 503)
  • Docker container (zvia-demo-api): degraded (running, DB unreachable)
  • Postgres container: failed (exited/stopped)

shop.${ZVIA_DOMAIN} deployment: unaffected (healthy)
EXPECT
)"
}

cmd_stop_frontend() {
  require_fullstack
  local id
  id="$(container_id frontend)"
  if [[ -z "$id" ]]; then
    container_not_found frontend
  fi
  sudo docker stop "$id"
  echo "Stopped frontend container ($id)"
  print_expectation "$(cat <<EXPECT
shop.${ZVIA_DOMAIN} deployment:
  • Overall health: failed
  • Domain (shop.${ZVIA_DOMAIN}): healthy
  • Nginx site: healthy
  • Backend :3000: failed (port not listening)
  • Docker container (zvia-demo-frontend): failed (exited/stopped)

api.${ZVIA_DOMAIN} deployment: unaffected (healthy if DB up)
EXPECT
)"
}

cmd_break_nginx_upstream() {
  local target="${1:-shop}"
  local port domain
  case "$target" in
    shop) port=3999; domain="$SHOP_DOMAIN" ;;
    api) port=3998; domain="$API_DOMAIN" ;;
    *)
      echo "Usage: break-nginx-upstream [shop|api]"
      exit 1
      ;;
  esac

  if [[ ! -f "$NGINX_SITE" ]]; then
    echo "Nginx site not found at $NGINX_SITE."
    echo "$FULLSTACK_PROVISION_HINT"
    exit 1
  fi

  if [[ ! -f "$NGINX_BACKUP" ]]; then
    sudo cp "$NGINX_SITE" "$NGINX_BACKUP"
  fi

  sudo sed -i "/server_name ${domain};/,/^[[:space:]]*}/ s|proxy_pass http://127.0.0.1:[0-9]*;|proxy_pass http://127.0.0.1:${port};|" "$NGINX_SITE"
  sudo nginx -t
  sudo systemctl reload nginx
  echo "Pointed ${domain} nginx upstream to dead port :${port}"
  print_expectation "$(cat <<EXPECT
${domain} deployment:
  • Overall health: failed
  • Domain: healthy (TLS cert valid)
  • Nginx site: healthy (config valid, process running)
  • Backend :3000 or :3001: failed (nothing listening on dead port)
  • Docker container: healthy (still running — break is at nginx layer)

Other deployment: unaffected unless you broke both.
EXPECT
)"
}

cmd_restore() {
  if [[ -f "$NGINX_BACKUP" ]]; then
    sudo cp "$NGINX_BACKUP" "$NGINX_SITE"
    sudo rm -f "$NGINX_BACKUP"
    sudo nginx -t
    sudo systemctl reload nginx
    echo "Restored nginx upstream configuration"
  fi

  if [[ -f "${STACK_DIR}/docker-compose.yml" ]]; then
    compose up -d --build
    echo "Docker compose stack restored"
  else
    echo "Stack directory $STACK_DIR not found — skipping compose restore"
  fi

  print_expectation "$(cat <<EXPECT
All deployments should return to healthy:
  • shop.${ZVIA_DOMAIN}: Nginx → :3000 → frontend container
  • api.${ZVIA_DOMAIN}: Nginx → :3001 → API container → Postgres

Re-scan in Zvia Deployments (or wait for cache TTL) to see green status.
EXPECT
)"
}

usage() {
  cat <<EOF
Usage: $(basename "$0") <command>

Commands:
  stop-api                Stop the API container
  stop-db                 Stop the Postgres container
  stop-frontend           Stop the frontend container
  break-nginx-upstream    Point nginx to a dead port (shop|api, default: shop)
  restore                 Restore compose stack and nginx config

Environment:
  ZVIA_DOMAIN   Base domain (default: zvia-test.local)
EOF
}

case "${1:-}" in
  stop-api) cmd_stop_api ;;
  stop-db) cmd_stop_db ;;
  stop-frontend) cmd_stop_frontend ;;
  break-nginx-upstream) cmd_break_nginx_upstream "${2:-shop}" ;;
  restore) cmd_restore ;;
  -h|--help|help) usage ;;
  *)
    usage
    exit 1
    ;;
esac
