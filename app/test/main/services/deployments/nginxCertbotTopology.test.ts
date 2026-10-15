import { describe, expect, it } from 'vitest'
import { parseNginxTopology } from '@main/services/deployments/parsers'
import { normalizeEntities } from '@main/services/deployments/normalizers'
import { inferRelationships } from '@main/services/deployments/inferrer'
import { clusterDeployments } from '@main/services/deployments/clusterer'
import {
  certEntriesFromRenewalConfs,
  linkCertificatesToSites
} from '@main/services/sslParsers'

const TANSEY_T = [
  '# configuration file /etc/nginx/nginx.conf:',
  'http {',
  '    include /etc/nginx/sites-enabled/*;',
  '}',
  '# configuration file /etc/nginx/sites-enabled/tansey:',
  'upstream tansey_api {',
  '    server 127.0.0.1:8000;',
  '    keepalive 16;',
  '}',
  'upstream tansey_ssr {',
  '    server 127.0.0.1:4000;',
  '    keepalive 16;',
  '}',
  'server {',
  '    server_name tansey-shop.net;',
  '    client_max_body_size 100m;',
  '    location /.well-known/acme-challenge/ {',
  '        root /var/www/certbot;',
  '    }',
  '    location /static/ {',
  '        alias /opt/tansey-shop/back/staticfiles/;',
  '        expires 30d;',
  '        access_log off;',
  '    }',
  '    location /media/ {',
  '        alias /opt/tansey-shop/back/media/;',
  '        expires 7d;',
  '        access_log off;',
  '    }',
  '    location /api/manager/scripts/ {',
  '        proxy_pass http://tansey_api;',
  '        proxy_read_timeout 1800s;',
  '    }',
  '    location /api/ {',
  '        limit_req zone=api burst=20 nodelay;',
  '        proxy_pass http://tansey_api;',
  '    }',
  '    location /admin/ {',
  '        proxy_pass http://tansey_api;',
  '    }',
  '    location = /sitemap.xml {',
  '        proxy_pass http://tansey_api;',
  '    }',
  '    location = /robots.txt {',
  '        proxy_pass http://tansey_api;',
  '    }',
  '    location / {',
  '        proxy_pass http://tansey_ssr;',
  '    }',
  '    listen [::]:443 ssl ipv6only=on; # managed by Certbot',
  '    listen 443 ssl; # managed by Certbot',
  '    ssl_certificate /etc/letsencrypt/live/tansey-shop.net/fullchain.pem; # managed by Certbot',
  '    ssl_certificate_key /etc/letsencrypt/live/tansey-shop.net/privkey.pem; # managed by Certbot',
  '    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot',
  '    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot',
  '}',
  'server {',
  '    server_name db.tansey-shop.net;',
  '    location /.well-known/acme-challenge/ {',
  '        root /var/www/certbot;',
  '    }',
  '    location / {',
  '        auth_basic "DB Admin";',
  '        proxy_pass http://127.0.0.1:8080;',
  '    }',
  '    listen [::]:443 ssl; # managed by Certbot',
  '    listen 443 ssl; # managed by Certbot',
  '    ssl_certificate /etc/letsencrypt/live/tansey-shop.net/fullchain.pem; # managed by Certbot',
  '    ssl_certificate_key /etc/letsencrypt/live/tansey-shop.net/privkey.pem; # managed by Certbot',
  '}',
  'server {',
  '    if ($host = tansey-shop.net) {',
  '        return 301 https://$host$request_uri;',
  '    } # managed by Certbot',
  '    listen 80;',
  '    listen [::]:80;',
  '    server_name tansey-shop.net;',
  '    return 404; # managed by Certbot',
  '}',
  'server {',
  '    if ($host = db.tansey-shop.net) {',
  '        return 301 https://$host$request_uri;',
  '    } # managed by Certbot',
  '    listen 80;',
  '    listen [::]:80;',
  '    server_name db.tansey-shop.net;',
  '    return 404; # managed by Certbot',
  '}'
].join('\n')

