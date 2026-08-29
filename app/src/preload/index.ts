import { contextBridge, ipcRenderer } from 'electron'
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
  RelayApi,
  StatsApi,
  ServicesApi,
  CronApi,
  UsersApi,
  ProcessesApi,
  PackagesApi,
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

const allowedChannels: IpcChannel[] = [
  'profiles:list',
  'profiles:get',
  'profiles:create',
  'profiles:update',
  'profiles:remove',
  'connection:connect',
  'connection:disconnect',
  'connection:getState',
  'connection:hostKeyResponse',
  'connection:exec',
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
  'window:fullscreenChanged'
]

function decodeBase64(data: string): Uint8Array {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const terminalApi: TerminalApi = {
  open(request) {
    return ipcRenderer.invoke('terminal:open', request)
  },
  write(request) {
    return ipcRenderer.invoke('terminal:write', request)
  },
  resize(request) {
    return ipcRenderer.invoke('terminal:resize', request)
  },
  close(request) {
    return ipcRenderer.invoke('terminal:close', request)
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
    return ipcRenderer.invoke('logs:start', request)
  },
  stop(request) {
    return ipcRenderer.invoke('logs:stop', request)
  },
  setFilters(request) {
    return ipcRenderer.invoke('logs:setFilters', request)
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
    return ipcRenderer.invoke('stats:getInfo', request)
  },
  subscribe(request) {
    return ipcRenderer.invoke('stats:subscribe', request)
  },
  unsubscribe(request) {
    return ipcRenderer.invoke('stats:unsubscribe', request)
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
    return ipcRenderer.invoke('services:isAvailable', request)
  },
  list(request) {
    return ipcRenderer.invoke('services:list', request)
  },
  getUnit(request) {
    return ipcRenderer.invoke('services:getUnit', request)
  },
  getUnitFile(request) {
    return ipcRenderer.invoke('services:getUnitFile', request)
  },
  getUnitLogs(request) {
    return ipcRenderer.invoke('services:getUnitLogs', request)
  },
  action(request) {
    return ipcRenderer.invoke('services:action', request)
  }
}

const cronApi: CronApi = {
  list(request) {
    return ipcRenderer.invoke('cron:list', request)
  },
  getSource(request) {
    return ipcRenderer.invoke('cron:getSource', request)
  },
  createJob(request) {
    return ipcRenderer.invoke('cron:createJob', request)
  },
  updateJob(request) {
    return ipcRenderer.invoke('cron:updateJob', request)
  },
  deleteJob(request) {
    return ipcRenderer.invoke('cron:deleteJob', request)
  }
}

const usersApi: UsersApi = {
  isAvailable(request) {
    return ipcRenderer.invoke('users:isAvailable', request)
  },
  list(request) {
    return ipcRenderer.invoke('users:list', request)
  },
  get(request) {
    return ipcRenderer.invoke('users:get', request)
  },
  groups(request) {
    return ipcRenderer.invoke('users:groups', request)
  },
  action(request) {
    return ipcRenderer.invoke('users:action', request)
  }
}

const processesApi: ProcessesApi = {
  list(request) {
    return ipcRenderer.invoke('processes:list', request)
  },
  get(request) {
    return ipcRenderer.invoke('processes:get', request)
  },
  subscribe(request) {
    return ipcRenderer.invoke('processes:subscribe', request)
  },
  unsubscribe(request) {
    return ipcRenderer.invoke('processes:unsubscribe', request)
  },
  signal(request) {
    return ipcRenderer.invoke('processes:signal', request)
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
    return ipcRenderer.invoke('packages:isAvailable', request)
  },
  overview(request) {
    return ipcRenderer.invoke('packages:overview', request)
  },
  list(request) {
    return ipcRenderer.invoke('packages:list', request)
  },
  search(request) {
    return ipcRenderer.invoke('packages:search', request)
  },
  info(request) {
    return ipcRenderer.invoke('packages:info', request)
  },
  updates(request) {
    return ipcRenderer.invoke('packages:updates', request)
  },
  operationStart(request) {
    return ipcRenderer.invoke('packages:operationStart', request)
  },
  operationCancel(request) {
    return ipcRenderer.invoke('packages:operationCancel', request)
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
    return ipcRenderer.invoke('files:list', request)
  },
  read(request) {
    return ipcRenderer.invoke('files:read', request)
  },
  write(request) {
    return ipcRenderer.invoke('files:write', request)
  },
  mkdir(request) {
    return ipcRenderer.invoke('files:mkdir', request)
  },
  rename(request) {
    return ipcRenderer.invoke('files:rename', request)
  },
  delete(request) {
    return ipcRenderer.invoke('files:delete', request)
  },
  upload(request) {
    return ipcRenderer.invoke('files:upload', request)
  },
  download(request) {
    return ipcRenderer.invoke('files:download', request)
  },
  copy(request) {
    return ipcRenderer.invoke('files:copy', request)
  },
  cancelTransfer(request) {
    return ipcRenderer.invoke('files:cancelTransfer', request)
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
    return ipcRenderer.invoke('docker:isAvailable', request)
  },
  listContainers(request) {
    return ipcRenderer.invoke('docker:listContainers', request)
  },
  listImages(request) {
    return ipcRenderer.invoke('docker:listImages', request)
  },
  listVolumes(request) {
    return ipcRenderer.invoke('docker:listVolumes', request)
  },
  listNetworks(request) {
    return ipcRenderer.invoke('docker:listNetworks', request)
  },
  startContainer(request) {
    return ipcRenderer.invoke('docker:startContainer', request)
  },
  stopContainer(request) {
    return ipcRenderer.invoke('docker:stopContainer', request)
  },
  restartContainer(request) {
    return ipcRenderer.invoke('docker:restartContainer', request)
  },
  removeContainer(request) {
    return ipcRenderer.invoke('docker:removeContainer', request)
  },
  inspectContainer(request) {
    return ipcRenderer.invoke('docker:inspectContainer', request)
  },
  removeImage(request) {
    return ipcRenderer.invoke('docker:removeImage', request)
  },
  removeVolume(request) {
    return ipcRenderer.invoke('docker:removeVolume', request)
  },
  startLogs(request) {
    return ipcRenderer.invoke('docker:logsStart', request)
  },
  stopLogs(request) {
    return ipcRenderer.invoke('docker:logsStop', request)
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
    return ipcRenderer.invoke('ports:list', request)
  },
  setFirewallRule(request) {
    return ipcRenderer.invoke('ports:setFirewallRule', request)
  },
  deleteFirewallRule(request) {
    return ipcRenderer.invoke('ports:deleteFirewallRule', request)
  }
}

const nginxApi: NginxApi = {
  status(request) {
    return ipcRenderer.invoke('nginx:status', request)
  },
  configTree(request) {
    return ipcRenderer.invoke('nginx:configTree', request)
  },
  readConfig(request) {
    return ipcRenderer.invoke('nginx:readConfig', request)
  },
  writeConfig(request) {
    return ipcRenderer.invoke('nginx:writeConfig', request)
  },
  validate(request) {
    return ipcRenderer.invoke('nginx:validate', request)
  },
  action(request) {
    return ipcRenderer.invoke('nginx:action', request)
  },
  logPaths(request) {
    return ipcRenderer.invoke('nginx:logPaths', request)
  },
  startLogs(request) {
    return ipcRenderer.invoke('nginx:logsStart', request)
  },
  stopLogs(request) {
    return ipcRenderer.invoke('nginx:logsStop', request)
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
    return ipcRenderer.invoke('ssl:overview', request)
  },
  certificate(request) {
    return ipcRenderer.invoke('ssl:certificate', request)
  },
  nginxSites(request) {
    return ipcRenderer.invoke('ssl:nginxSites', request)
  },
  installCertbot(request) {
    return ipcRenderer.invoke('ssl:installCertbot', request)
  },
  enableHttpsStart(request) {
    return ipcRenderer.invoke('ssl:enableHttpsStart', request)
  },
  enableHttpsCancel(request) {
    return ipcRenderer.invoke('ssl:enableHttpsCancel', request)
  },
  renew(request) {
    return ipcRenderer.invoke('ssl:renew', request)
  },
  testRenewal(request) {
    return ipcRenderer.invoke('ssl:testRenewal', request)
  },
  enableAutoRenewal(request) {
    return ipcRenderer.invoke('ssl:enableAutoRenewal', request)
  },
  verifyHttps(request) {
    return ipcRenderer.invoke('ssl:verifyHttps', request)
  },
  renewalLog(request) {
    return ipcRenderer.invoke('ssl:renewalLog', request)
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

const relayApi: RelayApi = {
  platform: process.platform,

  invoke<C extends IpcChannel>(
    channel: C,
    ...args: IpcRequestMap[C] extends void ? [] : [IpcRequestMap[C]]
  ): Promise<IpcResponseMap[C]> {
    if (!allowedChannels.includes(channel)) {
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
    }
    const payload = args[0]
    return ipcRenderer.invoke(channel, payload) as Promise<IpcResponseMap[C]>
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
  ...(process.env.RELAY_SCREENSHOT === '1'
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

contextBridge.exposeInMainWorld('relay', relayApi)
