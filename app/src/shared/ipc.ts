import type { ServerId } from './server'

export type ServerScoped = { serverId: ServerId }

export interface ExecResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface ExecRequest extends ServerScoped {
  command: string
  timeoutMs?: number
}

export interface ConnectRequest extends ServerScoped {}

export interface DisconnectRequest extends ServerScoped {}

export interface ConnectionTestRequest {
  hostname: string
  username: string
  port?: number
  auth: import('./server').AuthMethod
  passphrase?: string
  /** Existing profile id or ephemeral test session id for host-key routing */
  serverId?: ServerId
}

export interface HostKeyResponseRequest extends ServerScoped {
  decision: 'accept' | 'reject'
}

export interface ProfileCreateRequest {
  name: string
  hostname: string
  username: string
  port?: number
  auth: import('./server').AuthMethod
  passphrase?: string
}

export interface ProfileUpdateRequest {
  id: ServerId
  name?: string
  hostname?: string
  username?: string
  port?: number
  auth?: import('./server').AuthMethod
  passphrase?: string
  clearPassphrase?: boolean
}

export interface ProfileRemoveRequest {
  id: ServerId
}

export interface ProfileGetRequest {
  id: ServerId
}

export type TerminalSessionId = string

export interface TerminalOpenRequest extends ServerScoped {
  sessionId: TerminalSessionId
  cols: number
  rows: number
  /** Remote command to run in a PTY instead of an interactive shell */
  command?: string
}

export interface TerminalWriteRequest extends ServerScoped {
  sessionId: TerminalSessionId
  data: string
}

export interface TerminalResizeRequest extends ServerScoped {
  sessionId: TerminalSessionId
  cols: number
  rows: number
}

export interface TerminalCloseRequest extends ServerScoped {
  sessionId: TerminalSessionId
}

export interface TerminalDataEvent extends ServerScoped {
  sessionId: TerminalSessionId
  /** Base64-encoded binary PTY output */
  data: string
}

export interface TerminalExitEvent extends ServerScoped {
  sessionId: TerminalSessionId
  exitCode: number
  signal?: string
}

export type DockerStreamId = string

export interface DockerListContainersRequest extends ServerScoped {
  all?: boolean
}

export interface DockerContainerActionRequest extends ServerScoped {
  containerId: string
}

export interface DockerRemoveContainerRequest extends ServerScoped {
  containerId: string
  force?: boolean
}

export interface DockerInspectRequest extends ServerScoped {
  containerId: string
}

export interface DockerRemoveImageRequest extends ServerScoped {
  imageId: string
  force?: boolean
}

export interface DockerRemoveVolumeRequest extends ServerScoped {
  volumeName: string
  force?: boolean
}

export interface DockerLogsStartRequest extends ServerScoped {
  streamId: DockerStreamId
  containerId: string
  timestamps?: boolean
  tail?: number
}

export interface DockerLogsStopRequest extends ServerScoped {
  streamId: DockerStreamId
}

export interface DockerLogsDataEvent extends ServerScoped {
  streamId: DockerStreamId
  /** Base64-encoded log chunk */
  data: string
}

export interface DockerLogsExitEvent extends ServerScoped {
  streamId: DockerStreamId
  exitCode: number
}

export interface PortsFirewallRuleRequest extends ServerScoped {
  action: import('./ports').FirewallRuleAction
  port: number
  protocol: import('./ports').PortProtocol
}

export interface PortsDeleteFirewallRuleRequest extends ServerScoped {
  ruleId: string
}

export type NginxStreamId = string

export interface NginxConfigPathRequest extends ServerScoped {
  path: string
}

export interface NginxWriteConfigRequest extends ServerScoped {
  path: string
  content: string
}

export interface NginxReadConfigResponse {
  path: string
  content: string
  size: number
}

export interface NginxActionRequest extends ServerScoped {
  action: import('./nginx').NginxAction
}

export interface NginxLogsStartRequest extends ServerScoped {
  streamId: NginxStreamId
  path: string
}

export interface NginxLogsStopRequest extends ServerScoped {
  streamId: NginxStreamId
}

