import { app, BrowserWindow, session, shell } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { registerAuthHandlers } from './auth'

let mainWindow: BrowserWindow | null = null

// Only http(s) URLs are allowed to leave the app via shell.openExternal /
// window.open. Anything else (file:, javascript:, custom schemes from a
// compromised IdP redirect) is silently denied to keep RCE off the table.
function isSafeExternalUrl(raw: string): boolean {
  if (typeof raw !== 'string') return false
  try {
    const parsed = new URL(raw)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function resolveIconPath(): string | undefined {
  const candidates = [
    join(__dirname, '../../build/icon.png'),
    join(__dirname, '../../resources/icon.png'),
    join(process.resourcesPath || '', 'icon.png')
  ]
  // electron-builder is expected to ship build/icon.png; in dev the path
  // resolves to the repo's build/ folder. If none exist we let Electron use
  // the default icon rather than crash.
  for (const candidate of candidates) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { existsSync } = require('fs')
      if (existsSync(candidate)) return candidate
    } catch {
      // ignore
    }
  }
  return undefined
}

function createWindow(): BrowserWindow {
  const icon = resolveIconPath()
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'SASO Willen Edition',
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow!.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (isSafeExternalUrl(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // Block in-app navigation away from the bundled renderer. Loopback
  // callbacks during pairing legitimately open in the system browser via
  // shell.openExternal, so any navigation event reaching the renderer
  // would be from a compromised origin or stray <a href="...">.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('file://') ||
      (process.env['ELECTRON_RENDERER_URL'] &&
        url.startsWith(process.env['ELECTRON_RENDERER_URL']))
    if (!allowed) {
      event.preventDefault()
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.willen-federation.saso')

  // Lock the renderer down with a strict CSP. Inline styles stay allowed
  // because Tailwind injects them; scripts must come from the bundle. The
  // SASO server endpoint is approved at runtime via the configured
  // server URL — connect-src 'self' covers the bundled origin, plus
  // we let any https origin through for the user-configured backend.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          [
            "default-src 'self'",
            "script-src 'self'",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: blob: https:",
            "font-src 'self' data:",
            "connect-src 'self' https: http://127.0.0.1:* http://localhost:*",
            "frame-ancestors 'none'",
            "base-uri 'self'",
            "form-action 'none'"
          ].join('; ')
        ],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer']
      }
    })
  })

  // Reject any request to grant the renderer privileged permissions
  // (camera/mic/geolocation/etc.). The barcode scanner uses zxing-browser
  // on a static image stream so it doesn't go through this API.
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const win = createWindow()

  registerAllHandlers()
  registerAuthHandlers(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
