/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { ipcMain, BrowserWindow } from 'electron'
import { engineManager } from './engine'
import { getWineInfo, showWineInstallDialog, isWineInstalled } from './wine'
import {
  checkAllDependencies,
  runFullInstallation,
  continueWithWine,
  cancelInstallation,
  resetCancellation,
  isHomebrewInstalled
} from './installer'
import path from 'path'
import fs from 'fs'
import os from 'os'

// Validation: 40-character hex for contentId
const CONTENT_ID_REGEX = /^[a-fA-F0-9]{40}$/

// Allowed host for API (SSRF protection)
const ALLOWED_API_HOST = 'http://127.0.0.1:6878/'

/**
 * Validate contentId (40-character hex)
 */
function isValidContentId(contentId: unknown): contentId is string {
  return typeof contentId === 'string' && CONTENT_ID_REGEX.test(contentId)
}

/**
 * Validate URL (must start with allowed host)
 */
function isValidApiUrl(url: unknown): url is string {
  return typeof url === 'string' && url.startsWith(ALLOWED_API_HOST)
}

export function setupIpcHandlers(): void {
  // Engine handlers
  ipcMain.handle('engine:start', async () => {
    try {
      await engineManager.start()
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('engine:stop', () => {
    engineManager.stop()
    return { success: true }
  })

  ipcMain.handle('engine:status', async () => {
    return await engineManager.getStatus()
  })

  ipcMain.handle('engine:exists', () => {
    return engineManager.engineExists()
  })

  // Ace Stream playback handlers
  ipcMain.handle('acestream:play', async (_, contentId: string) => {
    // Validate contentId to protect against injection
    if (!isValidContentId(contentId)) {
      return { success: false, error: 'Invalid content ID format. Expected 40-character hex string.' }
    }
    
    try {
      const session = await engineManager.startPlayback(contentId)
      return { success: true, session }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('acestream:stats', async (_, statUrl: string) => {
    // Validate URL to protect against SSRF
    if (!isValidApiUrl(statUrl)) {
      return { status: 'error', peers: 0, speedDown: 0, speedUp: 0, downloaded: 0, uploaded: 0, isLive: false }
    }
    return await engineManager.getStreamStats(statUrl)
  })

  ipcMain.handle('acestream:stop', async (_, commandUrl: string) => {
    // Validate URL to protect against SSRF
    if (!isValidApiUrl(commandUrl)) {
      return { success: false, error: 'Invalid command URL' }
    }
    await engineManager.stopPlayback(commandUrl)
    return { success: true }
  })

  // Wine handlers (macOS only)
  ipcMain.handle('wine:info', () => {
    if (process.platform !== 'darwin') {
      return { applicable: false }
    }
    return {
      applicable: true,
      ...getWineInfo()
    }
  })

  ipcMain.handle('wine:showInstallDialog', async () => {
    if (process.platform === 'darwin') {
      await showWineInstallDialog()
    }
  })

  // Platform info
  ipcMain.handle('platform:info', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      isMac: process.platform === 'darwin',
      isWindows: process.platform === 'win32',
      isLinux: process.platform === 'linux'
    }
  })

  // Cache handlers
  ipcMain.handle('cache:getSize', async () => {
    try {
      const cachePath = getCachePath()
      if (!cachePath || !fs.existsSync(cachePath)) {
        return { success: true, size: 0, path: cachePath }
      }
      const size = await getDirectorySize(cachePath)
      return { success: true, size, path: cachePath }
    } catch (error: any) {
      return { success: false, error: error.message, size: 0 }
    }
  })

  ipcMain.handle('cache:clear', async () => {
    try {
      const cachePath = getCachePath()
      if (!cachePath || !fs.existsSync(cachePath)) {
        return { success: true }
      }
      await clearDirectory(cachePath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Installer handlers (macOS only)
  ipcMain.handle('install:checkAll', async () => {
    if (process.platform !== 'darwin') {
      return { applicable: false, allReady: true }
    }
    const status = await checkAllDependencies()
    return { applicable: true, ...status }
  })

  ipcMain.handle('install:start', async () => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Not applicable' }
    }
    const win = BrowserWindow.getFocusedWindow()
    resetCancellation()
    const result = await runFullInstallation(win)
    return { success: result.success, homebrewWasAlreadyInstalled: result.homebrewWasAlreadyInstalled }
  })

  ipcMain.handle('install:continueWine', async () => {
    if (process.platform !== 'darwin') {
      return { success: false, error: 'Not applicable' }
    }
    const win = BrowserWindow.getFocusedWindow()
    resetCancellation()
    const result = await continueWithWine(win)
    return { success: result }
  })

  ipcMain.handle('install:cancel', () => {
    cancelInstallation()
    return { success: true }
  })

  ipcMain.handle('install:checkHomebrew', () => {
    return { installed: isHomebrewInstalled() }
  })
}

/**
 * Get cache directory path based on platform
 * This is the entire .ACEStream data folder, not just a "cache" subfolder
 */
function getCachePath(): string | null {
  if (process.platform === 'darwin') {
    // macOS: Wine prefix
    const winePrefix = path.join(os.homedir(), '.wine-acestream')
    const username = os.userInfo().username
    return path.join(winePrefix, 'drive_c', 'users', username, 'AppData', 'Roaming', '.ACEStream')
  } else if (process.platform === 'win32') {
    // Windows: AppData\Roaming\.ACEStream
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming')
    return path.join(appData, '.ACEStream')
  } else {
    // Linux
    return path.join(os.homedir(), '.ACEStream')
  }
}

/**
 * Calculate directory size recursively
 */
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0
  
  try {
    const items = fs.readdirSync(dirPath, { withFileTypes: true })
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item.name)
      
      if (item.isDirectory()) {
        totalSize += await getDirectorySize(itemPath)
      } else if (item.isFile()) {
        try {
          const stats = fs.statSync(itemPath)
          totalSize += stats.size
        } catch {
          // Skip files we can't access
        }
      }
    }
  } catch {
    // Skip directories we can't access
  }
  
  return totalSize
}

/**
 * Clear directory contents (but keep the directory)
 * Gracefully handles locked/busy files
 */
async function clearDirectory(dirPath: string): Promise<void> {
  const items = fs.readdirSync(dirPath, { withFileTypes: true })
  const errors: string[] = []
  
  for (const item of items) {
    const itemPath = path.join(dirPath, item.name)
    
    try {
      if (item.isDirectory()) {
        fs.rmSync(itemPath, { recursive: true, force: true })
      } else {
        fs.unlinkSync(itemPath)
      }
    } catch (err: any) {
      // File may be busy or locked - skip
      errors.push(`${item.name}: ${err.message}`)
    }
  }
  
  // Log errors but don't fail
  if (errors.length > 0) {
    console.warn(`Some files could not be deleted: ${errors.join(', ')}`)
  }
}
