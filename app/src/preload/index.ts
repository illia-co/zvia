import { contextBridge, ipcRenderer } from 'electron'
import { parseIpcError } from '@shared/errors'
import type {
  IpcChannel,
  IpcEventMap,
  IpcRequestMap,
  IpcResponseMap,
  DockerApi,
  DockerLogsDataEvent,
  DockerLogsExitEvent,
  PortsApi,
  NginxApi,
  NginxLogsDataEvent,
  NginxLogsExitEvent,
  SslApi,
  SslWorkflowDoneEvent,
  SslWorkflowOutputEvent,
  SslWorkflowStepEventPayload,
  LogsApi,
  ZviaApi,
  StatsApi,
  ServicesApi,
  CronApi,
  UsersApi,
  ProcessesApi,
  PackagesApi,
  DeploymentsApi,
  DeploymentsScanProgressEvent,
  TerminalApi,
  FilesApi,
  TerminalDataEvent,
  TerminalExitEvent,
  StatsUpdateEvent,
  ProcessesUpdateEvent,
  PackagesOperationStepEvent,
  PackagesOperationOutputEvent,
  PackagesOperationDoneEvent
} from '@shared/ipc'
import type { LogsEntriesEvent, LogsStatusEvent } from '@shared/logs'
import type { FileTransferCompleteEvent, FileTransferProgressEvent } from '@shared/files'
import appPackage from '../../package.json'

const allowedChannels: IpcChannel[] = [
  'profiles:list',
  'profiles:get',
  'profiles:create',
  'profiles:update',
  'profiles:remove',
  'connection:connect',
  'connection:disconnect',
  'connection:test',
  'connection:getState',
  'connection:hostKeyResponse',
  'terminal:open',
  'terminal:write',
  'terminal:resize',
  'terminal:close',
  'logs:start',
  'logs:stop',
  'logs:setFilters',
  'stats:getInfo',
  'stats:subscribe',
  'stats:unsubscribe',
  'services:isAvailable',
  'services:list',
  'services:getUnit',
  'services:getUnitFile',
  'services:getUnitLogs',
  'services:action',
  'cron:list',
  'cron:getSource',
  'cron:createJob',
  'cron:updateJob',
  'cron:deleteJob',
  'users:isAvailable',
  'users:list',
  'users:get',
  'users:groups',
  'users:action',
  'processes:list',
  'processes:get',
  'processes:subscribe',
  'processes:unsubscribe',
  'processes:signal',
  'packages:isAvailable',
  'packages:overview',
  'packages:list',
  'packages:search',
  'packages:info',
  'packages:updates',
  'packages:operationStart',
  'packages:operationCancel',
  'deployments:scan',
  'deployments:getSnapshot',
  'deployments:lookup',
  'files:list',
  'files:read',
  'files:write',
  'files:mkdir',
  'files:rename',
  'files:delete',
  'files:upload',
  'files:download',
  'files:copy',
  'files:cancelTransfer',
  'docker:isAvailable',
  'docker:listContainers',
  'docker:listImages',
  'docker:listVolumes',
  'docker:listNetworks',
  'docker:startContainer',
  'docker:stopContainer',
  'docker:restartContainer',
  'docker:removeContainer',
  'docker:inspectContainer',
  'docker:removeImage',
  'docker:removeVolume',
  'docker:logsStart',
  'docker:logsStop',
  'ports:list',
  'ports:setFirewallRule',
  'ports:deleteFirewallRule',
  'nginx:status',
  'nginx:configTree',
  'nginx:readConfig',
  'nginx:writeConfig',
  'nginx:validate',
  'nginx:action',
  'nginx:logPaths',
  'nginx:logsStart',
  'nginx:logsStop',
  'ssl:overview',
  'ssl:certificate',
  'ssl:nginxSites',
  'ssl:installCertbot',
  'ssl:enableHttpsStart',
  'ssl:enableHttpsCancel',
  'ssl:renew',
  'ssl:testRenewal',
  'ssl:enableAutoRenewal',
  'ssl:verifyHttps',
  'ssl:renewalLog',
  'window:toggleMaximize',
  'window:isFullscreen'
]