const RENEWAL_CONF = [
  'version = 2.9.0',
  'archive_dir = /etc/letsencrypt/archive/tansey-shop.net',
  'cert = /etc/letsencrypt/live/tansey-shop.net/cert.pem',
  'privkey = /etc/letsencrypt/live/tansey-shop.net/privkey.pem',
  'authenticator = nginx',
  'installer = nginx'
].join('\n')

describe('tansey-shop end-to-end (password-sudo: no openssl, renewal-conf only)', () => {
  it('recognizes deployments, domains, proxy targets and the certbot certificate', () => {
    const topology = parseNginxTopology(TANSEY_T)
    expect(topology.serverBlocks).toHaveLength(4)

    // Renewal-conf fallback as it runs for password-sudo (plain cat).
    const entries = certEntriesFromRenewalConfs([
      { file: '/etc/letsencrypt/renewal/tansey-shop.net.conf', content: RENEWAL_CONF }
    ])
    expect(entries).toHaveLength(1)

    // openssl unreadable (root-only live dir) — exactly the degraded path.
    const certificates = linkCertificatesToSites(
      entries.map((entry) => ({
        id: entry.certName,
        certificatePath: entry.certificatePath,
        privateKeyPath: entry.privateKeyPath,
        managedByCertbot: true,
        openssl: null,
        certbotDomains: entry.domains,
        expiryDate: null,
        inspectionError: 'permission denied',
        lastRenewalResult: null,
        renewalMethod: 'systemd-timer' as const,
        lastAttempt: null
      })),
      topology.serverBlocks
    )
    expect(certificates).toHaveLength(1)
    expect(certificates[0].primaryDomain).toBe('tansey-shop.net')
    expect(certificates[0].domains).toEqual(['tansey-shop.net', 'db.tansey-shop.net'])
    expect(certificates[0].managedByCertbot).toBe(true)
    expect(certificates[0].nginxSites).toHaveLength(2)

    const listeners = [
      { protocol: 'tcp', address: '0.0.0.0', port: 443, pid: 100, process: 'nginx', unit: 'nginx.service' },
      { protocol: 'tcp', address: '0.0.0.0', port: 80, pid: 100, process: 'nginx', unit: 'nginx.service' },
      { protocol: 'tcp', address: '127.0.0.1', port: 8000, pid: 200, process: 'gunicorn', unit: null },
      { protocol: 'tcp', address: '127.0.0.1', port: 4000, pid: 300, process: 'node', unit: null },
      { protocol: 'tcp', address: '127.0.0.1', port: 8080, pid: 400, process: 'pma', unit: null }
    ] as never
    const processes = new Map([
      [100, { pid: 100, comm: 'nginx', args: 'nginx: master' }],
      [200, { pid: 200, comm: 'gunicorn', args: 'gunicorn app' }],
      [300, { pid: 300, comm: 'node', args: 'node ssr' }],
      [400, { pid: 400, comm: 'pma', args: 'phpmyadmin' }]
    ]) as never

    const entities = normalizeEntities({
      serverBlocks: topology.serverBlocks,
      certificates,
      listeners,
      units: [],
      containers: [],
      processes,
      nginxRunning: true
    })
    const relationships = inferRelationships(
      { topology, certificates, listeners, containers: [], entities },
      new Date().toISOString()
    )
    const { deployments } = clusterDeployments({
      serverBlocks: topology.serverBlocks,
      relationships,
      entities
    })

    const names = deployments.map((d) => d.name).sort()
    expect(names).toEqual(['db.tansey-shop.net', 'tansey-shop.net'])

    const shop = deployments.find((d) => d.name === 'tansey-shop.net')!
    const kinds = new Set(shop.entityIds.map((id) => entities[id]?.kind))
    // domain + nginx sites + ssl cert + ports claimed into one deployment
    expect(kinds.has('domain')).toBe(true)
    expect(kinds.has('nginx_site')).toBe(true)
    expect(kinds.has('ssl_certificate')).toBe(true)
    expect(kinds.has('port')).toBe(true)

    const db = deployments.find((d) => d.name === 'db.tansey-shop.net')!
    expect(db.entityIds.length).toBeGreaterThan(2)
  })
})