export interface NginxLogsDataEvent extends ServerScoped {
  streamId: NginxStreamId
  /** Base64-encoded log chunk */
  data: string
}

export interface NginxLogsExitEvent extends ServerScoped {
  streamId: NginxStreamId
  exitCode: number
}

export type SslStreamId = string

export interface SslCertIdRequest extends ServerScoped {
  id: string
}

export interface SslCertNameRequest extends ServerScoped {
  certName: string
}

export interface SslEnableHttpsRequest extends ServerScoped {
  streamId: SslStreamId
  domain: string
  configPath: string
  email: string
  redirect: boolean
}

export interface SslStreamRequest extends ServerScoped {
  streamId: SslStreamId
}

export interface SslVerifyRequest extends ServerScoped {
  domain: string
}

export interface SslWorkflowStepEventPayload extends ServerScoped {
  streamId: SslStreamId
  stepId: import('./ssl').SslWorkflowStepId
  state: import('./ssl').SslWorkflowStepState
  message?: string
}

export interface SslWorkflowOutputEvent extends ServerScoped {
  streamId: SslStreamId
  /** Base64-encoded workflow output chunk */
  data: string
}

export interface SslWorkflowDoneEvent extends ServerScoped {
  streamId: SslStreamId
  success: boolean
  failedStepId?: import('./ssl').SslWorkflowStepId
  output?: string
  backupPath?: string
}

export type StatsSubscriptionMode = import('./stats').StatsSubscriptionMode

export interface StatsSubscribeRequest extends ServerScoped {
  subscriberId: string
  mode: StatsSubscriptionMode
}

export interface StatsUnsubscribeRequest extends ServerScoped {
  subscriberId: string
}

export interface StatsUpdateEvent extends ServerScoped {
  info: import('./stats').SystemInfo
  stats: import('./stats').ServerStatsSnapshot
}

export interface ServicesUnitRequest extends ServerScoped {
  unit: string
}

export interface ServicesUnitLogsRequest extends ServerScoped {
  unit: string
  lines?: number
}

export interface ServicesActionRequest extends ServerScoped {
  unit: string
  action: import('./systemd').SystemdAction
}

export interface CronCreateJobRequest extends ServerScoped {
  target: import('./cron').CronTarget
  schedule: string
  command: string
}

export interface CronSourceRequest extends ServerScoped {
  target: import('./cron').CronTarget
}

export interface CronUpdateJobRequest extends CronCreateJobRequest {
  jobId: string
}

export interface CronDeleteJobRequest extends ServerScoped {
  target: import('./cron').CronTarget
  jobId: string
}

export interface UsersUsernameRequest extends ServerScoped {
  username: string
}

export interface UsersActionRequest extends ServerScoped {
  action: import('./users').UserAction
}

export interface ProcessesGetRequest extends ServerScoped {
  pid: number
}

export interface ProcessesSubscribeRequest extends ServerScoped {
  subscriberId: string
  intervalMs?: import('./processes').ProcessesSubscriptionInterval
}

export interface ProcessesUnsubscribeRequest extends ServerScoped {
  subscriberId: string
}

export interface ProcessesSignalRequest extends ServerScoped {
  pid: number
  signal: import('./processes').ProcessSignal
}

export interface PackagesListRequest extends ServerScoped {
  query?: string
  offset: number
  limit: number
}

export interface PackagesSearchRequest extends ServerScoped {
  query: string
}

export interface PackagesInfoRequest extends ServerScoped {
  packageName: string
}

export type PackageStreamId = string

export interface PackagesOperationStartRequest extends ServerScoped {
  streamId: PackageStreamId
  operation: import('./packages').PackageOperation
}

export interface PackagesOperationCancelRequest extends ServerScoped {
  streamId: PackageStreamId
}

export interface ProcessesUpdateEvent extends ServerScoped {
  processes: import('./processes').ProcessSummary[]
  capturedAt: string
}

export interface PackagesOperationStepEvent extends ServerScoped {
  streamId: PackageStreamId
  stepId: import('./packages').PackageOperationStepId
  state: import('./packages').PackageWorkflowStepState
  message?: string
}

export interface PackagesOperationOutputEvent extends ServerScoped {
  streamId: PackageStreamId
  /** Base64-encoded operation output chunk */
  data: string
}