const allowedEvents: (keyof IpcEventMap)[] = [
  'connection:stateChanged',
  'connection:hostKeyPrompt',
  'terminal:data',
  'terminal:exit',
  'logs:entries',
  'logs:status',
  'stats:update',
  'processes:update',
  'packages:operationStep',
  'packages:operationOutput',
  'packages:operationDone',
  'files:transferProgress',
  'files:transferComplete',
  'docker:logsData',
  'docker:logsExit',
  'nginx:logsData',
  'nginx:logsExit',
  'ssl:workflowStep',
  'ssl:workflowOutput',
  'ssl:workflowDone',
  'window:fullscreenChanged',
  'deployments:scanProgress'
]

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

async function invokeIpc<C extends IpcChannel>(
  channel: C,
  ...args: IpcRequestMap[C] extends void ? [] : [IpcRequestMap[C]]
): Promise<IpcResponseMap[C]> {
  try {
    return (await ipcRenderer.invoke(channel, ...args)) as IpcResponseMap[C]
  } catch (error) {
    throw parseIpcError(error)
  }
}

const terminalApi: TerminalApi = {
  open(request) {
    return invokeIpc('terminal:open', request)
  },
  write(request) {
    return invokeIpc('terminal:write', request)
  },
  resize(request) {
    return invokeIpc('terminal:resize', request)
  },
  close(request) {
    return invokeIpc('terminal:close', request)
  },
  onData(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TerminalDataEvent) => {
      listener({ ...payload, bytes: decodeBase64(payload.data) })
    }
    ipcRenderer.on('terminal:data', wrapped)
    return () => {
      ipcRenderer.removeListener('terminal:data', wrapped)
    }
  },
  onExit(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: TerminalExitEvent) => {
      listener(payload)
    }
    ipcRenderer.on('terminal:exit', wrapped)
    return () => {
      ipcRenderer.removeListener('terminal:exit', wrapped)
    }
  }
}

const logsApi: LogsApi = {
  start(request) {
    return invokeIpc('logs:start', request)
  },
  stop(request) {
    return invokeIpc('logs:stop', request)
  },
  setFilters(request) {
    return invokeIpc('logs:setFilters', request)
  },
  onEntries(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: LogsEntriesEvent) => {
      listener(payload)
    }
    ipcRenderer.on('logs:entries', wrapped)
    return () => {
      ipcRenderer.removeListener('logs:entries', wrapped)
    }
  },
  onStatus(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: LogsStatusEvent) => {
      listener(payload)
    }
    ipcRenderer.on('logs:status', wrapped)
    return () => {
      ipcRenderer.removeListener('logs:status', wrapped)
    }
  }
}

const statsApi: StatsApi = {
  getInfo(request) {
    return invokeIpc('stats:getInfo', request)
  },
  subscribe(request) {
    return invokeIpc('stats:subscribe', request)
  },
  unsubscribe(request) {
    return invokeIpc('stats:unsubscribe', request)
  },
  onUpdate(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: StatsUpdateEvent) => {
      listener(payload)
    }
    ipcRenderer.on('stats:update', wrapped)
    return () => {
      ipcRenderer.removeListener('stats:update', wrapped)
    }
  }
}

const servicesApi: ServicesApi = {
  isAvailable(request) {
    return invokeIpc('services:isAvailable', request)
  },
  list(request) {
    return invokeIpc('services:list', request)
  },
  getUnit(request) {
    return invokeIpc('services:getUnit', request)
  },
  getUnitFile(request) {
    return invokeIpc('services:getUnitFile', request)
  },
  getUnitLogs(request) {
    return invokeIpc('services:getUnitLogs', request)
  },
  action(request) {
    return invokeIpc('services:action', request)
  }
}

