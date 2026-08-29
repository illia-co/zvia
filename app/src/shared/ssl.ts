export type SslCertificateStatus =
  | 'valid'
  | 'expiring-soon'
  | 'expired'
  | 'renewal-failed'
  | 'renewal-unavailable'
  | 'unknown'

export type SslRenewalMethod =
  | 'systemd-timer'
  | 'cron'
  | 'certbot-internal'
  | 'none'
  | 'unknown'

export interface SslRenewalInfo {
  method: SslRenewalMethod
  lastAttempt: string | null
  lastResult: 'success' | 'failure' | null
}

export interface SslNginxLink {
  configPath: string
  serverNames: string[]
  listensHttps: boolean
  ports: number[]
}

export interface SslCertificate {
  id: string
  primaryDomain: string
  domains: string[]
  status: SslCertificateStatus
  issuer: string | null
  issuedAt: string | null
  expiresAt: string | null
  daysRemaining: number | null
  certificatePath: string
  privateKeyPath: string | null
  managedByCertbot: boolean
  renewal: SslRenewalInfo
  nginxSites: SslNginxLink[]
  inspectionError: string | null
}

export interface SslInstallHint {
  command: string
  description: string
}

export interface SslCertbotInfo {
  installed: boolean
  version: string | null
  channel: 'apt' | 'snap' | 'pip' | 'unknown' | null
  nginxPluginAvailable: boolean
  installHint: SslInstallHint | null
}

export interface SslAutoRenewal {
  configured: boolean
  method: SslRenewalMethod
  detail: string | null
  nextRun: string | null
  lastAttempt: string | null
  lastResult: 'success' | 'failure' | null
  canEnable: boolean
}

export interface SslOverview {
  nginx: { installed: boolean; running: boolean; version: string | null }
  certbot: SslCertbotInfo
  certificates: SslCertificate[]
  autoRenewal: SslAutoRenewal
  opensslAvailable: boolean
  capabilities: { systemd: boolean; cron: boolean; curl: boolean }
}

export type SslWorkflowStepId =
  | 'nginx-installed'
  | 'nginx-running'
  | 'nginx-config-valid'
  | 'site-detected'
  | 'domain-configured'
  | 'ports-reachable'
  | 'certbot-available'
  | 'config-backed-up'
  | 'certificate-issued'
  | 'certificate-verified'
  | 'nginx-revalidated'
  | 'nginx-reloaded'
  | 'https-responding'
  | 'auto-renewal-detected'

export type SslWorkflowStepState =
  | 'pending'
  | 'running'
  | 'ok'
  | 'warning'
  | 'failed'
  | 'skipped'

export interface SslWorkflowStepEvent {
  stepId: SslWorkflowStepId
  state: SslWorkflowStepState
  message?: string
}

export interface SslVerifyHttpsResult {
  localResolve: { responding: boolean; httpCode: string | null }
  public: { responding: boolean; httpCode: string | null }
}

export const EXPIRING_SOON_DAYS = 30
