import { app, BrowserWindow, shell, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerAllHandlers } from './ipc'
import { registerAuthHandlers, handleCallback, getUser } from './auth'
import { getSetting } from './database'

let mainWindow: BrowserWindow | null = null

function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'SASO Willen Edition',
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
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// Handle OAuth protocol callback (macOS/Linux)
app.on('open-url', async (event, url) => {
  event.preventDefault()
  if (url.startsWith('saso://auth/callback')) {
    const authServerUrl = getSetting('authServerUrl') || ''
    const clientId = getSetting('authClientId') || ''
    const result = await handleCallback(url, authServerUrl, clientId)
    if (mainWindow) {
      if (result.success) {
        const user = getUser()
        mainWindow.webContents.send('auth:stateChanged', user)
      } else {
        mainWindow.webContents.send('auth:error', result.error)
      }
    }
  }
})

// Handle OAuth protocol callback (Windows - second-instance)
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', async (_event, commandLine) => {
    // Windows passes the protocol URL in commandLine
    const url = commandLine.find((arg) => arg.startsWith('saso://'))
    if (url && url.startsWith('saso://auth/callback')) {
      const authServerUrl = getSetting('authServerUrl') || ''
      const clientId = getSetting('authClientId') || ''
      const result = await handleCallback(url, authServerUrl, clientId)
      if (mainWindow) {
        mainWindow.show()
        mainWindow.focus()
        if (result.success) {
          const user = getUser()
          mainWindow.webContents.send('auth:stateChanged', user)
        } else {
          mainWindow.webContents.send('auth:error', result.error)
        }
      }
    } else if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.willen-federation.saso')

  // Register 'saso' protocol
  app.setAsDefaultProtocolClient('saso')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const win = createWindow()

  // Register all IPC handlers
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