export interface PackagesOperationDoneEvent extends ServerScoped {
  streamId: PackageStreamId
  success: boolean
  output?: string
}

export type IpcChannel =
  | 'profiles:list'
  | 'profiles:get'
  | 'profiles:create'
  | 'profiles:update'
  | 'profiles:remove'
  | 'connection:connect'
  | 'connection:disconnect'
  | 'connection:test'
  | 'connection:getState'
  | 'connection:hostKeyResponse'
  | 'terminal:open'
  | 'terminal:write'
  | 'terminal:resize'
  | 'terminal:close'
  | 'docker:isAvailable'
  | 'docker:listContainers'
  | 'docker:listImages'
  | 'docker:listVolumes'
  | 'docker:listNetworks'
  | 'docker:startContainer'
  | 'docker:stopContainer'
  | 'docker:restartContainer'
  | 'docker:removeContainer'
  | 'docker:inspectContainer'
  | 'docker:removeImage'
  | 'docker:removeVolume'
  | 'docker:logsStart'
  | 'docker:logsStop'
  | 'ports:list'
  | 'ports:setFirewallRule'
  | 'ports:deleteFirewallRule'
  | 'nginx:status'
  | 'nginx:configTree'
  | 'nginx:readConfig'
  | 'nginx:writeConfig'
  | 'nginx:validate'
  | 'nginx:action'
  | 'nginx:logPaths'
  | 'nginx:logsStart'
  | 'nginx:logsStop'
  | 'ssl:overview'
  | 'ssl:certificate'
  | 'ssl:nginxSites'
  | 'ssl:installCertbot'
  | 'ssl:enableHttpsStart'
  | 'ssl:enableHttpsCancel'
  | 'ssl:renew'
  | 'ssl:testRenewal'
  | 'ssl:enableAutoRenewal'
  | 'ssl:verifyHttps'
  | 'ssl:renewalLog'
  | 'files:list'
  | 'files:read'
  | 'files:write'
  | 'files:mkdir'
  | 'files:rename'
  | 'files:delete'
  | 'files:upload'
  | 'files:download'
  | 'files:copy'
  | 'files:cancelTransfer'
  | 'logs:start'
  | 'logs:stop'
  | 'logs:setFilters'
  | 'stats:getInfo'
  | 'stats:subscribe'
  | 'stats:unsubscribe'
  | 'services:isAvailable'
  | 'services:list'
  | 'services:getUnit'
  | 'services:getUnitFile'
  | 'services:getUnitLogs'
  | 'services:action'
  | 'cron:list'
  | 'cron:getSource'
  | 'cron:createJob'
  | 'cron:updateJob'
  | 'cron:deleteJob'
  | 'users:isAvailable'
  | 'users:list'
  | 'users:get'
  | 'users:groups'
  | 'users:action'
  | 'processes:list'
  | 'processes:get'
  | 'processes:subscribe'
  | 'processes:unsubscribe'
  | 'processes:signal'
  | 'packages:isAvailable'
  | 'packages:overview'
  | 'packages:list'
  | 'packages:search'
  | 'packages:info'
  | 'packages:updates'
  | 'packages:operationStart'
  | 'packages:operationCancel'
  | 'deployments:scan'
  | 'deployments:getSnapshot'
  | 'deployments:lookup'
  | 'window:toggleMaximize'
  | 'window:isFullscreen'

