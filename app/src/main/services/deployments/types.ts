/** Internal nginx parsing types used by topology collectors and inferrers. */

/** Parsed directive with evidence metadata for inference. */
export interface ParsedDirective {
  directive: string
  value: string
  configPath: string
  lineNumber: number
  rawText: string
}

export interface NginxProxyTarget {
  scheme: string
  host: string | null
  port: number | null
  upstreamName: string | null
  unixSocket: string | null
  directive: ParsedDirective
}

export interface NginxLocationBlock {
  match: string
  proxyPass: NginxProxyTarget | null
  root: ParsedDirective | null
  alias: ParsedDirective | null
}

export interface NginxUpstreamMember {
  host: string
  port: number
  directive: ParsedDirective
}

export interface NginxUpstreamBlock {
  name: string
  configPath: string
  members: NginxUpstreamMember[]
}

/** Base nginx server block — shared with SSL site linking. */
export interface NginxServerBlock {
  configPath: string
  /** Line number of the `server {` directive — unique per block within a config file. */
  startLineNumber: number
  serverNames: string[]
  ports: number[]
  listensHttps: boolean
  sslCertificate: string | null
  sslCertificateKey: string | null
  listenDirectives: ParsedDirective[]
  locations: NginxLocationBlock[]
}

export interface NginxTopology {
  serverBlocks: NginxServerBlock[]
  upstreams: NginxUpstreamBlock[]
}
