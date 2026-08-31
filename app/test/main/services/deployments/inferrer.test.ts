import { describe, expect, it } from 'vitest'
import type { PortListener } from '@shared/ports'
import type { TopologyEntity } from '@shared/topology'
import { clusterDeployments } from '@main/services/deployments/clusterer'
import { domainEntityId, nginxSiteEntityId, portEntityId, processEntityId } from '@shared/topology'
import { inferRelationships } from '@main/services/deployments/inferrer'

const observedAt = '2026-08-30T12:00:00.000Z'

function listener(port: number, pid: number, process = 'node'): PortListener {
  return {
    protocol: 'tcp',
    address: '127.0.0.1',
    port,
    pid,
    process,
    exposure: 'localhost',
    unit: null,
    containerId: null,
    containerName: null,
    firewall: 'unknown'
  }
}

describe('topologyInferrer', () => {
  it('attaches evidence to every confirmed proxies_to relationship', () => {
    const configPath = '/etc/nginx/sites-enabled/myapp'
    const topology = {
      serverBlocks: [
        {
          configPath,
          startLineNumber: 5,
          serverNames: ['myapp.com'],
          ports: [443],
          listensHttps: true,
          sslCertificate: null,
          sslCertificateKey: null,
          listenDirectives: [
            {
              directive: 'listen',
              value: '443 ssl',
              configPath,
              lineNumber: 2,
              rawText: 'listen 443 ssl;'
            }
          ],
          locations: [
            {
              match: '/',
              proxyPass: {
                scheme: 'http',
                host: '127.0.0.1',
                port: 3000,
                upstreamName: null,
                unixSocket: null,
                directive: {
                  directive: 'proxy_pass',
                  value: 'http://127.0.0.1:3000',
                  configPath,
                  lineNumber: 5,
                  rawText: 'proxy_pass http://127.0.0.1:3000;'
                }
              },
              root: null,
              alias: null
            }
          ]
        }
      ],
      upstreams: []
    }

    const listeners = [listener(3000, 1842)]
    const entities: Record<string, TopologyEntity> = {
      [domainEntityId('myapp.com')]: {
        id: domainEntityId('myapp.com'),
        kind: 'domain',
        label: 'myapp.com',
        status: 'healthy'
      },
      [nginxSiteEntityId(configPath, 5)]: {
        id: nginxSiteEntityId(configPath, 5),
        kind: 'nginx_site',
        label: 'myapp.com',
        status: 'healthy'
      },
      [portEntityId('tcp', '127.0.0.1', 3000)]: {
        id: portEntityId('tcp', '127.0.0.1', 3000),
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      },
      [processEntityId(1842)]: {
        id: processEntityId(1842),
        kind: 'process',
        label: 'node (1842)',
        status: 'healthy'
      }
    }

    const relationships = inferRelationships(
      { topology, certificates: [], listeners, containers: [], entities },
      observedAt
    )

    const proxyRel = relationships.find((rel) => rel.type === 'proxies_to')
    expect(proxyRel?.confidence).toBe('confirmed')
    expect(proxyRel?.evidence.length).toBeGreaterThan(0)
    expect(proxyRel?.evidence.some((item) => item.raw?.includes('proxy_pass'))).toBe(true)
  })

  it('marks conflicting listeners on the same port', () => {
    const configPath = '/etc/nginx/sites-enabled/app'
    const topology = {
      serverBlocks: [
        {
          configPath,
          startLineNumber: 10,
          serverNames: ['app.example.com'],
          ports: [],
          listensHttps: false,
          sslCertificate: null,
          sslCertificateKey: null,
          listenDirectives: [],
          locations: [
            {
              match: '/',
              proxyPass: {
                scheme: 'http',
                host: '127.0.0.1',
                port: 3000,
                upstreamName: null,
                unixSocket: null,
                directive: {
                  directive: 'proxy_pass',
                  value: 'http://127.0.0.1:3000',
                  configPath,
                  lineNumber: 4,
                  rawText: 'proxy_pass http://127.0.0.1:3000;'
                }
              },
              root: null,
              alias: null
            }
          ]
        }
      ],
      upstreams: []
    }

    const listeners = [listener(3000, 1, 'node'), listener(3000, 2, 'python')]
    const entities: Record<string, TopologyEntity> = {
      [domainEntityId('app.example.com')]: {
        id: domainEntityId('app.example.com'),
        kind: 'domain',
        label: 'app.example.com',
        status: 'healthy'
      },
      [nginxSiteEntityId(configPath, 10)]: {
        id: nginxSiteEntityId(configPath, 10),
        kind: 'nginx_site',
        label: 'app.example.com',
        status: 'healthy'
      },
      [portEntityId('tcp', '127.0.0.1', 3000)]: {
        id: portEntityId('tcp', '127.0.0.1', 3000),
        kind: 'port',
        label: ':3000',
        status: 'healthy',
        sourceRef: { port: 3000 }
      }
    }

    const relationships = inferRelationships(
      { topology, certificates: [], listeners, containers: [], entities },
      observedAt
    )

    const proxyRel = relationships.find((rel) => rel.type === 'proxies_to')
    expect(proxyRel?.confidence).toBe('conflicting')
    expect(proxyRel?.evidence.length).toBeGreaterThanOrEqual(2)
  })

  it('creates proxies_to when the backend port is not listening', () => {
    const configPath = '/etc/nginx/sites-enabled/api'
    const topology = {
      serverBlocks: [
        {
          configPath,
          startLineNumber: 15,
          serverNames: ['api.example.com'],
          ports: [443],
          listensHttps: true,
          sslCertificate: null,
          sslCertificateKey: null,
          listenDirectives: [],
          locations: [
            {
              match: '/',
              proxyPass: {
                scheme: 'http',
                host: '127.0.0.1',
                port: 3001,
                upstreamName: null,
                unixSocket: null,
                directive: {
                  directive: 'proxy_pass',
                  value: 'http://127.0.0.1:3001',
                  configPath,
                  lineNumber: 5,
                  rawText: 'proxy_pass http://127.0.0.1:3001;'
                }
              },
              root: null,
              alias: null
            }
          ]
        }
      ],
      upstreams: []
    }

    const entities: Record<string, TopologyEntity> = {
      [domainEntityId('api.example.com')]: {
        id: domainEntityId('api.example.com'),
        kind: 'domain',
        label: 'api.example.com',
        status: 'healthy'
      },
      [nginxSiteEntityId(configPath, 15)]: {
        id: nginxSiteEntityId(configPath, 15),
        kind: 'nginx_site',
        label: 'api.example.com',
        status: 'healthy'
      }
    }

    const relationships = inferRelationships(
      { topology, certificates: [], listeners: [], containers: [], entities },
      observedAt
    )

    const proxyRel = relationships.find((rel) => rel.type === 'proxies_to')
    expect(proxyRel?.confidence).toBe('likely')
    expect(entities[portEntityId('tcp', '127.0.0.1', 3001)]?.status).toBe('failed')
  })

  it('creates runtime entity for unix socket proxy_pass targets', () => {
    const socketPath = '/var/run/myapp.sock'
    const configPath = '/etc/nginx/sites-enabled/socket-app'
    const topology = {
      serverBlocks: [
        {
          configPath,
          startLineNumber: 8,
          serverNames: ['socket.example.com'],
          ports: [443],
          listensHttps: true,
          sslCertificate: null,
          sslCertificateKey: null,
          listenDirectives: [],
          locations: [
            {
              match: '/',
              proxyPass: {
                scheme: 'http',
                host: null,
                port: null,
                upstreamName: null,
                unixSocket: socketPath,
                directive: {
                  directive: 'proxy_pass',
                  value: `unix:${socketPath}`,
                  configPath,
                  lineNumber: 6,
                  rawText: `proxy_pass unix:${socketPath};`
                }
              },
              root: null,
              alias: null
            }
          ]
        }
      ],
      upstreams: []
    }

    const entities: Record<string, TopologyEntity> = {
      [domainEntityId('socket.example.com')]: {
        id: domainEntityId('socket.example.com'),
        kind: 'domain',
        label: 'socket.example.com',
        status: 'healthy'
      },
      [nginxSiteEntityId(configPath, 8)]: {
        id: nginxSiteEntityId(configPath, 8),
        kind: 'nginx_site',
        label: 'socket.example.com',
        status: 'healthy'
      }
    }

    const relationships = inferRelationships(
      { topology, certificates: [], listeners: [], containers: [], entities },
      observedAt
    )

    const runtimeId = `unix:${socketPath}`
    expect(entities[runtimeId]).toMatchObject({
      kind: 'runtime',
      label: socketPath,
      navigate: { tool: 'files', path: socketPath }
    })

    const proxyRel = relationships.find((rel) => rel.type === 'proxies_to')
    expect(proxyRel?.to.id).toBe(runtimeId)
    expect(proxyRel?.id).toBe(`rel:proxies_to:${nginxSiteEntityId(configPath, 8)}:${runtimeId}`)

    const { deployments } = clusterDeployments({
      serverBlocks: topology.serverBlocks,
      relationships,
      entities
    })

    const deployment = deployments.find((entry) => entry.name === 'socket.example.com')
    expect(deployment?.entityIds).toContain(runtimeId)
  })
})
