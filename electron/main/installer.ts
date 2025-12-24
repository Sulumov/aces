import { spawn, ChildProcess, execSync } from 'child_process'
import { BrowserWindow } from 'electron'
import fs from 'fs'
import https from 'https'
import http from 'http'
import { isWineInstalled, isRosettaInstalled, isAppleSilicon, getWineVersion } from './wine'

export interface InstallProgress {
  step: 'checking' | 'rosetta' | 'homebrew' | 'wine' | 'complete' | 'error'
  percent: number
  messageKey: string
  messageParams?: Record<string, string>
  logKey?: string
  logParams?: Record<string, string>
  // Raw log output from commands (not localized)
  rawLog?: string
}

export interface DependencyStatus {
  internet: boolean
  rosetta: boolean
  rosettaRequired: boolean
  homebrew: boolean
  wine: boolean
  wineVersion: string | null
  allReady: boolean
}

// Reference to current installation process for cancellation
let currentProcess: ChildProcess | null = null
let isCancelled = false

/**
 * Send progress update to renderer
 */
function sendProgress(win: BrowserWindow | null, progress: InstallProgress): void {
  if (win && !win.isDestroyed()) {
    win.webContents.send('install:progress', progress)
  }
}

/**
 * Check internet connectivity
 */
export function checkInternet(): Promise<boolean> {
  return new Promise((resolve) => {
    const options = {
      hostname: 'www.google.com',
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 5000
    }

    const req = https.request(options, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302)
    })

    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })

    req.end()
  })
}

/**
 * Check if Homebrew is installed
 */
export function isHomebrewInstalled(): boolean {
  const paths = [
    '/opt/homebrew/bin/brew', // Apple Silicon
    '/usr/local/bin/brew'     // Intel
  ]
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return true
    }
  }
  
  return false
}

/**
 * Get Homebrew path
 */
export function getHomebrewPath(): string | null {
  const paths = [
    '/opt/homebrew/bin/brew', // Apple Silicon
    '/usr/local/bin/brew'     // Intel
  ]
  
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return p
    }
  }
  
  return null
}

/**
 * Check all dependencies status
 */
export async function checkAllDependencies(): Promise<DependencyStatus> {
  const internet = await checkInternet()
  const rosettaRequired = isAppleSilicon()
  const rosetta = rosettaRequired ? isRosettaInstalled() : true
  const homebrew = isHomebrewInstalled()
  const wine = isWineInstalled()
  const wineVersion = wine ? getWineVersion() : null
  
  return {
    internet,
    rosetta,
    rosettaRequired,
    homebrew,
    wine,
    wineVersion,
    allReady: rosetta && homebrew && wine
  }
}

/**
 * Install Rosetta 2 (Apple Silicon only)
 */
