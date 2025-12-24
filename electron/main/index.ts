/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { setupIpcHandlers } from './ipc'
import { engineManager } from './engine'

// Disable GPU acceleration for better compatibility
app.disableHardwareAcceleration()

// Protocol handler for acestream:// URLs
const PROTOCOL = 'acestream'

// Store pending URL if app is opened via protocol before window is ready
let pendingProtocolUrl: string | null = null

// Register as default protocol handler (for development)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL)
}

let mainWindow: BrowserWindow | null = null

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// Extract content ID from acestream:// URL
function extractContentIdFromUrl(url: string): string | null {
  if (!url || !url.startsWith('acestream://')) {
    return null
  }
  // acestream://016d48fb89bb9505ab3f883db1bfb3a7c0a3eccc
  const contentId = url.replace('acestream://', '').replace(/[/?#].*$/, '')
  // Validate: should be 40 character hex string
  if (/^[a-fA-F0-9]{40}$/.test(contentId)) {
    return contentId
  }
  return null
}

// Send acestream URL to renderer
function handleProtocolUrl(url: string) {
  const contentId = extractContentIdFromUrl(url)
  if (!contentId) {
    console.error('Invalid acestream URL:', url)
    return
  }
  
  if (mainWindow && mainWindow.webContents) {
    // Window is ready, send directly
    mainWindow.webContents.send('acestream:open-url', contentId)
    mainWindow.focus()
  } else {
    // Window not ready yet, store for later
    pendingProtocolUrl = contentId
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#1a1a2e'
  })

  // Security: Restrict navigation to prevent XSS and redirect attacks
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowedOrigins = [
      VITE_DEV_SERVER_URL,
      'file://'
    ].filter(Boolean)
    
    const isAllowed = allowedOrigins.some(origin => url.startsWith(origin as string))
    if (!isAllowed) {
      event.preventDefault()
      console.warn('Blocked navigation to:', url)
    }
  })

  // Security: Add Content Security Policy header
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "img-src 'self' data: blob:; " +
          "media-src 'self' http://127.0.0.1:* blob:; " +
          "connect-src 'self' http://127.0.0.1:* ws://127.0.0.1:*; " +
          "font-src 'self'"
        ]
      }
    })
  })

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  // Send pending protocol URL after page load
  mainWindow.webContents.on('did-finish-load', () => {
    if (pendingProtocolUrl) {
      mainWindow?.webContents.send('acestream:open-url', pendingProtocolUrl)
      pendingProtocolUrl = null
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// Setup IPC handlers
setupIpcHandlers()

// Handle protocol on macOS when app is already running
app.on('open-url', (event, url) => {
  event.preventDefault()
  handleProtocolUrl(url)
})

// Make sure this is a single instance app
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  // Handle protocol on Windows/Linux when second instance is launched
  app.on('second-instance', (_event, commandLine) => {
    // Find acestream:// URL in command line arguments
    const url = commandLine.find(arg => arg.startsWith('acestream://'))
    if (url) {
      handleProtocolUrl(url)
    }
    
    // Focus the main window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()

    // Check if app was opened via protocol URL (Windows/Linux cold start)
    const protocolUrl = process.argv.find(arg => arg.startsWith('acestream://'))
    if (protocolUrl) {
      handleProtocolUrl(protocolUrl)
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
}

app.on('window-all-closed', () => {
  // Stop engine when app is closing
  engineManager.stop()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // Ensure engine is stopped
  engineManager.stop()
})

app.on('will-quit', () => {
  // Final cleanup - ensure all Wine processes are terminated
  engineManager.stop()
})

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason)
})