export type IpcRequestMap = {
  'profiles:list': void
  'profiles:get': ProfileGetRequest
  'profiles:create': ProfileCreateRequest
  'profiles:update': ProfileUpdateRequest
  'profiles:remove': ProfileRemoveRequest
  'connection:connect': ConnectRequest
  'connection:disconnect': DisconnectRequest
  'connection:test': ConnectionTestRequest
  'connection:getState': ServerScoped
  'connection:hostKeyResponse': HostKeyResponseRequest
  'terminal:open': TerminalOpenRequest
  'terminal:write': TerminalWriteRequest
  'terminal:resize': TerminalResizeRequest
  'terminal:close': TerminalCloseRequest
  'docker:isAvailable': ServerScoped
  'docker:listContainers': DockerListContainersRequest
  'docker:listImages': ServerScoped
  'docker:listVolumes': ServerScoped
  'docker:listNetworks': ServerScoped
  'docker:startContainer': DockerContainerActionRequest
  'docker:stopContainer': DockerContainerActionRequest
  'docker:restartContainer': DockerContainerActionRequest
  'docker:removeContainer': DockerRemoveContainerRequest
  'docker:inspectContainer': DockerInspectRequest
  'docker:removeImage': DockerRemoveImageRequest
  'docker:removeVolume': DockerRemoveVolumeRequest
  'docker:logsStart': DockerLogsStartRequest
  'docker:logsStop': DockerLogsStopRequest
  'ports:list': ServerScoped
  'ports:setFirewallRule': PortsFirewallRuleRequest
  'ports:deleteFirewallRule': PortsDeleteFirewallRuleRequest
  'nginx:status': ServerScoped
  'nginx:configTree': ServerScoped
  'nginx:readConfig': NginxConfigPathRequest
  'nginx:writeConfig': NginxWriteConfigRequest
  'nginx:validate': ServerScoped
  'nginx:action': NginxActionRequest
  'nginx:logPaths': ServerScoped
  'nginx:logsStart': NginxLogsStartRequest
  'nginx:logsStop': NginxLogsStopRequest
  'ssl:overview': ServerScoped
  'ssl:certificate': SslCertIdRequest
  'ssl:nginxSites': ServerScoped
  'ssl:installCertbot': ServerScoped
  'ssl:enableHttpsStart': SslEnableHttpsRequest
  'ssl:enableHttpsCancel': SslStreamRequest
  'ssl:renew': SslCertNameRequest
  'ssl:testRenewal': SslCertNameRequest
  'ssl:enableAutoRenewal': ServerScoped
  'ssl:verifyHttps': SslVerifyRequest
  'ssl:renewalLog': SslCertNameRequest
  'files:list': import('./files').FilesListRequest
  'files:read': import('./files').FilesReadRequest
  'files:write': import('./files').FilesWriteRequest
  'files:mkdir': import('./files').FilesMkdirRequest
  'files:rename': import('./files').FilesRenameRequest
  'files:delete': import('./files').FilesDeleteRequest
  'files:upload': import('./files').FilesUploadRequest
  'files:download': import('./files').FilesDownloadRequest
  'files:copy': import('./files').FilesCopyRequest
  'files:cancelTransfer': import('./files').FilesCancelTransferRequest
  'logs:start': import('./logs').LogsStartRequest
  'logs:stop': ServerScoped
  'logs:setFilters': import('./logs').LogsSetFiltersRequest
  'stats:getInfo': ServerScoped
  'stats:subscribe': StatsSubscribeRequest
  'stats:unsubscribe': StatsUnsubscribeRequest
  'services:isAvailable': ServerScoped
  'services:list': ServerScoped
  'services:getUnit': ServicesUnitRequest
  'services:getUnitFile': ServicesUnitRequest
  'services:getUnitLogs': ServicesUnitLogsRequest
  'services:action': ServicesActionRequest
  'cron:list': ServerScoped
  'cron:getSource': CronSourceRequest
  'cron:createJob': CronCreateJobRequest
  'cron:updateJob': CronUpdateJobRequest
  'cron:deleteJob': CronDeleteJobRequest
  'users:isAvailable': ServerScoped
  'users:list': ServerScoped
  'users:get': UsersUsernameRequest
  'users:groups': ServerScoped
  'users:action': UsersActionRequest
  'processes:list': ServerScoped
  'processes:get': ProcessesGetRequest
  'processes:subscribe': ProcessesSubscribeRequest
  'processes:unsubscribe': ProcessesUnsubscribeRequest
  'processes:signal': ProcessesSignalRequest
  'packages:isAvailable': ServerScoped
  'packages:overview': ServerScoped
  'packages:list': PackagesListRequest
  'packages:search': PackagesSearchRequest
  'packages:info': PackagesInfoRequest
  'packages:updates': ServerScoped
  'packages:operationStart': PackagesOperationStartRequest
  'packages:operationCancel': PackagesOperationCancelRequest
  'deployments:scan': ServerScoped
  'deployments:getSnapshot': ServerScoped
  'deployments:lookup': DeploymentsLookupRequest
  'window:toggleMaximize': void
  'window:isFullscreen': void
}

