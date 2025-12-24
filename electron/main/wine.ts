/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { execSync } from 'child_process'
import { app, dialog, shell } from 'electron'
import fs from 'fs'
import path from 'path'

/**
 * Get localized strings based on system locale
 */
function getLocalizedStrings() {
  const locale = app.getLocale()
  const isRussian = locale.startsWith('ru')
  
  return {
    wineDialog: {
      title: isRussian ? 'Требуется Wine' : 'Wine Required',
      message: isRussian ? 'Wine не установлен' : 'Wine not installed',
      detailAppleSilicon: isRussian 
        ? 'Для работы приложения на macOS требуется Wine.\n\nВыполните в терминале:\n\n1. Установите Rosetta 2:\nsoftwareupdate --install-rosetta --agree-to-license\n\n2. Установите Wine:\nbrew install --cask --no-quarantine wine-stable'
        : 'To run this application on macOS, Wine is required.\n\nRun in terminal:\n\n1. Install Rosetta 2:\nsoftwareupdate --install-rosetta --agree-to-license\n\n2. Install Wine:\nbrew install --cask --no-quarantine wine-stable',
      detailIntel: isRussian
        ? 'Для работы приложения на macOS требуется Wine.\n\nВыполните в терминале:\nbrew install --cask --no-quarantine wine-stable'
        : 'To run this application on macOS, Wine is required.\n\nRun in terminal:\nbrew install --cask --no-quarantine wine-stable',
      openGuide: isRussian ? 'Открыть инструкцию' : 'Open Installation Guide',
      close: isRussian ? 'Закрыть' : 'Close'
    }
  }
}

/**
 * Possible Wine paths on macOS
 */
const WINE_PATHS = [
  // Homebrew Apple Silicon
  '/opt/homebrew/bin/wine64',
  '/opt/homebrew/bin/wine',
  // Homebrew Intel
  '/usr/local/bin/wine64',
  '/usr/local/bin/wine',
  // Wine Crossover (cask) - typically symlinked to Homebrew bin
  // but may also be in Caskroom
  '/opt/homebrew/Caskroom/wine-crossover/current/Wine Crossover.app/Contents/Resources/wine/bin/wine64',
  '/usr/local/Caskroom/wine-crossover/current/Wine Crossover.app/Contents/Resources/wine/bin/wine64',
  // Wine.app (Gcenx builds)
  '/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine64',
  '/Applications/Wine Stable.app/Contents/Resources/wine/bin/wine',
  '/Applications/Wine Crossover.app/Contents/Resources/wine/bin/wine64',
  '/Applications/Wine Crossover.app/Contents/Resources/wine/bin/wine',
  // CrossOver
  '/Applications/CrossOver.app/Contents/SharedSupport/CrossOver/bin/wine64'
]

/**
 * Find Wine path
 */
export function getWinePath(): string | null {
  // Check known paths
  for (const winePath of WINE_PATHS) {
    if (fs.existsSync(winePath)) {
      return winePath
    }
  }

  // Try via which
  try {
    const result = execSync('which wine64', { encoding: 'utf8' }).trim()
    if (result && fs.existsSync(result)) {
      return result
    }
  } catch {
    // wine64 not found
  }

  try {
    const result = execSync('which wine', { encoding: 'utf8' }).trim()
    if (result && fs.existsSync(result)) {
      return result
    }
  } catch {
    // wine not found
  }

  return null
}

/**
 * Check if Wine is installed
 */
export function isWineInstalled(): boolean {
  return getWinePath() !== null
}

/**
 * Get Wine version
 */
export function getWineVersion(): string | null {
  const winePath = getWinePath()
  if (!winePath) return null

  try {
    return execSync(`"${winePath}" --version`, { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}

/**
 * Check if Rosetta 2 is needed (Apple Silicon)
 */
export function isAppleSilicon(): boolean {
  return process.platform === 'darwin' && process.arch === 'arm64'
}

/**
 * Check if Rosetta 2 is installed
 */
export function isRosettaInstalled(): boolean {
  if (!isAppleSilicon()) return true

  try {
    // Check for Rosetta
    execSync('arch -x86_64 /usr/bin/true', { encoding: 'utf8' })
    return true
  } catch {
    return false
  }
}

/**
 * Show Wine installation dialog
 */
export async function showWineInstallDialog(): Promise<void> {
  const strings = getLocalizedStrings()
  const detail = isAppleSilicon()
    ? strings.wineDialog.detailAppleSilicon
    : strings.wineDialog.detailIntel

  const result = await dialog.showMessageBox({
    type: 'warning',
    title: strings.wineDialog.title,
    message: strings.wineDialog.message,
    detail: detail,
    buttons: [strings.wineDialog.openGuide, strings.wineDialog.close],
    defaultId: 0
  })

  if (result.response === 0) {
    shell.openExternal('https://wiki.winehq.org/MacOS')
  }
}

/**
 * Get Wine prefix path (single source of truth)
 */
export function getWinePrefix(): string {
  return path.join(process.env.HOME || '', '.wine-acestream')
}

/**
 * Initialize Wine prefix
 */
export async function initWinePrefix(): Promise<void> {
  const winePath = getWinePath()
  if (!winePath) {
    throw new Error('Wine not installed')
  }

  const winePrefix = getWinePrefix()

  // Create directory if it doesn't exist
  if (!fs.existsSync(winePrefix)) {
    fs.mkdirSync(winePrefix, { recursive: true })
  }

  // Initialize prefix
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process')
    
    const proc = spawn(winePath, ['wineboot', '--init'], {
      env: {
        ...process.env,
        WINEPREFIX: winePrefix,
        WINEDEBUG: '-all'
      },
      stdio: 'inherit'
    })

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`wineboot failed with code ${code}`))
      }
    })

    proc.on('error', reject)
  })
}

/**
 * Get Wine info for UI
 */
export function getWineInfo(): {
  installed: boolean
  version: string | null
  path: string | null
  appleSilicon: boolean
  rosettaInstalled: boolean
} {
  return {
    installed: isWineInstalled(),
    version: getWineVersion(),
    path: getWinePath(),
    appleSilicon: isAppleSilicon(),
    rosettaInstalled: isRosettaInstalled()
  }
}