const cronApi: CronApi = {
  list(request) {
    return invokeIpc('cron:list', request)
  },
  getSource(request) {
    return invokeIpc('cron:getSource', request)
  },
  createJob(request) {
    return invokeIpc('cron:createJob', request)
  },
  updateJob(request) {
    return invokeIpc('cron:updateJob', request)
  },
  deleteJob(request) {
    return invokeIpc('cron:deleteJob', request)
  }
}

const usersApi: UsersApi = {
  isAvailable(request) {
    return invokeIpc('users:isAvailable', request)
  },
  list(request) {
    return invokeIpc('users:list', request)
  },
  get(request) {
    return invokeIpc('users:get', request)
  },
  groups(request) {
    return invokeIpc('users:groups', request)
  },
  action(request) {
    return invokeIpc('users:action', request)
  }
}

const processesApi: ProcessesApi = {
  list(request) {
    return invokeIpc('processes:list', request)
  },
  get(request) {
    return invokeIpc('processes:get', request)
  },
  subscribe(request) {
    return invokeIpc('processes:subscribe', request)
  },
  unsubscribe(request) {
    return invokeIpc('processes:unsubscribe', request)
  },
  signal(request) {
    return invokeIpc('processes:signal', request)
  },
  onUpdate(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: ProcessesUpdateEvent) => {
      listener(payload)
    }
    ipcRenderer.on('processes:update', wrapped)
    return () => {
      ipcRenderer.removeListener('processes:update', wrapped)
    }
  }
}

const packagesApi: PackagesApi = {
  isAvailable(request) {
    return invokeIpc('packages:isAvailable', request)
  },
  overview(request) {
    return invokeIpc('packages:overview', request)
  },
  list(request) {
    return invokeIpc('packages:list', request)
  },
  search(request) {
    return invokeIpc('packages:search', request)
  },
  info(request) {
    return invokeIpc('packages:info', request)
  },
  updates(request) {
    return invokeIpc('packages:updates', request)
  },
  operationStart(request) {
    return invokeIpc('packages:operationStart', request)
  },
  operationCancel(request) {
    return invokeIpc('packages:operationCancel', request)
  },
  onOperationStep(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: PackagesOperationStepEvent) => {
      listener(payload)
    }
    ipcRenderer.on('packages:operationStep', wrapped)
    return () => {
      ipcRenderer.removeListener('packages:operationStep', wrapped)
    }
  },
  onOperationOutput(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: PackagesOperationOutputEvent) => {
      listener({ ...payload, bytes: decodeBase64(payload.data) })
    }
    ipcRenderer.on('packages:operationOutput', wrapped)
    return () => {
      ipcRenderer.removeListener('packages:operationOutput', wrapped)
    }
  },
  onOperationDone(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: PackagesOperationDoneEvent) => {
      listener(payload)
    }
    ipcRenderer.on('packages:operationDone', wrapped)
    return () => {
      ipcRenderer.removeListener('packages:operationDone', wrapped)
    }
  }
}

const filesApi: FilesApi = {
  list(request) {
    return invokeIpc('files:list', request)
  },
  read(request) {
    return invokeIpc('files:read', request)
  },
  write(request) {
    return invokeIpc('files:write', request)
  },
  mkdir(request) {
    return invokeIpc('files:mkdir', request)
  },
  rename(request) {
    return invokeIpc('files:rename', request)
  },
  delete(request) {
    return invokeIpc('files:delete', request)
  },
  upload(request) {
    return invokeIpc('files:upload', request)
  },
  download(request) {
    return invokeIpc('files:download', request)
  },
  copy(request) {
    return invokeIpc('files:copy', request)
  },
  cancelTransfer(request) {
    return invokeIpc('files:cancelTransfer', request)
  },
  onTransferProgress(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: FileTransferProgressEvent) => {
      listener(payload)
    }
    ipcRenderer.on('files:transferProgress', wrapped)
    return () => {
      ipcRenderer.removeListener('files:transferProgress', wrapped)
    }
  },
  onTransferComplete(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: FileTransferCompleteEvent) => {
      listener(payload)
    }
    ipcRenderer.on('files:transferComplete', wrapped)
    return () => {
      ipcRenderer.removeListener('files:transferComplete', wrapped)
    }
  }
}