export type IpcResponseMap = {
  'profiles:list': import('./server').ServerProfile[]
  'profiles:get': import('./server').ServerProfile
  'profiles:create': import('./server').ServerProfile
  'profiles:update': import('./server').ServerProfile
  'profiles:remove': void
  'connection:connect': void
  'connection:disconnect': void
  'connection:test': void
  'connection:getState': import('./server').ConnectionState
  'connection:hostKeyResponse': void
  'terminal:open': void
  'terminal:write': void
  'terminal:resize': void
  'terminal:close': void
  'docker:isAvailable': boolean
  'docker:listContainers': import('./docker').DockerContainer[]
  'docker:listImages': import('./docker').DockerImage[]
  'docker:listVolumes': import('./docker').DockerVolume[]
  'docker:listNetworks': import('./docker').DockerNetwork[]
  'docker:startContainer': void
  'docker:stopContainer': void
  'docker:restartContainer': void
  'docker:removeContainer': void
  'docker:inspectContainer': unknown
  'docker:removeImage': void
  'docker:removeVolume': void
  'docker:logsStart': void
  'docker:logsStop': void
  'ports:list': import('./ports').PortsSnapshot
  'ports:setFirewallRule': void
  'ports:deleteFirewallRule': void
  'nginx:status': import('./nginx').NginxStatus
  'nginx:configTree': import('./nginx').NginxConfigTree
  'nginx:readConfig': NginxReadConfigResponse
  'nginx:writeConfig': void
  'nginx:validate': import('./nginx').NginxValidation
  'nginx:action': void
  'nginx:logPaths': import('./nginx').NginxLogPaths
  'nginx:logsStart': void
  'nginx:logsStop': void
  'ssl:overview': import('./ssl').SslOverview
  'ssl:certificate': import('./ssl').SslCertificate
  'ssl:nginxSites': import('./ssl').SslNginxLink[]
  'ssl:installCertbot': void
  'ssl:enableHttpsStart': void
  'ssl:enableHttpsCancel': void
  'ssl:renew': void
  'ssl:testRenewal': string
  'ssl:enableAutoRenewal': void
  'ssl:verifyHttps': import('./ssl').SslVerifyHttpsResult
  'ssl:renewalLog': string
  'files:list': import('./files').FilesListResponse
  'files:read': import('./files').FilesReadResponse
  'files:write': void
  'files:mkdir': void
  'files:rename': void
  'files:delete': void
  'files:upload': void
  'files:download': import('./files').FilesDownloadResponse
  'files:copy': void
  'files:cancelTransfer': void
  'logs:start': void
  'logs:stop': void
  'logs:setFilters': void
  'stats:getInfo': import('./stats').SystemInfo
  'stats:subscribe': void
  'stats:unsubscribe': void
  'services:isAvailable': boolean
  'services:list': import('./systemd').SystemdUnit[]
  'services:getUnit': import('./systemd').SystemdUnitDetail
  'services:getUnitFile': import('./systemd').SystemdUnitFile
  'services:getUnitLogs': string[]
  'services:action': void
  'cron:list': import('./cron').CronListResponse
  'cron:getSource': import('./cron').CrontabSource
  'cron:createJob': void
  'cron:updateJob': void
  'cron:deleteJob': void
  'users:isAvailable': boolean
  'users:list': import('./users').UsersListResponse
  'users:get': import('./users').UserDetail
  'users:groups': import('./users').UserGroup[]
  'users:action': void
  'processes:list': import('./processes').ProcessSummary[]
  'processes:get': import('./processes').ProcessDetail
  'processes:subscribe': void
  'processes:unsubscribe': void
  'processes:signal': void
  'packages:isAvailable': import('./packages').PackagesAvailability
  'packages:overview': import('./packages').PackageOverview
  'packages:list': import('./packages').PaginatedResult<import('./packages').InstalledPackage>
  'packages:search': import('./packages').PackageSearchResult[]
  'packages:info': import('./packages').PackageDetail
  'packages:updates': import('./packages').PackageUpdate[]
  'packages:operationStart': void
  'packages:operationCancel': void
  'deployments:scan': import('./topology').TopologySnapshot
  'deployments:getSnapshot': import('./topology').TopologySnapshot
  'deployments:lookup': DeploymentsLookupResult | null
  'window:toggleMaximize': void
  'window:isFullscreen': boolean
}

