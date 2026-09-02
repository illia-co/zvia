#!/usr/bin/env bash
# Provisions the OrbStack Ubuntu VM with a realistic server deployment stack
# for integration-testing Zvia against docker, nginx, cron, systemd, SSL, and UFW.
#
# Set ZVIA_FULLSTACK=1 to additionally deploy the shop/api/postgres compose stack
# for Deployments topology testing.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ZVIA_DOMAIN="${ZVIA_DOMAIN:-zvia-test.local}"
ZVIA_APP_PORT="${ZVIA_APP_PORT:-8080}"
ZVIA_FULLSTACK="${ZVIA_FULLSTACK:-0}"
MARKER_FILE="/var/lib/zvia-provisioned"
SHOP_DOMAIN="shop.${ZVIA_DOMAIN}"
API_DOMAIN="api.${ZVIA_DOMAIN}"
STACK_DIR="/opt/zvia-demo"

if [[ -f "$MARKER_FILE" ]]; then
  echo "Already provisioned ($(cat "$MARKER_FILE")). Re-run with FORCE=1 to reprovision."
  [[ "${FORCE:-0}" == "1" ]] || exit 0
fi

APT_PACKAGES=(
  docker.io
  certbot
  python3-certbot-nginx
  ufw
  openssl
  curl
  jq
  iproute2
  lsof
)

if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
  APT_PACKAGES+=(docker-compose-v2)
fi

echo "==> Updating packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "${APT_PACKAGES[@]}"

echo "==> Configuring Docker"
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

echo "==> Deploying sample Docker stack"
sudo docker rm -f zvia-web zvia-api 2>/dev/null || true
for cid in $(sudo docker ps -q --filter "publish=${ZVIA_APP_PORT}" 2>/dev/null); do
  sudo docker rm -f "$cid" 2>/dev/null || true
done
sudo docker pull nginx:alpine
sudo docker pull hello-world
sudo docker run -d --name zvia-web --restart unless-stopped \
  -p 127.0.0.1:${ZVIA_APP_PORT}:80 \
  nginx:alpine
sudo docker run --rm --name zvia-api-once hello-world >/dev/null

create_tls_cert() {
  local sans="DNS:${ZVIA_DOMAIN},DNS:localhost"
  if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
    sans="${sans},DNS:${SHOP_DOMAIN},DNS:${API_DOMAIN},DNS:admin.${ZVIA_DOMAIN}"
  else
    sans="${sans},DNS:admin.${ZVIA_DOMAIN}"
  fi

  echo "==> Creating self-signed TLS certificate (SANs: ${sans})"
  sudo mkdir -p /etc/ssl/zvia-test
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/zvia-test/privkey.pem \
    -out /etc/ssl/zvia-test/fullchain.pem \
    -subj "/CN=${ZVIA_DOMAIN}/O=Zvia Test/C=US" \
    -addext "subjectAltName=${sans}"
}

echo "==> TLS certificate"
sudo mkdir -p /etc/ssl/zvia-test
if [[ ! -f /etc/ssl/zvia-test/fullchain.pem ]] || [[ "${FORCE:-0}" == "1" ]]; then
  create_tls_cert
else
  echo "Certificate exists; skipping (use FORCE=1 to regenerate)"
fi

