import type {
  NginxLocationBlock,
  NginxProxyTarget,
  NginxServerBlock,
  NginxTopology,
  NginxUpstreamBlock,
  NginxUpstreamMember,
  ParsedDirective
} from './types'

function parseListenDirective(
  line: string,
  configPath: string,
  lineNumber: number
): { port: number; ssl: boolean; directive: ParsedDirective } | null {
  const trimmed = line.trim()
  const match = /^listen\s+([^;]+);/.exec(trimmed)
  if (!match) return null
  const value = match[1]
  const ssl = /\bssl\b/.test(value)
  const portMatch = /:(\d{1,5})\b/.exec(value) ?? /^(\d{1,5})\b/.exec(value)
  if (!portMatch) return null
  const port = Number.parseInt(portMatch[1], 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return {
    port,
    ssl,
    directive: {
      directive: 'listen',
      value,
      configPath,
      lineNumber,
      rawText: trimmed
    }
  }
}

function parseDirectiveValue(
  line: string,
  directive: string,
  configPath: string,
  lineNumber: number
): ParsedDirective | null {
  const trimmed = line.trim()
  const match = new RegExp(`^${directive}\\s+([^;]+);`).exec(trimmed)
  if (!match) return null
  return {
    directive,
    value: match[1].trim(),
    configPath,
    lineNumber,
    rawText: trimmed
  }
}

export function parseProxyPassTarget(directive: ParsedDirective): NginxProxyTarget {
  const value = directive.value.replace(/\s+/g, '')
  const unixMatch = /^[^:]*:\/\/unix:(.+)$/.exec(value)
  if (unixMatch) {
    const socket = unixMatch[1].replace(/;+$/, '').replace(/:+$/, '')
    return {
      scheme: 'unix',
      host: null,
      port: null,
      upstreamName: null,
      unixSocket: socket,
      directive
    }
  }

  const urlMatch = /^([a-z][a-z0-9+.-]*):\/\/([^/]+)?/i.exec(value)
  if (!urlMatch) {
    return {
      scheme: 'unknown',
      host: null,
      port: null,
      upstreamName: null,
      unixSocket: null,
      directive
    }
  }

  const scheme = urlMatch[1].toLowerCase()
  const authority = urlMatch[2] ?? ''

  if (!authority) {
    return {
      scheme,
      host: null,
      port: null,
      upstreamName: null,
      unixSocket: null,
      directive
    }
  }

  const hostPortMatch = /^([^:]+):(\d{1,5})$/.exec(authority)
  if (hostPortMatch) {
    return {
      scheme,
      host: hostPortMatch[1],
      port: Number.parseInt(hostPortMatch[2], 10),
      upstreamName: null,
      unixSocket: null,
      directive
    }
  }

  if (/^\d{1,5}$/.test(authority)) {
    return {
      scheme,
      host: '127.0.0.1',
      port: Number.parseInt(authority, 10),
      upstreamName: null,
      unixSocket: null,
      directive
    }
  }

  return {
    scheme,
    host: null,
    port: null,
    upstreamName: authority,
    unixSocket: null,
    directive
  }
}

function parseUpstreamMember(
  line: string,
  configPath: string,
  lineNumber: number
): NginxUpstreamMember | null {
  const directive = parseDirectiveValue(line, 'server', configPath, lineNumber)
  if (!directive) return null
  const value = directive.value.split(/\s+/)[0]
  const hostPort = /^([^:]+):(\d{1,5})$/.exec(value)
  if (!hostPort) return null
  const port = Number.parseInt(hostPort[2], 10)
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null
  return {
    host: hostPort[1],
    port,
    directive
  }
}

/**
 * Extracts server blocks, locations, proxy_pass, root/alias, and upstream blocks
 * from `nginx -T`, including config path and line numbers for evidence.
 */
export function parseNginxTopology(nginxDashTOutput: string): NginxTopology {
  const serverBlocks: NginxServerBlock[] = []
  const upstreams: NginxUpstreamBlock[] = []

  let currentConfigPath = ''
  let inServer = false
  let inUpstream = false
  let inLocation = false
  let braceDepth = 0
  let locationBraceDepth = 0
  let currentServer: NginxServerBlock | null = null
  let currentUpstream: NginxUpstreamBlock | null = null
  let currentLocation: NginxLocationBlock | null = null

  const flushLocation = (): void => {
    if (!currentLocation || !currentServer) return
    currentServer.locations.push(currentLocation)
    currentLocation = null
    inLocation = false
    locationBraceDepth = 0
  }

  const flushServer = (): void => {
    flushLocation()
    if (!currentServer) return
    serverBlocks.push(currentServer)
    currentServer = null
    inServer = false
    braceDepth = 0
  }

  const flushUpstream = (): void => {
    if (!currentUpstream) return
    upstreams.push(currentUpstream)
    currentUpstream = null
    inUpstream = false
    braceDepth = 0
  }

  const lines = nginxDashTOutput.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1
    const rawLine = lines[index]
    const line = rawLine.trim()

    if (!line) continue

    const configMatch = /^#\s*configuration file\s+(.+?):\s*$/.exec(line)
    if (configMatch) {
      currentConfigPath = configMatch[1].trim()
      continue
    }

    if (/^upstream\s+/.test(line)) {
      flushServer()
      flushUpstream()
      const nameMatch = /^upstream\s+([^\s{]+)/.exec(line)
      inUpstream = true
      braceDepth = line.includes('{') ? 1 : 0
      currentUpstream = {
        name: nameMatch?.[1] ?? 'unknown',
        configPath: currentConfigPath,
        members: []
      }
      continue
    }

    if (/^server\s*\{/.test(line)) {
      flushServer()
      flushUpstream()
      inServer = true
      braceDepth = line.includes('{') ? 1 : 0
      currentServer = {
        configPath: currentConfigPath,
        startLineNumber: lineNumber,
        serverNames: [],
        ports: [],
        listensHttps: false,
        sslCertificate: null,
        sslCertificateKey: null,
        listenDirectives: [],
        locations: []
      }
      continue
    }

    if (/^location\s+/.test(line) && inServer && currentServer) {
      flushLocation()
      const matchPart = /^location\s+([^{]+)/.exec(line)
      inLocation = true
      locationBraceDepth = line.includes('{') ? 1 : 0
      currentLocation = {
        match: matchPart?.[1]?.trim() ?? '/',
        proxyPass: null,
        root: null,
        alias: null
      }
      continue
    }

    if (line.includes('{')) {
      if (inLocation) locationBraceDepth += 1
      else if (inServer || inUpstream) braceDepth += 1
    }

    if (line === '}' || line.endsWith('}')) {
      if (inLocation) {
        locationBraceDepth -= 1
        if (locationBraceDepth <= 0) flushLocation()
      } else if (inUpstream) {
        braceDepth -= 1
        if (braceDepth <= 0) flushUpstream()
      } else if (inServer) {
        braceDepth -= 1
        if (braceDepth <= 0) flushServer()
      }
      continue
    }

    if (inLocation && currentLocation) {
      const proxyDirective = parseDirectiveValue(line, 'proxy_pass', currentConfigPath, lineNumber)
      if (proxyDirective) {
        currentLocation.proxyPass = parseProxyPassTarget(proxyDirective)
        continue
      }
      const rootDirective = parseDirectiveValue(line, 'root', currentConfigPath, lineNumber)
      if (rootDirective) {
        currentLocation.root = rootDirective
        continue
      }
      const aliasDirective = parseDirectiveValue(line, 'alias', currentConfigPath, lineNumber)
      if (aliasDirective) {
        currentLocation.alias = aliasDirective
      }
      continue
    }

    if (inUpstream && currentUpstream) {
      const member = parseUpstreamMember(line, currentConfigPath, lineNumber)
      if (member) currentUpstream.members.push(member)
      continue
    }

    if (!inServer || !currentServer) continue

    const listen = parseListenDirective(line, currentConfigPath, lineNumber)
    if (listen) {
      if (!currentServer.ports.includes(listen.port)) currentServer.ports.push(listen.port)
      if (listen.ssl) currentServer.listensHttps = true
      currentServer.listenDirectives.push(listen.directive)
      continue
    }

    const serverName = parseDirectiveValue(line, 'server_name', currentConfigPath, lineNumber)
    if (serverName) {
      const names = serverName.value
        .split(/\s+/)
        .map((name) => name.trim())
        .filter((name) => name && name !== '_')
      currentServer.serverNames.push(...names)
      continue
    }

    const sslCert = parseDirectiveValue(line, 'ssl_certificate', currentConfigPath, lineNumber)
    if (sslCert && !sslCert.value.startsWith('$')) {
      currentServer.sslCertificate = sslCert.value
      continue
    }

    const sslKey = parseDirectiveValue(line, 'ssl_certificate_key', currentConfigPath, lineNumber)
    if (sslKey && !sslKey.value.startsWith('$')) {
      currentServer.sslCertificateKey = sslKey.value
    }
  }

  flushLocation()
  flushServer()
  flushUpstream()
  return { serverBlocks, upstreams }
}

/**
 * Backward-compatible server block extraction for SSL site linking.
 */
export function parseNginxServerBlocks(nginxDashTOutput: string): NginxServerBlock[] {
  return parseNginxTopology(nginxDashTOutput).serverBlocks
}

export function resolveUpstreamTarget(
  upstreamName: string,
  upstreams: NginxUpstreamBlock[]
): NginxUpstreamMember | null {
  const block = upstreams.find((upstream) => upstream.name === upstreamName)
  return block?.members[0] ?? null
}

export function primaryProxyTarget(
  block: NginxServerBlock,
  upstreams: NginxUpstreamBlock[]
): NginxProxyTarget | null {
  for (const location of block.locations) {
    if (!location.proxyPass) continue
    const target = location.proxyPass
    if (target.upstreamName) {
      const member = resolveUpstreamTarget(target.upstreamName, upstreams)
      if (member) {
        return {
          scheme: target.scheme,
          host: member.host,
          port: member.port,
          upstreamName: target.upstreamName,
          unixSocket: null,
          directive: target.directive
        }
      }
    }
    return target
  }
  return null
}

export function primaryStaticRoot(block: NginxServerBlock): ParsedDirective | null {
  for (const location of block.locations) {
    if (location.root) return location.root
    if (location.alias) return location.alias
  }
  return null
}