export type IpcEventMap = {
  'connection:stateChanged': import('./server').ConnectionStateEvent
  'connection:hostKeyPrompt': import('./server').HostKeyPrompt
  'terminal:data': TerminalDataEvent
  'terminal:exit': TerminalExitEvent
  'docker:logsData': DockerLogsDataEvent
  'docker:logsExit': DockerLogsExitEvent
  'nginx:logsData': NginxLogsDataEvent
  'nginx:logsExit': NginxLogsExitEvent
  'ssl:workflowStep': SslWorkflowStepEventPayload
  'ssl:workflowOutput': SslWorkflowOutputEvent
  'ssl:workflowDone': SslWorkflowDoneEvent
  'files:transferProgress': import('./files').FileTransferProgressEvent
  'files:transferComplete': import('./files').FileTransferCompleteEvent
  'logs:entries': import('./logs').LogsEntriesEvent
  'logs:status': import('./logs').LogsStatusEvent
  'stats:update': StatsUpdateEvent
  'processes:update': ProcessesUpdateEvent
  'packages:operationStep': PackagesOperationStepEvent
  'packages:operationOutput': PackagesOperationOutputEvent
  'packages:operationDone': PackagesOperationDoneEvent
  'window:fullscreenChanged': { isFullscreen: boolean }
  'deployments:scanProgress': DeploymentsScanProgressEvent
}

export interface LogsApi {
  start(request: import('./logs').LogsStartRequest): Promise<void>
  stop(request: ServerScoped): Promise<void>
  setFilters(request: import('./logs').LogsSetFiltersRequest): Promise<void>
  onEntries(listener: (event: import('./logs').LogsEntriesEvent) => void): () => void
  onStatus(listener: (event: import('./logs').LogsStatusEvent) => void): () => void
}

export interface StatsApi {
  getInfo(request: ServerScoped): Promise<import('./stats').SystemInfo>
  subscribe(request: StatsSubscribeRequest): Promise<void>
  unsubscribe(request: StatsUnsubscribeRequest): Promise<void>
  onUpdate(listener: (event: StatsUpdateEvent) => void): () => void
}

export interface ServicesApi {
  isAvailable(request: ServerScoped): Promise<boolean>
  list(request: ServerScoped): Promise<import('./systemd').SystemdUnit[]>
  getUnit(request: ServicesUnitRequest): Promise<import('./systemd').SystemdUnitDetail>
  getUnitFile(request: ServicesUnitRequest): Promise<import('./systemd').SystemdUnitFile>
  getUnitLogs(request: ServicesUnitLogsRequest): Promise<string[]>
  action(request: ServicesActionRequest): Promise<void>
}

export interface CronApi {
  list(request: ServerScoped): Promise<import('./cron').CronListResponse>
  getSource(request: CronSourceRequest): Promise<import('./cron').CrontabSource>
  createJob(request: CronCreateJobRequest): Promise<void>
  updateJob(request: CronUpdateJobRequest): Promise<void>
  deleteJob(request: CronDeleteJobRequest): Promise<void>
}

export interface UsersApi {
  isAvailable(request: ServerScoped): Promise<boolean>
  list(request: ServerScoped): Promise<import('./users').UsersListResponse>
  get(request: UsersUsernameRequest): Promise<import('./users').UserDetail>
  groups(request: ServerScoped): Promise<import('./users').UserGroup[]>
  action(request: UsersActionRequest): Promise<void>
}

export interface ProcessesApi {
  list(request: ServerScoped): Promise<import('./processes').ProcessSummary[]>
  get(request: ProcessesGetRequest): Promise<import('./processes').ProcessDetail>
  subscribe(request: ProcessesSubscribeRequest): Promise<void>
  unsubscribe(request: ProcessesUnsubscribeRequest): Promise<void>
  signal(request: ProcessesSignalRequest): Promise<void>
  onUpdate(listener: (event: ProcessesUpdateEvent) => void): () => void
}

