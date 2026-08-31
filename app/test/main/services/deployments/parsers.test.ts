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
