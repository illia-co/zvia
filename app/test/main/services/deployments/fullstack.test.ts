import { describe, expect, it } from 'vitest'
import type { DockerContainer } from '@shared/docker'
import type { PortListener } from '@shared/ports'
import {
  containerEntityId,
  deploymentEntityId,
  domainEntityId,
  nginxSiteEntityId,
  portEntityId
} from '@shared/topology'
import { parseNginxTopology } from '@main/services/deployments/parsers'
import { normalizeEntities } from '@main/services/deployments/normalizers'
import { inferRelationships } from '@main/services/deployments/inferrer'
import { clusterDeployments } from '@main/services/deployments/clusterer'
import { applyEntityHealth, enrichDeployments } from '@main/services/deployments/health'

const SHOP_DOMAIN = 'shop.zvia-test.local'
const API_DOMAIN = 'api.zvia-test.local'
const CONFIG_PATH = '/etc/nginx/sites-available/zvia-fullstack'

/** Mirrors the nginx site block from app/scripts/orbstack/provision.sh */
const FULLSTACK_NGINX = `
# configuration file ${CONFIG_PATH}:
server {
    listen 80;
    listen [::]:80;
    server_name ${SHOP_DOMAIN} ${API_DOMAIN};

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${SHOP_DOMAIN};

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${API_DOMAIN};

    ssl_certificate /etc/ssl/zvia-test/fullchain.pem;
    ssl_certificate_key /etc/ssl/zvia-test/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
`

function listener(port: number, containerId: string | null, containerName: string | null): PortListener {
  return {
    protocol: 'tcp',
    address: '127.0.0.1',
    port,
    pid: port === 3000 ? 1001 : 1002,
    process: 'docker-proxy',
    exposure: 'localhost',
    unit: null,
    containerId,
    containerName,
    firewall: 'unknown'
  }
}

function container(
  id: string,
  name: string,
  hostPort: number,
  state: 'running' | 'exited' = 'running'
): DockerContainer {
  return {
    id,
    name,
    status: state === 'running' ? 'Up 2 minutes' : 'Exited (0) 1 minute ago',
    state,
    image: name,
    ports: `127.0.0.1:${hostPort}->${hostPort}/tcp`,
    uptime: '2 minutes',
    cpuPercent: '0.1%',
    memoryUsage: '10MiB / 1GiB',
    memoryPercent: '1%'
  }
}

function buildFullstackSnapshot(state: 'healthy' | 'api-stopped' = 'healthy') {
  const observedAt = '2026-08-31T12:00:00.000Z'
  const nginxTopology = parseNginxTopology(FULLSTACK_NGINX)
  const listeners = [
    listener(3000, 'frontend123', 'zvia-demo-frontend-1'),
    ...(state === 'healthy' ? [listener(3001, 'api456', 'zvia-demo-api-1')] : [])
  ]
  const containers = [
    container('frontend123', 'zvia-demo-frontend-1', 3000),
    container('api456', 'zvia-demo-api-1', 3001, state === 'healthy' ? 'running' : 'exited')
  ]

  const collectorData = {
    serverBlocks: nginxTopology.serverBlocks,
    certificates: [],
    listeners,
    units: [],
    containers,
    processes: new Map(),
    nginxRunning: true
  }

  const entities = normalizeEntities(collectorData)
  const relationships = inferRelationships(
    {
      topology: nginxTopology,
      certificates: [],
      listeners,
      containers,
      entities
    },
    observedAt
  )

  applyEntityHealth(entities, relationships, listeners)

  const { deployments: rawDeployments } = clusterDeployments({
    serverBlocks: nginxTopology.serverBlocks,
    relationships,
    entities
  })

  const deployments = enrichDeployments(rawDeployments, entities, relationships)

  return {
    nginxTopology,
    entities,
    relationships,
    deployments
  }
}

describe('fullstack nginx fixture', () => {
  it('clusters shop and api into separate deployments with distinct nginx site IDs', () => {
    const { nginxTopology, deployments } = buildFullstackSnapshot()

    const tlsBlocks = nginxTopology.serverBlocks.filter((block) =>
      block.serverNames.some((name) => name === SHOP_DOMAIN || name === API_DOMAIN)
    )
    const shopBlock = tlsBlocks.find((block) => block.serverNames.includes(SHOP_DOMAIN) && block.listensHttps)
    const apiBlock = tlsBlocks.find((block) => block.serverNames.includes(API_DOMAIN) && block.listensHttps)

    expect(shopBlock).toBeDefined()
    expect(apiBlock).toBeDefined()
    expect(shopBlock!.startLineNumber).not.toBe(apiBlock!.startLineNumber)

    const shopSiteId = nginxSiteEntityId(CONFIG_PATH, shopBlock!.startLineNumber)
    const apiSiteId = nginxSiteEntityId(CONFIG_PATH, apiBlock!.startLineNumber)
    expect(shopSiteId).not.toBe(apiSiteId)

    expect(deployments.map((deployment) => deployment.name)).toEqual([SHOP_DOMAIN, API_DOMAIN])

    const shopDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId(SHOP_DOMAIN)
    )
    const apiDeployment = deployments.find(
      (deployment) => deployment.id === deploymentEntityId(API_DOMAIN)
    )

    expect(shopDeployment?.entityIds).toContain(shopSiteId)
    expect(shopDeployment?.entityIds).toContain(portEntityId('tcp', '127.0.0.1', 3000))
    expect(shopDeployment?.entityIds).toContain(containerEntityId('frontend123'))
    expect(shopDeployment?.entityIds).not.toContain(apiSiteId)
    expect(shopDeployment?.entityIds).not.toContain(domainEntityId(API_DOMAIN))

    expect(apiDeployment?.entityIds).toContain(apiSiteId)
    expect(apiDeployment?.entityIds).toContain(portEntityId('tcp', '127.0.0.1', 3001))
    expect(apiDeployment?.entityIds).toContain(containerEntityId('api456'))
    expect(apiDeployment?.entityIds).not.toContain(shopSiteId)
    expect(apiDeployment?.entityIds).not.toContain(domainEntityId(SHOP_DOMAIN))
    expect(apiDeployment?.entityIds).not.toContain(portEntityId('tcp', '127.0.0.1', 3000))
  })

  it('marks api deployment failed when the API container is stopped', () => {
    const { deployments, entities } = buildFullstackSnapshot('api-stopped')
    const shop = deployments.find((deployment) => deployment.id === deploymentEntityId(SHOP_DOMAIN))
    const api = deployments.find((deployment) => deployment.id === deploymentEntityId(API_DOMAIN))

    expect(shop?.health).toBe('healthy')
    expect(api?.health).toBe('failed')
    expect(api?.componentStatus.backend).toBe('failed')
    expect(api?.componentStatus.container).toBe('failed')
    expect(entities[containerEntityId('api456')]?.status).toBe('failed')
  })
})