export interface PackagesApi {
  isAvailable(request: ServerScoped): Promise<import('./packages').PackagesAvailability>
  overview(request: ServerScoped): Promise<import('./packages').PackageOverview>
  list(request: PackagesListRequest): Promise<
    import('./packages').PaginatedResult<import('./packages').InstalledPackage>
  >
  search(request: PackagesSearchRequest): Promise<import('./packages').PackageSearchResult[]>
  info(request: PackagesInfoRequest): Promise<import('./packages').PackageDetail>
  updates(request: ServerScoped): Promise<import('./packages').PackageUpdate[]>
  operationStart(request: PackagesOperationStartRequest): Promise<void>
  operationCancel(request: PackagesOperationCancelRequest): Promise<void>
  onOperationStep(listener: (event: PackagesOperationStepEvent) => void): () => void
  onOperationOutput(
    listener: (event: PackagesOperationOutputEvent & { bytes: Uint8Array }) => void
  ): () => void
  onOperationDone(listener: (event: PackagesOperationDoneEvent) => void): () => void
}

export interface TerminalApi {
  open(request: TerminalOpenRequest): Promise<void>
  write(request: TerminalWriteRequest): Promise<void>
  resize(request: TerminalResizeRequest): Promise<void>
  close(request: TerminalCloseRequest): Promise<void>
  onData(listener: (event: TerminalDataEvent & { bytes: Uint8Array }) => void): () => void
  onExit(listener: (event: TerminalExitEvent) => void): () => void
}

export interface FilesApi {
  list(request: import('./files').FilesListRequest): Promise<import('./files').FilesListResponse>
  read(request: import('./files').FilesReadRequest): Promise<import('./files').FilesReadResponse>
  write(request: import('./files').FilesWriteRequest): Promise<void>
  mkdir(request: import('./files').FilesMkdirRequest): Promise<void>
  rename(request: import('./files').FilesRenameRequest): Promise<void>
  delete(request: import('./files').FilesDeleteRequest): Promise<void>
  upload(request: import('./files').FilesUploadRequest): Promise<void>
  download(
    request: import('./files').FilesDownloadRequest
  ): Promise<import('./files').FilesDownloadResponse>
  copy(request: import('./files').FilesCopyRequest): Promise<void>
  cancelTransfer(request: import('./files').FilesCancelTransferRequest): Promise<void>
  onTransferProgress(listener: (event: import('./files').FileTransferProgressEvent) => void): () => void
  onTransferComplete(listener: (event: import('./files').FileTransferCompleteEvent) => void): () => void
}

export interface DockerApi {
  isAvailable(request: ServerScoped): Promise<boolean>
  listContainers(request: DockerListContainersRequest): Promise<import('./docker').DockerContainer[]>
  listImages(request: ServerScoped): Promise<import('./docker').DockerImage[]>
  listVolumes(request: ServerScoped): Promise<import('./docker').DockerVolume[]>
  listNetworks(request: ServerScoped): Promise<import('./docker').DockerNetwork[]>
  startContainer(request: DockerContainerActionRequest): Promise<void>
  stopContainer(request: DockerContainerActionRequest): Promise<void>
  restartContainer(request: DockerContainerActionRequest): Promise<void>
  removeContainer(request: DockerRemoveContainerRequest): Promise<void>
  inspectContainer(request: DockerInspectRequest): Promise<unknown>
  removeImage(request: DockerRemoveImageRequest): Promise<void>
  removeVolume(request: DockerRemoveVolumeRequest): Promise<void>
  startLogs(request: DockerLogsStartRequest): Promise<void>
  stopLogs(request: DockerLogsStopRequest): Promise<void>
  onLogsData(listener: (event: DockerLogsDataEvent & { bytes: Uint8Array }) => void): () => void
  onLogsExit(listener: (event: DockerLogsExitEvent) => void): () => void
}