const dockerApi: DockerApi = {
  isAvailable(request) {
    return invokeIpc('docker:isAvailable', request)
  },
  listContainers(request) {
    return invokeIpc('docker:listContainers', request)
  },
  listImages(request) {
    return invokeIpc('docker:listImages', request)
  },
  listVolumes(request) {
    return invokeIpc('docker:listVolumes', request)
  },
  listNetworks(request) {
    return invokeIpc('docker:listNetworks', request)
  },
  startContainer(request) {
    return invokeIpc('docker:startContainer', request)
  },
  stopContainer(request) {
    return invokeIpc('docker:stopContainer', request)
  },
  restartContainer(request) {
    return invokeIpc('docker:restartContainer', request)
  },
  removeContainer(request) {
    return invokeIpc('docker:removeContainer', request)
  },
  inspectContainer(request) {
    return invokeIpc('docker:inspectContainer', request)
  },
  removeImage(request) {
    return invokeIpc('docker:removeImage', request)
  },
  removeVolume(request) {
    return invokeIpc('docker:removeVolume', request)
  },
  startLogs(request) {
    return invokeIpc('docker:logsStart', request)
  },
  stopLogs(request) {
    return invokeIpc('docker:logsStop', request)
  },
  onLogsData(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: DockerLogsDataEvent) => {
      listener({ ...payload, bytes: decodeBase64(payload.data) })
    }
    ipcRenderer.on('docker:logsData', wrapped)
    return () => {
      ipcRenderer.removeListener('docker:logsData', wrapped)
    }
  },
  onLogsExit(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: DockerLogsExitEvent) => {
      listener(payload)
    }
    ipcRenderer.on('docker:logsExit', wrapped)
    return () => {
      ipcRenderer.removeListener('docker:logsExit', wrapped)
    }
  }
}

const portsApi: PortsApi = {
  list(request) {
    return invokeIpc('ports:list', request)
  },
  setFirewallRule(request) {
    return invokeIpc('ports:setFirewallRule', request)
  },
  deleteFirewallRule(request) {
    return invokeIpc('ports:deleteFirewallRule', request)
  }
}

const nginxApi: NginxApi = {
  status(request) {
    return invokeIpc('nginx:status', request)
  },
  configTree(request) {
    return invokeIpc('nginx:configTree', request)
  },
  readConfig(request) {
    return invokeIpc('nginx:readConfig', request)
  },
  writeConfig(request) {
    return invokeIpc('nginx:writeConfig', request)
  },
  validate(request) {
    return invokeIpc('nginx:validate', request)
  },
  action(request) {
    return invokeIpc('nginx:action', request)
  },
  logPaths(request) {
    return invokeIpc('nginx:logPaths', request)
  },
  startLogs(request) {
    return invokeIpc('nginx:logsStart', request)
  },
  stopLogs(request) {
    return invokeIpc('nginx:logsStop', request)
  },
  onLogsData(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: NginxLogsDataEvent) => {
      listener({ ...payload, bytes: decodeBase64(payload.data) })
    }
    ipcRenderer.on('nginx:logsData', wrapped)
    return () => {
      ipcRenderer.removeListener('nginx:logsData', wrapped)
    }
  },
  onLogsExit(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: NginxLogsExitEvent) => {
      listener(payload)
    }
    ipcRenderer.on('nginx:logsExit', wrapped)
    return () => {
      ipcRenderer.removeListener('nginx:logsExit', wrapped)
    }
  }
}