export async function installRosetta(win: BrowserWindow | null): Promise<boolean> {
  if (!isAppleSilicon()) {
    return true // Not needed
  }
  
  if (isRosettaInstalled()) {
    sendProgress(win, {
      step: 'rosetta',
      percent: 15,
      messageKey: 'install.rosettaAlreadyInstalled',
      logKey: 'install.log.rosettaAlreadyInstalled'
    })
    return true
  }

  return new Promise((resolve) => {
    sendProgress(win, {
      step: 'rosetta',
      percent: 5,
      messageKey: 'install.installingRosetta',
      logKey: 'install.log.installingRosetta'
    })

    currentProcess = spawn('softwareupdate', ['--install-rosetta', '--agree-to-license'], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    let output = ''

    currentProcess.stdout?.on('data', (data) => {
      const text = data.toString()
      output += text
      sendProgress(win, {
        step: 'rosetta',
        percent: 10,
        messageKey: 'install.installingRosetta',
        rawLog: text
      })
    })

    currentProcess.stderr?.on('data', (data) => {
      const text = data.toString()
      output += text
      sendProgress(win, {
        step: 'rosetta',
        percent: 10,
        messageKey: 'install.installingRosetta',
        rawLog: text
      })
    })

    currentProcess.on('close', (code) => {
      currentProcess = null
      if (isCancelled) {
        resolve(false)
        return
      }
      
      if (code === 0 || isRosettaInstalled()) {
        sendProgress(win, {
          step: 'rosetta',
          percent: 15,
          messageKey: 'install.rosettaInstalled',
          logKey: 'install.log.rosettaSuccess'
        })
        resolve(true)
      } else {
        sendProgress(win, {
          step: 'error',
          percent: 10,
          messageKey: 'install.rosettaFailed',
          logKey: 'install.log.rosettaFailed',
          logParams: { code: String(code), output }
        })
        resolve(false)
      }
    })

    currentProcess.on('error', (err) => {
      currentProcess = null
      sendProgress(win, {
        step: 'error',
        percent: 10,
        messageKey: 'install.rosettaFailed',
        logKey: 'install.log.error',
        logParams: { message: err.message }
      })
      resolve(false)
    })
  })
}

/**
 * Install Homebrew
 * Note: This requires user password, so we open Terminal
 */
export async function installHomebrew(win: BrowserWindow | null): Promise<boolean> {
  if (isHomebrewInstalled()) {
    sendProgress(win, {
      step: 'homebrew',
      percent: 35,
      messageKey: 'install.homebrewAlreadyInstalled',
      logKey: 'install.log.homebrewAlreadyInstalled'
    })
    return true
  }

  return new Promise((resolve) => {
    sendProgress(win, {
      step: 'homebrew',
      percent: 15,
      messageKey: 'install.installingHomebrew',
      logKey: 'install.log.installingHomebrew'
    })

    // Open Terminal with Homebrew install script
    const script = `
      tell application "Terminal"
        activate
        do script "/bin/bash -c \\"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\\""
      end tell
    `

    currentProcess = spawn('osascript', ['-e', script], {
      stdio: ['ignore', 'pipe', 'pipe']
    })

    currentProcess.on('close', () => {
      currentProcess = null
      
      sendProgress(win, {
        step: 'homebrew',
        percent: 20,
        messageKey: 'install.waitingHomebrew',
        logKey: 'install.log.terminalOpened'
      })
      
      // We can't automatically detect when Homebrew is installed in Terminal
      // The UI will have a "Check & Continue" button
      resolve(true)
    })

    currentProcess.on('error', (err) => {
      currentProcess = null
      sendProgress(win, {
        step: 'error',
        percent: 15,
        messageKey: 'install.terminalFailed',
        logKey: 'install.log.error',
        logParams: { message: err.message }
      })
      resolve(false)
    })
  })
}

/**
 * Install Wine via Homebrew
 */
export async function installWine(win: BrowserWindow | null): Promise<boolean> {
  if (isWineInstalled()) {
    const version = getWineVersion()
    sendProgress(win, {
      step: 'wine',
      percent: 100,
      messageKey: 'install.wineInstalled',
      messageParams: { version: version || 'unknown' },
      logKey: 'install.log.wineAlreadyInstalled',
      logParams: { version: version || 'unknown' }
    })
    return true
  }

  const brewPath = getHomebrewPath()
  if (!brewPath) {
    sendProgress(win, {
      step: 'error',
      percent: 35,
      messageKey: 'install.homebrewNotFound',
      logKey: 'install.log.homebrewRequired'
    })
    return false
  }

  return new Promise((resolve) => {
    sendProgress(win, {
      step: 'wine',
      percent: 35,
      messageKey: 'install.addingWineRepo',
      logKey: 'install.log.addingWineTap'
    })

    // First, add the tap
    const tapProcess = spawn(brewPath, ['tap', 'gcenx/wine'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        HOMEBREW_NO_AUTO_UPDATE: '1'
      }
    })

    let tapOutput = ''

    tapProcess.stdout?.on('data', (data) => {
      tapOutput += data.toString()
      sendProgress(win, {
        step: 'wine',
        percent: 40,
        messageKey: 'install.addingWineRepo',
        rawLog: data.toString()
      })
    })

    tapProcess.stderr?.on('data', (data) => {
      tapOutput += data.toString()
      sendProgress(win, {
        step: 'wine',
        percent: 40,
        messageKey: 'install.addingWineRepo',
        rawLog: data.toString()
      })
    })

    tapProcess.on('close', (tapCode) => {
      if (isCancelled) {
        resolve(false)
        return
      }

      if (tapCode !== 0 && !tapOutput.includes('already tapped')) {
        sendProgress(win, {
          step: 'error',
          percent: 40,
          messageKey: 'install.wineRepoFailed',
          logKey: 'install.log.tapFailed',
          logParams: { code: String(tapCode) }
        })
        resolve(false)
        return
      }

      sendProgress(win, {
        step: 'wine',
        percent: 45,
        messageKey: 'install.installingWine',
        logKey: 'install.log.installingWine'
      })

      // Install wine-crossover with --no-quarantine to avoid Gatekeeper issues
      currentProcess = spawn(brewPath, ['install', '--cask', '--no-quarantine', 'wine-crossover'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          HOMEBREW_NO_AUTO_UPDATE: '1'
        }
      })

      let progressPercent = 45

      currentProcess.stdout?.on('data', (data) => {
        const text = data.toString()
        // Increment progress slowly
        if (progressPercent < 95) {
          progressPercent += 1
        }
        sendProgress(win, {
          step: 'wine',
          percent: progressPercent,
          messageKey: 'install.installingWineShort',
          rawLog: text
        })
      })

      currentProcess.stderr?.on('data', (data) => {
        const text = data.toString()
        sendProgress(win, {
          step: 'wine',
          percent: progressPercent,
          messageKey: 'install.installingWineShort',
          rawLog: text
        })
      })

      currentProcess.on('close', (code) => {
        currentProcess = null
        
        if (isCancelled) {
          resolve(false)
          return
        }

        if (code === 0 && isWineInstalled()) {
          const version = getWineVersion()
          sendProgress(win, {
            step: 'complete',
            percent: 100,
            messageKey: 'install.complete',
            logKey: 'install.log.wineSuccess',
            logParams: { version: version || 'unknown' }
          })
          resolve(true)
        } else {
          sendProgress(win, {
            step: 'error',
            percent: progressPercent,
            messageKey: 'install.wineFailed',
            logKey: 'install.log.wineFailed',
            logParams: { code: String(code) }
          })
          resolve(false)
        }
      })

      currentProcess.on('error', (err) => {
        currentProcess = null
        sendProgress(win, {
          step: 'error',
          percent: progressPercent,
          messageKey: 'install.wineFailed',
          logKey: 'install.log.error',
          logParams: { message: err.message }
        })
        resolve(false)
      })
    })

    tapProcess.on('error', (err) => {
      sendProgress(win, {
        step: 'error',
        percent: 35,
        messageKey: 'install.wineRepoFailed',
        logKey: 'install.log.error',
        logParams: { message: err.message }
      })
      resolve(false)
    })
  })
}