export interface PortsApi {
  list(request: ServerScoped): Promise<import('./ports').PortsSnapshot>
  setFirewallRule(request: PortsFirewallRuleRequest): Promise<void>
  deleteFirewallRule(request: PortsDeleteFirewallRuleRequest): Promise<void>
}

export interface NginxApi {
  status(request: ServerScoped): Promise<import('./nginx').NginxStatus>
  configTree(request: ServerScoped): Promise<import('./nginx').NginxConfigTree>
  readConfig(request: NginxConfigPathRequest): Promise<NginxReadConfigResponse>
  writeConfig(request: NginxWriteConfigRequest): Promise<void>
  validate(request: ServerScoped): Promise<import('./nginx').NginxValidation>
  action(request: NginxActionRequest): Promise<void>
  logPaths(request: ServerScoped): Promise<import('./nginx').NginxLogPaths>
  startLogs(request: NginxLogsStartRequest): Promise<void>
  stopLogs(request: NginxLogsStopRequest): Promise<void>
  onLogsData(listener: (event: NginxLogsDataEvent & { bytes: Uint8Array }) => void): () => void
  onLogsExit(listener: (event: NginxLogsExitEvent) => void): () => void
}

export interface SslApi {
  overview(request: ServerScoped): Promise<import('./ssl').SslOverview>
  certificate(request: SslCertIdRequest): Promise<import('./ssl').SslCertificate>
  nginxSites(request: ServerScoped): Promise<import('./ssl').SslNginxLink[]>
  installCertbot(request: ServerScoped): Promise<void>
  enableHttpsStart(request: SslEnableHttpsRequest): Promise<void>
  enableHttpsCancel(request: SslStreamRequest): Promise<void>
  renew(request: SslCertNameRequest): Promise<void>
  testRenewal(request: SslCertNameRequest): Promise<string>
  enableAutoRenewal(request: ServerScoped): Promise<void>
  verifyHttps(request: SslVerifyRequest): Promise<import('./ssl').SslVerifyHttpsResult>
  renewalLog(request: SslCertNameRequest): Promise<string>
  onWorkflowStep(listener: (event: SslWorkflowStepEventPayload) => void): () => void
  onWorkflowOutput(
    listener: (event: SslWorkflowOutputEvent & { bytes: Uint8Array }) => void
  ): () => void
  onWorkflowDone(listener: (event: SslWorkflowDoneEvent) => void): () => void
}

export interface DeploymentsLookupRequest extends ServerScoped {
  kind: 'port' | 'container' | 'domain' | 'nginxSite'
  port?: number
  containerId?: string
  domain?: string
  configPath?: string
  startLineNumber?: number
}

export interface DeploymentsLookupResult {
  deploymentId: string
  entityId: string
}

export interface DeploymentsScanProgressEvent extends ServerScoped {
  phase: string
  message: string
  counts?: Record<string, number>
}

export interface DeploymentsApi {
  scan(request: ServerScoped): Promise<import('./topology').TopologySnapshot>
  getSnapshot(request: ServerScoped): Promise<import('./topology').TopologySnapshot>
  lookup(request: DeploymentsLookupRequest): Promise<DeploymentsLookupResult | null>
  onScanProgress(listener: (event: DeploymentsScanProgressEvent) => void): () => void
}

export interface ZviaApi {
  platform: NodeJS.Platform
  version: string

  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcRequestMap[C] extends void ? [] : [IpcRequestMap[C]]
  ): Promise<IpcResponseMap[C]>

  on<E extends keyof IpcEventMap>(
    channel: E,
    listener: (payload: IpcEventMap[E]) => void
  ): () => void

  terminal: TerminalApi
  docker: DockerApi
  ports: PortsApi
  nginx: NginxApi
  ssl: SslApi
  files: FilesApi
  logs: LogsApi
  stats: StatsApi
  services: ServicesApi
  cron: CronApi
  users: UsersApi
  processes: ProcessesApi
  packages: PackagesApi
  deployments: DeploymentsApi

  /** Present only when the app is launched in screenshot capture mode. */
  screenshot?: {
    onConfigure(listener: (payload: { tool: string }) => void): () => void
    ready(): void
  }
}

declare global {
  interface Window {
    zvia: ZviaApi
  }
}
