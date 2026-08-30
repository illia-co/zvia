#!/usr/bin/env bash
# Provisions the OrbStack Ubuntu VM with a realistic server deployment stack
# for integration-testing Zvia against docker, nginx, cron, systemd, SSL, and UFW.
set -euo pipefail

ZVIA_DOMAIN="${ZVIA_DOMAIN:-zvia-test.local}"
ZVIA_APP_PORT="${ZVIA_APP_PORT:-8080}"
MARKER_FILE="/var/lib/zvia-provisioned"

if [[ -f "$MARKER_FILE" ]]; then
  echo "Already provisioned ($(cat "$MARKER_FILE")). Re-run with FORCE=1 to reprovision."
  [[ "${FORCE:-0}" == "1" ]] || exit 0
fi

echo "==> Updating packages"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  docker.io \
  certbot \
  python3-certbot-nginx \
  ufw \
  openssl \
  curl \
  jq \
  iproute2 \
  lsof

echo "==> Configuring Docker"
sudo systemctl enable --now docker
sudo usermod -aG docker "$USER" || true

echo "==> Deploying sample Docker stack"
sudo docker rm -f zvia-web zvia-api 2>/dev/null || true
sudo docker pull nginx:alpine
sudo docker pull hello-world
sudo docker run -d --name zvia-web --restart unless-stopped \
  -p 127.0.0.1:${ZVIA_APP_PORT}:80 \
  nginx:alpine
sudo docker run --rm --name zvia-api-once hello-world >/dev/null

echo "==> Creating self-signed TLS certificate"
sudo mkdir -p /etc/ssl/zvia-test
if [[ ! -f /etc/ssl/zvia-test/fullchain.pem ]]; then
  sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/ssl/zvia-test/privkey.pem \
    -out /etc/ssl/zvia-test/fullchain.pem \
    -subj "/CN=${ZVIA_DOMAIN}/O=Zvia Test/C=US" \
    -addext "subjectAltName=DNS:${ZVIA_DOMAIN},DNS:localhost"
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
NGINX

sudo ln -sf /etc/nginx/sites-available/zvia-test /etc/nginx/sites-enabled/zvia-test
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx

echo "==> Enabling certbot timer"
sudo systemctl enable --now certbot.timer 2>/dev/null || true

echo "==> Configuring cron jobs"
(
  crontab -l 2>/dev/null | grep -v '# zvia-test' || true
  echo "*/15 * * * * echo zvia-user-cron-\$(date +\\%s) >> /tmp/zvia-cron.log # zvia-test"
) | crontab -

sudo tee /etc/cron.d/zvia-test >/dev/null <<'CRON'
# zvia-test system cron job
*/30 * * * * root echo "zvia-cron-d-$(date +\%s)" >> /tmp/zvia-cron.log
CRON

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
sudo ufw --force enable

echo "==> Verifying deployment"
sudo docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
sudo nginx -t
sudo systemctl is-active nginx
sudo systemctl is-active docker
sudo systemctl is-active zvia-heartbeat.timer
sudo certbot --version
curl -sk "https://localhost/" | head -1

date -Iseconds | sudo tee "$MARKER_FILE" >/dev/null
echo "==> Provision complete"
