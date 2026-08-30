import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/registry'
import { profileStore } from './store/profiles'
import { connectionManager } from './ssh/ConnectionManager'
import { hostKeyStore } from './ssh/hostKeys'
import { statsService } from './services/StatsService'
import { logService } from './services/LogService'
import { dockerService } from './services/DockerService'
import { nginxService } from './services/NginxService'
import { sslService } from './services/SSLService'
import { terminalService } from './services/TerminalService'
import { fileService } from './services/FileService'
import { processService } from './services/ProcessService'
import { packageService } from './services/PackageService'
import { isScreenshotMode, setScreenshotMainWindow } from './screenshotMode'
import { captureScreenshotIfReady, configureScreenshotWindow } from './screenshotCapture'

const isDev = !app.isPackaged

function getContentSecurityPolicy(): string {
  const devPolicy = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self' ws://localhost:* http://localhost:*"
  ].join('; ')

  const prodPolicy = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    "connect-src 'self'"
  ].join('; ')

  return isDev ? devPolicy : prodPolicy
}

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [getContentSecurityPolicy()]
      }
    })
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL()
    if (url !== current) {
      event.preventDefault()
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  const sendFullscreenState = (): void => {
    if (mainWindow.isDestroyed()) return
    mainWindow.webContents.send('window:fullscreenChanged', {
      isFullscreen: mainWindow.isFullScreen()
    })
  }

  mainWindow.on('enter-full-screen', sendFullscreenState)
  mainWindow.on('leave-full-screen', sendFullscreenState)

  const webContents = mainWindow.webContents

  webContents.on('render-process-gone', (_event, details) => {
    console.error('[Zvia] Renderer process gone:', details)
    if (isDev) {
      webContents.openDevTools({ mode: 'detach' })
    }
  })

  webContents.on('unresponsive', () => {
    console.error('[Zvia] Renderer became unresponsive')
    if (isDev) {
      webContents.openDevTools({ mode: 'detach' })
    }
  })

  webContents.on('responsive', () => {
    console.log('[Zvia] Renderer became responsive again')
  })

  webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Zvia] Failed to load:', { errorCode, errorDescription, validatedURL })
  })

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(async () => {
  await profileStore.load()
  await hostKeyStore.load()
  registerIpcHandlers()

  const mainWindow = createWindow()
  configureScreenshotWindow(mainWindow)
  setScreenshotMainWindow(mainWindow)
  connectionManager.setMainWindow(mainWindow)
  terminalService.setMainWindow(mainWindow)
  fileService.setMainWindow(mainWindow)
  statsService.setMainWindow(mainWindow)
  logService.setMainWindow(mainWindow)
  dockerService.setMainWindow(mainWindow)
  nginxService.setMainWindow(mainWindow)
  sslService.setMainWindow(mainWindow)
  processService.setMainWindow(mainWindow)
  packageService.setMainWindow(mainWindow)

  if (isScreenshotMode()) {
    await captureScreenshotIfReady(mainWindow)
    app.quit()
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow()
      connectionManager.setMainWindow(window)
      terminalService.setMainWindow(window)
      fileService.setMainWindow(window)
      statsService.setMainWindow(window)
      logService.setMainWindow(window)
      dockerService.setMainWindow(window)
      nginxService.setMainWindow(window)
      sslService.setMainWindow(window)
      processService.setMainWindow(window)
      packageService.setMainWindow(window)
      terminalService.setMainWindow(window)
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  unregisterIpcHandlers()
})
