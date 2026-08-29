import { BrowserWindow, ipcMain } from 'electron'
import { serializeError } from '@shared/errors'
import {
  validateConnectRequest,
  validateDisconnectRequest,
  validateExecRequest,
  validateHostKeyResponseRequest,
  validateLogsSetFiltersRequest,
  validateLogsStartRequest,
  validateProfileCreateRequest,
  validateProfileGetRequest,
  validateProfileRemoveRequest,
  validateProfileUpdateRequest,
  validateServerScoped,
  validateTerminalCloseRequest,
  validateTerminalOpenRequest,
  validateTerminalResizeRequest,
  validateTerminalWriteRequest,
  validateStatsSubscribeRequest,
  validateStatsUnsubscribeRequest,
  validateServicesUnitRequest,
  validateServicesUnitLogsRequest,
  validateServicesActionRequest,
  validateCronSourceRequest,
  validateCronCreateJobRequest,
  validateCronUpdateJobRequest,
  validateCronDeleteJobRequest,
  validateFilesListRequest,
  validateFilesReadRequest,
  validateFilesWriteRequest,
  validateFilesMkdirRequest,
  validateFilesRenameRequest,
  validateFilesDeleteRequest,
  validateFilesUploadRequest,
  validateFilesDownloadRequest,
  validateFilesCopyRequest,
  validateFilesCancelTransferRequest,
  validateDockerListContainersRequest,
  validateDockerContainerActionRequest,
  validateDockerRemoveContainerRequest,
  validateDockerInspectRequest,
  validateDockerRemoveImageRequest,
  validateDockerRemoveVolumeRequest,
  validateDockerLogsStartRequest,
  validateDockerLogsStopRequest,
  validatePortsFirewallRuleRequest,
  validatePortsDeleteFirewallRuleRequest,
  validateNginxConfigPathRequest,
  validateNginxWriteConfigRequest,
  validateNginxActionRequest,
  validateNginxLogsStartRequest,
  validateNginxLogsStopRequest,
  validateSslCertIdRequest,
  validateSslCertNameRequest,
  validateSslEnableHttpsRequest,
  validateSslStreamRequest,
  validateSslVerifyRequest,
  validateUsersUsernameRequest,
  validateUsersActionRequest,
  validateProcessesGetRequest,
  validateProcessesSubscribeRequest,
  validateProcessesUnsubscribeRequest,
  validateProcessesSignalRequest,
  validatePackagesListRequest,
  validatePackagesSearchRequest,
  validatePackagesInfoRequest,
  validatePackagesOperationStartRequest,
  validatePackagesOperationCancelRequest
} from '@shared/validate'
import type { IpcChannel } from '@shared/ipc'
import { profileStore } from '../store/profiles'
import { connectionManager } from '../ssh/ConnectionManager'
import { terminalService } from '../services/TerminalService'
import { fileService } from '../services/FileService'
import { statsService } from '../services/StatsService'
import { logService } from '../services/LogService'
import { dockerService } from '../services/DockerService'
import { portService } from '../services/PortService'
import { nginxService } from '../services/NginxService'
import { sslService } from '../services/SSLService'
import { systemdService } from '../services/SystemdService'
import { cronService } from '../services/CronService'
import { userService } from '../services/UserService'
import { processService } from '../services/ProcessService'
import { packageService } from '../services/PackageService'
import { getScreenshotStub } from '../screenshotMode'

function registerHandler<C extends IpcChannel>(
  channel: C,
  handler: (payload: unknown) => Promise<unknown>
): void {
  ipcMain.handle(channel, async (_event, payload) => {
    try {
      const screenshotStub = getScreenshotStub(channel)
      if (screenshotStub) {
        return await screenshotStub(payload)
      }
      return await handler(payload)
    } catch (error) {
      throw serializeError(error)
    }
  })
}