export interface InstallationResult {
  success: boolean
  homebrewWasAlreadyInstalled: boolean
}

/**
 * Run full installation sequence
 */
export async function runFullInstallation(win: BrowserWindow | null): Promise<InstallationResult> {
  isCancelled = false

  // Check internet first
  sendProgress(win, {
    step: 'checking',
    percent: 0,
    messageKey: 'install.checkingInternet',
    logKey: 'install.log.checkingInternet'
  })

  const hasInternet = await checkInternet()
  if (!hasInternet) {
    sendProgress(win, {
      step: 'error',
      percent: 0,
      messageKey: 'install.noInternet',
      logKey: 'install.log.noInternet'
    })
    return { success: false, homebrewWasAlreadyInstalled: false }
  }

  sendProgress(win, {
    step: 'checking',
    percent: 2,
    messageKey: 'install.internetOk',
    logKey: 'install.log.internetOk'
  })

  if (isCancelled) return { success: false, homebrewWasAlreadyInstalled: false }

  // Step 1: Rosetta (Apple Silicon only)
  if (isAppleSilicon()) {
    const rosettaOk = await installRosetta(win)
    if (!rosettaOk || isCancelled) return { success: false, homebrewWasAlreadyInstalled: false }
  }

  // Check if Homebrew was already installed before proceeding
  const homebrewWasAlreadyInstalled = isHomebrewInstalled()

  // Step 2: Homebrew
  const homebrewOk = await installHomebrew(win)
  if (!homebrewOk || isCancelled) return { success: false, homebrewWasAlreadyInstalled }

  // Note: After Homebrew, user needs to complete installation in Terminal (if not already installed)
  // The UI will show a "Check & Continue" button
  
  return { success: true, homebrewWasAlreadyInstalled }
}

/**
 * Continue installation after Homebrew (Wine)
 */
export async function continueWithWine(win: BrowserWindow | null): Promise<boolean> {
  isCancelled = false
  
  // Check if Homebrew is now installed
  if (!isHomebrewInstalled()) {
    sendProgress(win, {
      step: 'error',
      percent: 35,
      messageKey: 'install.homebrewNotInstalled',
      logKey: 'install.log.homebrewNotInstalled'
    })
    return false
  }

  sendProgress(win, {
    step: 'homebrew',
    percent: 35,
    messageKey: 'install.homebrewVerified',
    logKey: 'install.log.homebrewVerified'
  })

  if (isCancelled) return false

  // Step 3: Wine
  const wineOk = await installWine(win)
  return wineOk
}

/**
 * Cancel current installation
 */
export function cancelInstallation(): void {
  isCancelled = true
  if (currentProcess) {
    currentProcess.kill('SIGTERM')
    currentProcess = null
  }
}

/**
 * Reset cancellation flag
 */
export function resetCancellation(): void {
  isCancelled = false
}
