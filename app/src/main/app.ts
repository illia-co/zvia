import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers, unregisterIpcHandlers } from './ipc/registry'
import { profileStore } from './store/profiles'
import { topologyHistoryStore } from './store/topologyHistory'
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
import { topologyService } from './services/deployments'
import { getScreenshotTool, isScreenshotMode, setScreenshotMainWindow } from './screenshotMode'
import { captureScreenshotIfReady, configureScreenshotWindow } from './screenshotCapture'

const isDev = !app.isPackaged

interface WindowAware {
  setMainWindow(window: BrowserWindow | null): void
}

const windowAwareServices: WindowAware[] = [
  connectionManager,
  terminalService,
  fileService,
  statsService,
  logService,
  dockerService,
  nginxService,
  sslService,
  processService,
  packageService,
  topologyService
]

function setMainWindowOnServices(window: BrowserWindow | null): void {
  for (const service of windowAwareServices) {
    service.setMainWindow(window)
  }
}

function configureDemoWindow(window: BrowserWindow): void {
  window.webContents.once('did-finish-load', () => {
    window.webContents.send('screenshot:configure', { tool: getScreenshotTool() })
  })
}

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
  await topologyHistoryStore.load()
  registerIpcHandlers()

  const mainWindow = createWindow()
  configureScreenshotWindow(mainWindow)
  setScreenshotMainWindow(mainWindow)
  setMainWindowOnServices(mainWindow)

  if (isScreenshotMode()) {
    if (process.env.ZVIA_SCREENSHOT_OUTPUT) {
      await captureScreenshotIfReady(mainWindow)
      app.quit()
      return
    }

    // Interactive demo: a normal, clickable window backed by demo stubs.
    configureDemoWindow(mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        const window = createWindow()
        setMainWindowOnServices(window)
        configureDemoWindow(window)
      }
    })
    return
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const window = createWindow()
      setMainWindowOnServices(window)
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