const sslApi: SslApi = {
  overview(request) {
    return invokeIpc('ssl:overview', request)
  },
  certificate(request) {
    return invokeIpc('ssl:certificate', request)
  },
  nginxSites(request) {
    return invokeIpc('ssl:nginxSites', request)
  },
  installCertbot(request) {
    return invokeIpc('ssl:installCertbot', request)
  },
  enableHttpsStart(request) {
    return invokeIpc('ssl:enableHttpsStart', request)
  },
  enableHttpsCancel(request) {
    return invokeIpc('ssl:enableHttpsCancel', request)
  },
  renew(request) {
    return invokeIpc('ssl:renew', request)
  },
  testRenewal(request) {
    return invokeIpc('ssl:testRenewal', request)
  },
  enableAutoRenewal(request) {
    return invokeIpc('ssl:enableAutoRenewal', request)
  },
  verifyHttps(request) {
    return invokeIpc('ssl:verifyHttps', request)
  },
  renewalLog(request) {
    return invokeIpc('ssl:renewalLog', request)
  },
  onWorkflowStep(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: SslWorkflowStepEventPayload) => {
      listener(payload)
    }
    ipcRenderer.on('ssl:workflowStep', wrapped)
    return () => {
      ipcRenderer.removeListener('ssl:workflowStep', wrapped)
    }
  },
  onWorkflowOutput(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: SslWorkflowOutputEvent) => {
      listener({ ...payload, bytes: decodeBase64(payload.data) })
    }
    ipcRenderer.on('ssl:workflowOutput', wrapped)
    return () => {
      ipcRenderer.removeListener('ssl:workflowOutput', wrapped)
    }
  },
  onWorkflowDone(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: SslWorkflowDoneEvent) => {
      listener(payload)
    }
    ipcRenderer.on('ssl:workflowDone', wrapped)
    return () => {
      ipcRenderer.removeListener('ssl:workflowDone', wrapped)
    }
  }
}

const deploymentsApi: DeploymentsApi = {
  scan(request) {
    return invokeIpc('deployments:scan', request)
  },
  getSnapshot(request) {
    return invokeIpc('deployments:getSnapshot', request)
  },
  lookup(request) {
    return invokeIpc('deployments:lookup', request)
  },
  onScanProgress(listener) {
    const wrapped = (_event: Electron.IpcRendererEvent, payload: DeploymentsScanProgressEvent) => {
      listener(payload)
    }
    ipcRenderer.on('deployments:scanProgress', wrapped)
    return () => {
      ipcRenderer.removeListener('deployments:scanProgress', wrapped)
    }
  }
}

const zviaApi: ZviaApi = {
  platform: process.platform,
  version: appPackage.version,

  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcRequestMap[C] extends void ? [] : [IpcRequestMap[C]]
  ): Promise<IpcResponseMap[C]> {
    if (!allowedChannels.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
    }
    return invokeIpc(channel, ...args) as Promise<IpcResponseMap[C]>
  },

  on<E extends keyof IpcEventMap>(
    channel: E,
    listener: (payload: IpcEventMap[E]) => void
  ): () => void {
    if (!allowedEvents.includes(channel)) {
      throw new Error(`IPC event not allowed: ${String(channel)}`)
    }
    const wrapped = (_event: Electron.IpcRendererEvent, payload: IpcEventMap[E]) => {
      listener(payload)
    }
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  },

  terminal: terminalApi,
  docker: dockerApi,
  ports: portsApi,
  nginx: nginxApi,
  ssl: sslApi,
  logs: logsApi,
  stats: statsApi,
  files: filesApi,
  services: servicesApi,
  cron: cronApi,
  users: usersApi,
  processes: processesApi,
  packages: packagesApi,
  deployments: deploymentsApi,
  ...(process.env.ZVIA_SCREENSHOT === '1'
    ? {
        screenshot: {
          onConfigure(listener: (payload: { tool: string }) => void) {
            const wrapped = (_event: Electron.IpcRendererEvent, config: { tool: string }) => {
              listener(config)
            }
            ipcRenderer.on('screenshot:configure', wrapped)
            return () => {
              ipcRenderer.removeListener('screenshot:configure', wrapped)
            }
          },
          ready() {
            ipcRenderer.send('screenshot:ready')
          }
        }
      }
    : {})
}

contextBridge.exposeInMainWorld('zvia', zviaApi)
