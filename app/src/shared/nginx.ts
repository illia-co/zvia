export interface NginxPaths {
  prefix: string | null
  confPath: string | null
  /** Directory holding nginx.conf; all config edits are confined to it. */
  configRoot: string | null
  errorLogPath: string | null
  accessLogPath: string | null
}

export type NginxConfigGroup =
  | 'root'
  | 'conf.d'
  | 'sites-available'
  | 'sites-enabled'
  | 'snippets'
  | 'modules-enabled'

export interface NginxConfigFile {
  path: string
  name: string
  group: NginxConfigGroup
  size: number
  /** For sites-available entries: whether a matching sites-enabled link exists. */
  enabled?: boolean
}

export interface NginxConfigTree {
  configRoot: string
  files: NginxConfigFile[]
}

export type NginxValidationState = 'unknown' | 'valid' | 'invalid'

export interface NginxValidation {
  state: NginxValidationState
  /** Verbatim `nginx -t` output, stderr included. */
  output: string
}

export interface NginxStatus {
  installed: boolean
  version: string | null
  paths: NginxPaths
  systemdAvailable: boolean
  activeState: string | null
  subState: string | null
  mainPid: number | null
  activeSince: string | null
  unitFileState: string | null
  validation: NginxValidation
  /** False while the config changed after the last successful `nginx -t`. */
  canReload: boolean
}

export type NginxAction = 'start' | 'stop' | 'restart' | 'reload'

export interface NginxLogPaths {
  accessLogs: string[]
  errorLogs: string[]
}
