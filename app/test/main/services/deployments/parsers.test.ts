import { describe, expect, it } from 'vitest'
import {
  parseNginxTopology,
  parseProxyPassTarget,
  primaryProxyTarget,
  primaryStaticRoot
} from '@main/services/deployments/parsers'

const NGINX_WITH_PROXY = [
  '# configuration file /etc/nginx/sites-enabled/myapp:',
  'upstream backend {',
  '    server 127.0.0.1:3000;',
  '}',
  'server {',
  '    listen 443 ssl;',
  '    server_name myapp.com;',
  '    ssl_certificate /etc/ssl/myapp/fullchain.pem;',
  '    location / {',
  '        proxy_pass http://127.0.0.1:3000;',
  '    }',
  '    location /static {',
  '        root /var/www/myapp;',
  '    }',
  '}'
].join('\n')

const TANSEY_SHAPE = [
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
  '    location /.well-known/acme-challenge/ {',
  '        root /var/www/certbot;',
  '    }',
  '    location /static/ {',
  '        alias /opt/tansey-shop/back/staticfiles/;',
  '    }',
  '    location /api/manager/scripts/ {',
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
  '    location / {',
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

describe('parseNginxTopology', () => {
  it('captures proxy_pass evidence metadata', () => {
    const topology = parseNginxTopology(NGINX_WITH_PROXY)
    expect(topology.serverBlocks).toHaveLength(1)
    const block = topology.serverBlocks[0]
    expect(block.configPath).toBe('/etc/nginx/sites-enabled/myapp')
    expect(block.startLineNumber).toBeGreaterThan(0)
    expect(block.serverNames).toContain('myapp.com')
    const proxy = primaryProxyTarget(block, topology.upstreams)
    expect(proxy?.port).toBe(3000)
    expect(proxy?.directive.configPath).toBe('/etc/nginx/sites-enabled/myapp')
    expect(proxy?.directive.lineNumber).toBeGreaterThan(0)
    expect(proxy?.directive.rawText).toContain('proxy_pass')
  })

  it('parses upstream blocks with members', () => {
    const topology = parseNginxTopology(NGINX_WITH_PROXY)
    expect(topology.upstreams).toHaveLength(1)
    expect(topology.upstreams[0].members[0].port).toBe(3000)
    expect(topology.upstreams[0].members[0].directive.lineNumber).toBeGreaterThan(0)
  })

  it('parses static root directives', () => {
    const topology = parseNginxTopology(NGINX_WITH_PROXY)
    const root = primaryStaticRoot(topology.serverBlocks[0])
    expect(root?.value).toBe('/var/www/myapp')
    expect(root?.lineNumber).toBeGreaterThan(0)
  })

  it('parses SFTP-assembled chunks with synthesized markers', () => {
    // Mirrors NginxService.getConfigDump: per-file contents joined under
    // synthesized `# configuration file` headers when `nginx -T` is denied.
    const dump = [
      '# configuration file /etc/nginx/nginx.conf:',
      'user www-data;',
      'http {',
      '    include /etc/nginx/sites-enabled/*;',
      '}',
      '# configuration file /etc/nginx/sites-enabled/tansey:',
      'server {',
      '    listen 443 ssl;',
      '    server_name tansey-shop.net;',
      '    ssl_certificate /etc/letsencrypt/live/tansey-shop.net/fullchain.pem;',
      '    location / {',
      '        proxy_pass http://127.0.0.1:4000;',
      '    }',
      '}'
    ].join('\n')
    const topology = parseNginxTopology(dump)
    expect(topology.serverBlocks).toHaveLength(1)
    expect(topology.serverBlocks[0].configPath).toBe('/etc/nginx/sites-enabled/tansey')
    expect(topology.serverBlocks[0].serverNames).toEqual(['tansey-shop.net'])
    expect(topology.serverBlocks[0].sslCertificate).toBe(
      '/etc/letsencrypt/live/tansey-shop.net/fullchain.pem'
    )
  })

  it('handles certbot trailing comments and if-blocks (tansey-shop shape)', () => {
    const topology = parseNginxTopology(TANSEY_SHAPE)
    expect(topology.serverBlocks).toHaveLength(4)
    const names = topology.serverBlocks.map((block) => block.serverNames)
    expect(names[0]).toEqual(['tansey-shop.net'])
    expect(names[1]).toEqual(['db.tansey-shop.net'])
    expect(names[2]).toEqual(['tansey-shop.net'])
    expect(names[3]).toEqual(['db.tansey-shop.net'])
    expect(topology.serverBlocks[0].sslCertificate).toBe(
      '/etc/letsencrypt/live/tansey-shop.net/fullchain.pem'
    )
    expect(topology.serverBlocks[0].ports).toEqual(expect.arrayContaining([443]))
    expect(topology.upstreams).toHaveLength(2)
    // First proxy location resolves through the named upstream.
    const proxy = primaryProxyTarget(topology.serverBlocks[0], topology.upstreams)
    expect(proxy?.host).toBe('127.0.0.1')
    expect(proxy?.port).toBe(8000)
  })
})

describe('parseProxyPassTarget', () => {
  it('handles unix sockets without inventing a port', () => {
    const target = parseProxyPassTarget({
      directive: 'proxy_pass',
      value: 'http://unix:/var/run/app.sock:',
      configPath: '/etc/nginx/sites-enabled/app',
      lineNumber: 10,
      rawText: 'proxy_pass http://unix:/var/run/app.sock:;'
    })
    expect(target.unixSocket).toBe('/var/run/app.sock')
    expect(target.port).toBeNull()
  })
})
