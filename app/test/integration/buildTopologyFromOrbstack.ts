import type { OrbstackSession } from './orbstackSsh'
import { buildTopologySnapshot } from '@main/services/deployments/buildSnapshot'
import type { TopologyCollectionResult } from '@main/services/deployments/collector'
import type { TopologySnapshot } from '@shared/topology'
import type { DockerContainer } from '@shared/docker'
import type { PortListener } from '@shared/ports'
import type { ProcessDetail } from '@shared/processes'
import type { SystemdUnit } from '@shared/systemd'
import type { SslCertificate } from '@shared/ssl'
import { classifyExposure } from '@main/services/portParsers'
import {
  CGROUP_BLOCK_PREFIX,
  parseCgroupBlocks,
  parseDockerPsIds,
  parseSsOutput,
  resolveContainerName
} from '@main/services/portParsers'
import { parseOpensslCertificate } from '@main/services/sslParsers'
import { mergeUnits, parseListUnitsJson, parseListUnitsPlain, parseUnitFileStates } from '@main/services/systemdParsers'
import { parseNginxTopology } from '@main/services/deployments/parsers'

interface DockerPsRow {
  ID: string
  Names: string
  Status: string
  State: string
  Image: string
  Ports: string
  RunningFor?: string
}

function parseJsonLines<T>(stdout: string): T[] {
  const rows: T[] = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      rows.push(JSON.parse(trimmed) as T)
    } catch {
      // Skip malformed lines.
    }
  }
  return rows
}