echo "==> Configuring nginx"
sudo tee /etc/nginx/sites-available/zvia-test >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${ZVIA_DOMAIN} localhost;

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${ZVIA_DOMAIN} localhost;

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    access_log /var/log/nginx/zvia-test.access.log;
    error_log /var/log/nginx/zvia-test.error.log;

    location / {
        proxy_pass http://127.0.0.1:${ZVIA_APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name admin.${ZVIA_DOMAIN};

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:${ZVIA_APP_PORT};
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/zvia-test /etc/nginx/sites-enabled/zvia-test
sudo rm -f /etc/nginx/sites-enabled/default

provision_fullstack() {
  echo "==> Deploying fullstack compose stack to ${STACK_DIR}"
  sudo mkdir -p "$STACK_DIR"
  sudo rm -rf "${STACK_DIR:?}"/*
  sudo cp -a "${SCRIPT_DIR}/fixtures/fullstack/." "${STACK_DIR}/"

  compose_cmd() {
    if sudo docker compose version >/dev/null 2>&1; then
      sudo docker compose -f "${STACK_DIR}/docker-compose.yml" "$@"
    elif command -v docker-compose >/dev/null 2>&1; then
      sudo docker-compose -f "${STACK_DIR}/docker-compose.yml" "$@"
    else
      echo "docker compose not available" >&2
      exit 1
    fi
  }

  cd "$STACK_DIR"
  compose_cmd down --remove-orphans 2>/dev/null || true
  compose_cmd up -d --build

  echo "==> Configuring nginx fullstack sites"
  sudo tee /etc/nginx/sites-available/zvia-fullstack >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${SHOP_DOMAIN} ${API_DOMAIN};

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${SHOP_DOMAIN};

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    access_log /var/log/nginx/shop.access.log;
    error_log /var/log/nginx/shop.error.log;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${API_DOMAIN};

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    access_log /var/log/nginx/api.access.log;
    error_log /var/log/nginx/api.error.log;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
NGINX

  sudo ln -sf /etc/nginx/sites-available/zvia-fullstack /etc/nginx/sites-enabled/zvia-fullstack
  sudo rm -f /etc/nginx/sites-available/zvia-fullstack.bak

  echo "==> Waiting for fullstack services"
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1 && \
       curl -sf http://127.0.0.1:3000/ | grep -q zvia-demo-shop; then
      echo "Fullstack services ready"
      break
    fi
    if [[ "$i" -eq 30 ]]; then
      echo "Warning: fullstack services did not become healthy in time"
      compose_cmd ps
    fi
    sleep 2
  done
}

provision_nonnginx() {
  local nonnginx_dir="${STACK_DIR}/nonnginx"
  echo "==> Deploying non-nginx compose stack to ${nonnginx_dir}"
  sudo mkdir -p "$nonnginx_dir"
  sudo rm -rf "${nonnginx_dir:?}"/*
  sudo cp -a "${SCRIPT_DIR}/fixtures/fullstack/nonnginx/." "${nonnginx_dir}/"

  if sudo docker compose version >/dev/null 2>&1; then
    sudo docker compose -f "${nonnginx_dir}/docker-compose.yml" down --remove-orphans 2>/dev/null || true
    sudo docker compose -f "${nonnginx_dir}/docker-compose.yml" up -d --build
  else
    echo "docker compose not available" >&2
    exit 1
  fi

  echo "==> Waiting for non-nginx API"
  for i in $(seq 1 30); do
    if curl -sf http://127.0.0.1:4001/health >/dev/null 2>&1; then
      echo "Non-nginx API ready"
      break
    fi
    if [[ "$i" -eq 30 ]]; then
      echo "Warning: non-nginx API did not become healthy in time"
      sudo docker compose -f "${nonnginx_dir}/docker-compose.yml" ps
    fi
    sleep 2
  done
}

if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
  provision_fullstack
  provision_nonnginx
fi

sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> Enabling certbot timer"
sudo systemctl enable --now certbot.timer 2>/dev/null || true

echo "==> Configuring cron jobs"
(
  crontab -l 2>/dev/null | grep -v '# zvia-test' || true
  echo "*/15 * * * * echo zvia-user-cron-\$(date +\\%s) >> /tmp/zvia-cron.log # zvia-test"
  if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
    echo "*/5 * * * * curl -sf http://127.0.0.1:3001/health >> /tmp/zvia-api-health.log 2>&1 || echo fail-\$(date +\\%s) >> /tmp/zvia-api-health.log # zvia-test"
  fi
) | crontab -

sudo tee /etc/cron.d/zvia-test >/dev/null <<CRON
# zvia-test system cron job
*/30 * * * * root echo "zvia-cron-d-\$(date +\%s)" >> /tmp/zvia-cron.log
CRON

if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
  sudo tee -a /etc/cron.d/zvia-test >/dev/null <<CRON
*/10 * * * * root curl -sf http://127.0.0.1:3001/health >/dev/null 2>&1 || echo "api-health-fail-\$(date +\%s)" >> /tmp/zvia-api-health.log
CRON
fi

echo "==> Creating sample systemd service"
sudo tee /etc/systemd/system/zvia-heartbeat.service >/dev/null <<'UNIT'
[Unit]
Description=Zvia integration test heartbeat
After=network.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo zvia-heartbeat-$(date +%s) >> /tmp/zvia-heartbeat.log'
UNIT

sudo tee /etc/systemd/system/zvia-heartbeat.timer >/dev/null <<'TIMER'
[Unit]
Description=Zvia integration test heartbeat timer

[Timer]
OnBootSec=30
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
TIMER

sudo systemctl daemon-reload
sudo systemctl enable --now zvia-heartbeat.timer

echo "==> Configuring UFW"
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw allow ${ZVIA_APP_PORT}/tcp comment 'Zvia test app'
if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
  sudo ufw allow 3000/tcp comment 'Zvia demo frontend'
  sudo ufw allow 3001/tcp comment 'Zvia demo API'
  sudo ufw allow 4001/tcp comment 'Zvia non-nginx demo API'
fi
sudo ufw --force enable

echo "==> Verifying deployment"
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo nginx -t
sudo systemctl is-active nginx
sudo systemctl is-active docker
sudo systemctl is-active zvia-heartbeat.timer
sudo certbot --version
curl -sk "https://localhost/" | head -1

if [[ "$ZVIA_FULLSTACK" == "1" ]]; then
  curl -sf http://127.0.0.1:3001/health | head -1
  curl -sf http://127.0.0.1:3000/ | grep -o zvia-demo-shop
  curl -sk --resolve "${SHOP_DOMAIN}:443:127.0.0.1" "https://${SHOP_DOMAIN}/" | grep -o zvia-demo-shop
  curl -sk --resolve "${API_DOMAIN}:443:127.0.0.1" "https://${API_DOMAIN}/health" | head -1
  curl -sf http://127.0.0.1:4001/health | head -1
  sudo docker ps --format '{{.Names}}\t{{.Label "com.docker.compose.project"}}' | grep zvia-nonnginx || true
fi

{
  date -Iseconds
  echo "fullstack=${ZVIA_FULLSTACK}"
} | sudo tee "$MARKER_FILE" >/dev/null
echo "==> Provision complete (fullstack=${ZVIA_FULLSTACK})"