export function registerIpcHandlers(): void {
  registerHandler('profiles:list', async () => profileStore.list())

  registerHandler('profiles:get', async (payload) => {
    const request = validateProfileGetRequest(payload)
    return profileStore.get(request.id)
  })

  registerHandler('profiles:create', async (payload) => {
    const request = validateProfileCreateRequest(payload)
    return profileStore.create(request)
  })

  registerHandler('profiles:update', async (payload) => {
    const request = validateProfileUpdateRequest(payload)
    return profileStore.update(request)
  })

  registerHandler('profiles:remove', async (payload) => {
    const request = validateProfileRemoveRequest(payload)
    await profileStore.remove(request.id)
  })

  registerHandler('connection:connect', async (payload) => {
    const request = validateConnectRequest(payload)
    await connectionManager.connect(request.serverId)
  })

  registerHandler('connection:disconnect', async (payload) => {
    const request = validateDisconnectRequest(payload)
    await connectionManager.disconnect(request.serverId)
  })

  registerHandler('connection:getState', async (payload) => {
    const request = validateServerScoped(payload)
    return connectionManager.getState(request.serverId)
  })

  registerHandler('connection:hostKeyResponse', async (payload) => {
    const request = validateHostKeyResponseRequest(payload)
    connectionManager.respondToHostKey(request.serverId, request.decision)
  })

  registerHandler('connection:exec', async (payload) => {
    const request = validateExecRequest(payload)
    return connectionManager.exec(request.serverId, request.command, request.timeoutMs)
  })

  registerHandler('terminal:open', async (payload) => {
    const request = validateTerminalOpenRequest(payload)
    await terminalService.open(
      request.serverId,
      request.sessionId,
      request.cols,
      request.rows,
      request.command
    )
  })

  registerHandler('terminal:write', async (payload) => {
    const request = validateTerminalWriteRequest(payload)
    terminalService.write(request.serverId, request.sessionId, request.data)
  })

  registerHandler('terminal:resize', async (payload) => {
    const request = validateTerminalResizeRequest(payload)
    terminalService.resize(request.serverId, request.sessionId, request.cols, request.rows)
  })

  registerHandler('terminal:close', async (payload) => {
    const request = validateTerminalCloseRequest(payload)
    terminalService.close(request.serverId, request.sessionId)
  })

  registerHandler('logs:start', async (payload) => {
    const request = validateLogsStartRequest(payload)
    await logService.start(request.serverId, request.query)
  })

  registerHandler('logs:stop', async (payload) => {
    const request = validateServerScoped(payload)
    await logService.stop(request.serverId)
  })

  registerHandler('logs:setFilters', async (payload) => {
    const request = validateLogsSetFiltersRequest(payload)
    await logService.setFilters(request.serverId, request.query)
  })

  registerHandler('stats:getInfo', async (payload) => {
    const request = validateServerScoped(payload)
    return statsService.getInfo(request.serverId)
  })

  registerHandler('stats:subscribe', async (payload) => {
    const request = validateStatsSubscribeRequest(payload)
    statsService.subscribe(request.serverId, request.subscriberId, request.mode)
  })

  registerHandler('stats:unsubscribe', async (payload) => {
    const request = validateStatsUnsubscribeRequest(payload)
    statsService.unsubscribe(request.serverId, request.subscriberId)
  })

  registerHandler('services:isAvailable', async (payload) => {
    const request = validateServerScoped(payload)
    return systemdService.isAvailable(request.serverId)
  })

  registerHandler('services:list', async (payload) => {
    const request = validateServerScoped(payload)
    return systemdService.listUnits(request.serverId)
  })

  registerHandler('services:getUnit', async (payload) => {
    const request = validateServicesUnitRequest(payload)
    return systemdService.getUnit(request.serverId, request.unit)
  })

  registerHandler('services:getUnitFile', async (payload) => {
    const request = validateServicesUnitRequest(payload)
    return systemdService.getUnitFile(request.serverId, request.unit)
  })

  registerHandler('services:getUnitLogs', async (payload) => {
    const request = validateServicesUnitLogsRequest(payload)
    return systemdService.getUnitLogs(request.serverId, request.unit, request.lines)
  })

  registerHandler('services:action', async (payload) => {
    const request = validateServicesActionRequest(payload)
    await systemdService.runAction(request.serverId, request.unit, request.action)
  })

  registerHandler('cron:list', async (payload) => {
    const request = validateServerScoped(payload)
    return cronService.list(request.serverId)
  })

  registerHandler('cron:getSource', async (payload) => {
    const request = validateCronSourceRequest(payload)
    return cronService.getSource(request.serverId, request.target)
  })

  registerHandler('cron:createJob', async (payload) => {
    const request = validateCronCreateJobRequest(payload)
    await cronService.createJob(
      request.serverId,
      request.target,
      request.schedule,
      request.command
    )
  })

  registerHandler('cron:updateJob', async (payload) => {
    const request = validateCronUpdateJobRequest(payload)
    await cronService.updateJob(
      request.serverId,
      request.target,
      request.jobId,
      request.schedule,
      request.command
    )
  })

  registerHandler('cron:deleteJob', async (payload) => {
    const request = validateCronDeleteJobRequest(payload)
    await cronService.deleteJob(request.serverId, request.target, request.jobId)
  })

  registerHandler('users:isAvailable', async (payload) => {
    const request = validateServerScoped(payload)
    return userService.isAvailable(request.serverId)
  })

  registerHandler('users:list', async (payload) => {
    const request = validateServerScoped(payload)
    return userService.list(request.serverId)
  })

  registerHandler('users:get', async (payload) => {
    const request = validateUsersUsernameRequest(payload)
    return userService.get(request.serverId, request.username)
  })

  registerHandler('users:groups', async (payload) => {
    const request = validateServerScoped(payload)
    return userService.groups(request.serverId)
  })

  registerHandler('users:action', async (payload) => {
    const request = validateUsersActionRequest(payload)
    await userService.action(request.serverId, request.action)
  })

  registerHandler('processes:list', async (payload) => {
    const request = validateServerScoped(payload)
    return processService.list(request.serverId)
  })

  registerHandler('processes:get', async (payload) => {
    const request = validateProcessesGetRequest(payload)
    return processService.get(request.serverId, request.pid)
  })

  registerHandler('processes:subscribe', async (payload) => {
    const request = validateProcessesSubscribeRequest(payload)
    processService.subscribe(request.serverId, request.subscriberId, request.intervalMs)
  })

  registerHandler('processes:unsubscribe', async (payload) => {
    const request = validateProcessesUnsubscribeRequest(payload)
    processService.unsubscribe(request.serverId, request.subscriberId)
  })

  registerHandler('processes:signal', async (payload) => {
    const request = validateProcessesSignalRequest(payload)
    await processService.signal(request.serverId, request.pid, request.signal)
  })

  registerHandler('packages:isAvailable', async (payload) => {
    const request = validateServerScoped(payload)
    return packageService.isAvailable(request.serverId)
  })

  registerHandler('packages:overview', async (payload) => {
    const request = validateServerScoped(payload)
    return packageService.overview(request.serverId)
  })

  registerHandler('packages:list', async (payload) => {
    const request = validatePackagesListRequest(payload)
    return packageService.listInstalled(
      request.serverId,
      request.query,
      request.offset,
      request.limit
    )
  })

  registerHandler('packages:search', async (payload) => {
    const request = validatePackagesSearchRequest(payload)
    return packageService.search(request.serverId, request.query)
  })

  registerHandler('packages:info', async (payload) => {
    const request = validatePackagesInfoRequest(payload)
    return packageService.getInfo(request.serverId, request.packageName)
  })

  registerHandler('packages:updates', async (payload) => {
    const request = validateServerScoped(payload)
    return packageService.listUpdates(request.serverId)
  })

  registerHandler('packages:operationStart', async (payload) => {
    const request = validatePackagesOperationStartRequest(payload)
    await packageService.startOperation(
      request.serverId,
      request.streamId,
      request.operation
    )
  })

  registerHandler('packages:operationCancel', async (payload) => {
    const request = validatePackagesOperationCancelRequest(payload)
    packageService.cancelOperation(request.serverId, request.streamId)
  })

  registerHandler('files:list', async (payload) => {
    const request = validateFilesListRequest(payload)
    return fileService.list(request)
  })

  registerHandler('files:read', async (payload) => {
    const request = validateFilesReadRequest(payload)
    return fileService.read(request)
  })

  registerHandler('files:write', async (payload) => {
    const request = validateFilesWriteRequest(payload)
    await fileService.write(request)
  })

  registerHandler('files:mkdir', async (payload) => {
    const request = validateFilesMkdirRequest(payload)
    await fileService.mkdir(request)
  })

  registerHandler('files:rename', async (payload) => {
    const request = validateFilesRenameRequest(payload)
    await fileService.rename(request)
  })

  registerHandler('files:delete', async (payload) => {
    const request = validateFilesDeleteRequest(payload)
    await fileService.delete(request)
  })

  registerHandler('files:upload', async (payload) => {
    const request = validateFilesUploadRequest(payload)
    await fileService.upload(request)
  })

  registerHandler('files:download', async (payload) => {
    const request = validateFilesDownloadRequest(payload)
    return fileService.download(request)
  })

  registerHandler('files:copy', async (payload) => {
    const request = validateFilesCopyRequest(payload)
    await fileService.copy(request)
  })

  registerHandler('files:cancelTransfer', async (payload) => {
    const request = validateFilesCancelTransferRequest(payload)
    fileService.cancelTransfer(request.transferId)
  })

  registerHandler('docker:isAvailable', async (payload) => {
    const request = validateServerScoped(payload)
    return dockerService.isAvailable(request.serverId)
  })

  registerHandler('docker:listContainers', async (payload) => {
    const request = validateDockerListContainersRequest(payload)
    return dockerService.listContainers(request.serverId, request.all ?? false)
  })

  registerHandler('docker:listImages', async (payload) => {
    const request = validateServerScoped(payload)
    return dockerService.listImages(request.serverId)
  })

  registerHandler('docker:listVolumes', async (payload) => {
    const request = validateServerScoped(payload)
    return dockerService.listVolumes(request.serverId)
  })

  registerHandler('docker:listNetworks', async (payload) => {
    const request = validateServerScoped(payload)
    return dockerService.listNetworks(request.serverId)
  })

  registerHandler('docker:startContainer', async (payload) => {
    const request = validateDockerContainerActionRequest(payload)
    await dockerService.startContainer(request.serverId, request.containerId)
  })

  registerHandler('docker:stopContainer', async (payload) => {
    const request = validateDockerContainerActionRequest(payload)
    await dockerService.stopContainer(request.serverId, request.containerId)
  })

  registerHandler('docker:restartContainer', async (payload) => {
    const request = validateDockerContainerActionRequest(payload)
    await dockerService.restartContainer(request.serverId, request.containerId)
  })

  registerHandler('docker:removeContainer', async (payload) => {
    const request = validateDockerRemoveContainerRequest(payload)
    await dockerService.removeContainer(request.serverId, request.containerId, request.force ?? false)
  })

  registerHandler('docker:inspectContainer', async (payload) => {
    const request = validateDockerInspectRequest(payload)
    return dockerService.inspectContainer(request.serverId, request.containerId)
  })

  registerHandler('docker:removeImage', async (payload) => {
    const request = validateDockerRemoveImageRequest(payload)
    await dockerService.removeImage(request.serverId, request.imageId, request.force ?? false)
  })

  registerHandler('docker:removeVolume', async (payload) => {
    const request = validateDockerRemoveVolumeRequest(payload)
    await dockerService.removeVolume(request.serverId, request.volumeName, request.force ?? false)
  })

  registerHandler('docker:logsStart', async (payload) => {
    const request = validateDockerLogsStartRequest(payload)
    await dockerService.startLogs(request.serverId, request.streamId, request.containerId, {
      timestamps: request.timestamps,
      tail: request.tail
    })
  })

  registerHandler('docker:logsStop', async (payload) => {
    const request = validateDockerLogsStopRequest(payload)
    dockerService.stopLogs(request.serverId, request.streamId)
  })

  registerHandler('ports:list', async (payload) => {
    const request = validateServerScoped(payload)
    return portService.list(request.serverId)
  })

  registerHandler('ports:setFirewallRule', async (payload) => {
    const request = validatePortsFirewallRuleRequest(payload)
    await portService.setRule(
      request.serverId,
      request.action,
      request.port,
      request.protocol
    )
  })

  registerHandler('ports:deleteFirewallRule', async (payload) => {
    const request = validatePortsDeleteFirewallRuleRequest(payload)
    await portService.deleteRule(request.serverId, request.ruleId)
  })

  registerHandler('nginx:status', async (payload) => {
    const request = validateServerScoped(payload)
    return nginxService.getStatus(request.serverId)
  })

  registerHandler('nginx:configTree', async (payload) => {
    const request = validateServerScoped(payload)
    return nginxService.getConfigTree(request.serverId)
  })

  registerHandler('nginx:readConfig', async (payload) => {
    const request = validateNginxConfigPathRequest(payload)
    return nginxService.readConfig(request.serverId, request.path)
  })

  registerHandler('nginx:writeConfig', async (payload) => {
    const request = validateNginxWriteConfigRequest(payload)
    await nginxService.writeConfig(request.serverId, request.path, request.content)
  })

  registerHandler('nginx:validate', async (payload) => {
    const request = validateServerScoped(payload)
    return nginxService.validate(request.serverId)
  })

  registerHandler('nginx:action', async (payload) => {
    const request = validateNginxActionRequest(payload)
    await nginxService.runAction(request.serverId, request.action)
  })

  registerHandler('nginx:logPaths', async (payload) => {
    const request = validateServerScoped(payload)
    return nginxService.getLogPaths(request.serverId)
  })

  registerHandler('nginx:logsStart', async (payload) => {
    const request = validateNginxLogsStartRequest(payload)
    await nginxService.startLogs(request.serverId, request.streamId, request.path)
  })

  registerHandler('nginx:logsStop', async (payload) => {
    const request = validateNginxLogsStopRequest(payload)
    nginxService.stopLogs(request.serverId, request.streamId)
  })

  registerHandler('ssl:overview', async (payload) => {
    const request = validateServerScoped(payload)
    return sslService.getOverview(request.serverId)
  })

  registerHandler('ssl:certificate', async (payload) => {
    const request = validateSslCertIdRequest(payload)
    return sslService.getCertificate(request.serverId, request.id)
  })

  registerHandler('ssl:nginxSites', async (payload) => {
    const request = validateServerScoped(payload)
    return sslService.getNginxSites(request.serverId)
  })

  registerHandler('ssl:installCertbot', async (payload) => {
    const request = validateServerScoped(payload)
    await sslService.installCertbot(request.serverId)
  })

  registerHandler('ssl:enableHttpsStart', async (payload) => {
    const request = validateSslEnableHttpsRequest(payload)
    await sslService.startEnableHttps(request.serverId, request.streamId, {
      domain: request.domain,
      configPath: request.configPath,
      email: request.email,
      redirect: request.redirect
    })
  })

  registerHandler('ssl:enableHttpsCancel', async (payload) => {
    const request = validateSslStreamRequest(payload)
    sslService.cancelEnableHttps(request.serverId, request.streamId)
  })

  registerHandler('ssl:renew', async (payload) => {
    const request = validateSslCertNameRequest(payload)
    await sslService.renew(request.serverId, request.certName)
  })

  registerHandler('ssl:testRenewal', async (payload) => {
    const request = validateSslCertNameRequest(payload)
    return sslService.testRenewal(request.serverId, request.certName)
  })

  registerHandler('ssl:enableAutoRenewal', async (payload) => {
    const request = validateServerScoped(payload)
    await sslService.enableAutoRenewal(request.serverId)
  })

  registerHandler('ssl:verifyHttps', async (payload) => {
    const request = validateSslVerifyRequest(payload)
    return sslService.verifyHttps(request.serverId, request.domain)
  })

  registerHandler('ssl:renewalLog', async (payload) => {
    const request = validateSslCertNameRequest(payload)
    return sslService.getRenewalLog(request.serverId, request.certName)
  })

  ipcMain.handle('window:toggleMaximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return
    if (window.isMaximized()) {
      window.unmaximize()
    } else {
      window.maximize()
    }
  })

  ipcMain.handle('window:isFullscreen', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isFullScreen() ?? false
  })
}

export function unregisterIpcHandlers(): void {
  const channels: IpcChannel[] = [
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
  for (const channel of channels) {
    ipcMain.removeHandler(channel)
  }
}