function normalizeContainerName(names: string): string {
  return names.replace(/^\//, '').split(',')[0]?.trim() || names
}

async function collectListeners(session: OrbstackSession): Promise<PortListener[]> {
  const candidates = ['sudo -n ss -tulpnH 2>/dev/null', 'ss -tulpnH 2>/dev/null', 'ss -tulpn 2>/dev/null']

  let rawListeners: ReturnType<typeof parseSsOutput> = []
  for (const command of candidates) {
    const result = await session.exec(command)
    if (result.exitCode === 0 && result.stdout.trim()) {
      rawListeners = parseSsOutput(result.stdout)
      break
    }
  }

  const pids = [...new Set(rawListeners.map((listener) => listener.pid))].filter(
    (pid): pid is number => Number.isInteger(pid) && pid !== null && pid > 0
  )

  let attributions = new Map<number, { unit: string | null; containerId: string | null }>()
  if (pids.length > 0) {
    const command = pids
      .map((pid) => `echo '${CGROUP_BLOCK_PREFIX}${pid}---'; cat /proc/${pid}/cgroup 2>/dev/null`)
      .join('; ')
    const result = await session.exec(command)
    attributions = parseCgroupBlocks(result.stdout)
  }

  const hasContainers = [...attributions.values()].some((entry) => entry.containerId)
  let containers: { id: string; name: string }[] = []
  if (hasContainers) {
    const result = await session.exec("docker ps --format '{{.ID}} {{.Names}}'")
    if (result.exitCode === 0) {
      containers = parseDockerPsIds(result.stdout)
    }
  }

  return rawListeners.map((listener) => {
    const attribution = listener.pid === null ? undefined : attributions.get(listener.pid)
    const containerId = attribution?.containerId ?? null
    return {
      protocol: listener.protocol,
      address: listener.address,
      port: listener.port,
      pid: listener.pid,
      process: listener.process,
      exposure: classifyExposure(listener.address),
      unit: attribution?.unit ?? null,
      containerId,
      containerName: containerId ? resolveContainerName(containerId, containers) : null,
      firewall: 'unknown' as const
    }
  })
}

async function collectContainers(session: OrbstackSession): Promise<DockerContainer[]> {
  const result = await session.exec("docker ps -a --format '{{json .}}'")
  if (result.exitCode !== 0 || !result.stdout.trim()) {
    return []
  }

  return parseJsonLines<DockerPsRow>(result.stdout).map((row) => ({
    id: row.ID,
    name: normalizeContainerName(row.Names),
    status: row.Status,
    state: row.State,
    image: row.Image,
    ports: row.Ports || '—',
    uptime: row.RunningFor || '—',
    cpuPercent: '—',
    memoryUsage: '—',
    memoryPercent: '—'
  }))
}

async function collectUnits(session: OrbstackSession): Promise<SystemdUnit[]> {
  const jsonResult = await session.exec(
    'systemctl list-units --type=service --all --no-pager --output=json'
  )
  let rows = jsonResult.exitCode === 0 ? parseListUnitsJson(jsonResult.stdout) : null
  if (!rows) {
    const plainResult = await session.exec(
      'systemctl list-units --type=service --all --no-pager --plain --no-legend'
    )
    if (plainResult.exitCode !== 0) return []
    rows = parseListUnitsPlain(plainResult.stdout)
  }

  const filesResult = await session.exec(
    'systemctl list-unit-files --type=service --no-pager --plain --no-legend'
  )
  const unitFileStates =
    filesResult.exitCode === 0 ? parseUnitFileStates(filesResult.stdout) : new Map<string, string>()

  return mergeUnits(rows, unitFileStates)
}

async function collectCertificates(session: OrbstackSession): Promise<SslCertificate[]> {
  const result = await session.exec(
    'openssl x509 -in /etc/ssl/zvia-test/fullchain.pem -noout -dates -subject -issuer 2>/dev/null'
  )
  if (result.exitCode !== 0 || !result.stdout.trim()) return []

  const openssl = parseOpensslCertificate(result.stdout)
  const primaryDomain = openssl.subjectCn ?? 'zvia-test.local'
  const expiresAt = openssl.notAfter
  const daysRemaining =
    expiresAt === null
      ? null
      : Math.ceil((Date.parse(expiresAt) - Date.now()) / (1000 * 60 * 60 * 24))

  return [
    {
      id: 'zvia-test-self-signed',
      primaryDomain,
      domains: openssl.sans.length > 0 ? openssl.sans : [primaryDomain],
      status: daysRemaining !== null && daysRemaining < 0 ? 'expired' : 'valid',
      issuer: openssl.issuer,
      issuedAt: openssl.notBefore,
      expiresAt,
      daysRemaining,
      certificatePath: '/etc/ssl/zvia-test/fullchain.pem',
      privateKeyPath: '/etc/ssl/zvia-test/privkey.pem',
      managedByCertbot: false,
      renewal: { method: 'none', lastAttempt: null, lastResult: null },
      nginxSites: [],
      inspectionError: null
    }
  ]
}

async function collectProcesses(
  session: OrbstackSession,
  listeners: PortListener[]
): Promise<Map<number, ProcessDetail>> {
  const processes = new Map<number, ProcessDetail>()
  const pids = [...new Set(listeners.map((listener) => listener.pid).filter((pid): pid is number => pid !== null))]

  for (const pid of pids) {
    const result = await session.exec(`ps -p ${pid} -o comm= 2>/dev/null`)
    if (result.exitCode !== 0) continue
    const comm = result.stdout.trim() || 'process'
    processes.set(pid, {
      pid,
      user: 'unknown',
      cpuPercent: 0,
      memoryPercent: 0,
      rssBytes: 0,
      stat: '',
      elapsedSeconds: 0,
      comm,
      args: comm,
      ppid: 0,
      state: 'running',
      uid: 0,
      cmdline: comm,
      exe: null,
      cwd: null,
      cgroupUnit: null,
      containerId: null,
      containerName: null,
      unit: null,
      unitActiveState: null,
      listeningPorts: [],
      protected: false,
      protectedReason: null
    })
  }

  return processes
}

async function collectFromOrbstack(session: OrbstackSession): Promise<TopologyCollectionResult> {
  const warnings: string[] = []
  let nginxTopology = {
    serverBlocks: [] as ReturnType<typeof parseNginxTopology>['serverBlocks'],
    upstreams: [] as ReturnType<typeof parseNginxTopology>['upstreams']
  }
  let nginxRunning = false

  const nginxStatus = await session.exec('systemctl show nginx --property=ActiveState --no-pager 2>/dev/null')
  nginxRunning = nginxStatus.stdout.includes('ActiveState=active')

  const nginxDump = await session.exec('sudo -n nginx -T 2>/dev/null', 45_000)
  if (nginxDump.exitCode === 0 && nginxDump.stdout.trim()) {
    nginxTopology = parseNginxTopology(nginxDump.stdout)
  } else {
    warnings.push('nginx -T did not return configuration output')
  }

  const listeners = await collectListeners(session)
  const containers = await collectContainers(session)
  const units = await collectUnits(session)
  const certificates = await collectCertificates(session)
  const processes = await collectProcesses(session, listeners)

  return {
    serverBlocks: nginxTopology.serverBlocks,
    certificates,
    listeners,
    units,
    containers,
    processes,
    nginxRunning,
    nginxTopology,
    warnings
  }
}

export async function buildTopologyFromOrbstack(
  session: OrbstackSession,
  serverId = 'orbstack-integration'
): Promise<TopologySnapshot> {
  const startedAt = Date.now()
  const observedAt = new Date().toISOString()
  const collection = await collectFromOrbstack(session)

  return buildTopologySnapshot(
    serverId,
    collection,
    collection.nginxTopology,
    observedAt,
    startedAt,
    collection.warnings
  )
}
