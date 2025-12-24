/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { spawn, ChildProcess, execSync, exec } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import axios from 'axios'
import { getWinePath, isWineInstalled, getWinePrefix } from './wine'

const ENGINE_API_URL = 'http://127.0.0.1:6878'
const ENGINE_START_TIMEOUT = 30000

export interface EngineStatus {
  running: boolean
  version?: string
  platform?: string
  error?: string
}

export interface PlaybackSession {
  playbackUrl: string
  statUrl: string
  commandUrl: string
  eventUrl: string
  infoHash: string
  sessionId: string
  isLive: boolean
}

export interface StreamStats {
  status: string
  peers: number
  speedDown: number
  speedUp: number
  downloaded: number
  uploaded: number
  isLive: boolean
}

class EngineManager {
  private engineProcess: ChildProcess | null = null
  private isStarting: boolean = false
  private startPromise: Promise<void> | null = null

  constructor() {
    // Clean up stale processes from previous sessions on manager creation
    if (process.platform === 'darwin') {
      this.cleanupStaleWineProcesses()
    }
  }

  /**
   * Synchronous cleanup of stale Wine processes on startup
   */
  private cleanupStaleWineProcesses(): void {
    try {
      const winePrefix = getWinePrefix()
      
      // Kill wineserver for our prefix
      try {
        execSync(`WINEPREFIX="${winePrefix}" wineserver -k 2>/dev/null || true`, { 
          stdio: 'ignore',
          timeout: 5000 
        })
      } catch (e) {
        // Ignore errors
      }
      
      // Kill ace_console.exe processes via Wine
      try {
        execSync('pkill -9 -f "ace_console.exe" 2>/dev/null || true', { 
          stdio: 'ignore',
          timeout: 5000 
        })
      } catch (e) {
        // Processes not found
      }
      
      // Kill wine-preloader processes related to our path
      try {
        execSync(`pkill -9 -f ".wine-acestream" 2>/dev/null || true`, { 
          stdio: 'ignore',
          timeout: 5000 
        })
      } catch (e) {
        // Processes not found
      }
      
      console.log('Cleaned up stale Wine processes')
    } catch (e) {
      console.error('Error during Wine cleanup:', e)
    }
  }

  /**
   * Get Engine directory path
   */
  getEnginePath(): string {
    const isDev = !app.isPackaged

    if (isDev) {
      // Development mode
      const platformFolder = this.getPlatformFolder()
      return path.join(process.cwd(), 'engine', platformFolder)
    } else {
      // Production
      return path.join(process.resourcesPath, 'engine')
    }
  }

  /**
   * Get platform folder name
   */
  private getPlatformFolder(): string {
    switch (process.platform) {
      case 'win32':
        return 'win'
      case 'linux':
        return 'linux'
      case 'darwin':
        return 'win' // On macOS we use Windows version via Wine
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }
  }

  /**
   * Get Engine executable path
   */
  getEngineExecutable(): string {
    const enginePath = this.getEnginePath()

    switch (process.platform) {
      case 'win32':
        return path.join(enginePath, 'ace_console.exe')
      case 'linux':
        return path.join(enginePath, 'start-engine')
      case 'darwin':
        // On macOS return path to Windows exe (will be run via Wine)
        return path.join(enginePath, 'ace_console.exe')
      default:
        throw new Error(`Unsupported platform: ${process.platform}`)
    }
  }

  /**
   * Check if Engine exists
   */
  engineExists(): boolean {
    try {
      const execPath = this.getEngineExecutable()
      return fs.existsSync(execPath)
    } catch {
      return false
    }
  }

  /**
   * Start Ace Stream Engine
   */
  async start(): Promise<void> {
    // If already starting - return existing Promise
    if (this.startPromise) {
      return this.startPromise
    }

    // Check if Engine is already running
    const status = await this.getStatus()
    if (status.running) {
      console.log('Engine already running')
      return
    }

    // Create and save startup Promise
    this.startPromise = this._doStart()
    
    try {
      await this.startPromise
    } finally {
      this.startPromise = null
    }
  }

  /**
   * Internal Engine startup method
   */
  private async _doStart(): Promise<void> {
    this.isStarting = true

    try {
      const executable = this.getEngineExecutable()
      const enginePath = this.getEnginePath()

      if (!fs.existsSync(executable)) {
        throw new Error(`Engine executable not found: ${executable}`)
      }

      const args = [
        '--client-console',
        '--http-port', '6878',
        '--log-stdout',
        '--log-stdout-level', 'info'
      ]

      let spawnCommand: string
      let spawnArgs: string[]

      if (process.platform === 'darwin') {
        // macOS: start via Wine
        const winePath = getWinePath()
        if (!winePath) {
          throw new Error('Wine not installed. Please install Wine Crossover: brew tap gcenx/wine && brew install --cask wine-crossover')
        }
        spawnCommand = winePath
        spawnArgs = [executable, ...args]
      } else {
        spawnCommand = executable
        spawnArgs = args
      }

      console.log(`Starting Engine: ${spawnCommand} ${spawnArgs.join(' ')}`)

      const env: NodeJS.ProcessEnv = {
        ...process.env
      }

      // Add Wine environment variables for macOS
      if (process.platform === 'darwin') {
        // Use separate Wine prefix for Ace Stream
        env.WINEPREFIX = getWinePrefix()
        env.WINEDEBUG = '-all'
        env.WINEDLLOVERRIDES = 'winemenubuilder.exe=d'
      }

      this.engineProcess = spawn(spawnCommand, spawnArgs, {
        cwd: enginePath,
        env,
        stdio: ['ignore', 'pipe', 'pipe']
      })

      this.engineProcess.stdout?.on('data', (data) => {
        console.log(`[Engine]: ${data.toString().trim()}`)
      })

      this.engineProcess.stderr?.on('data', (data) => {
        console.error(`[Engine Error]: ${data.toString().trim()}`)
      })

      this.engineProcess.on('close', (code) => {
        console.log(`Engine process exited with code ${code}`)
        this.engineProcess = null
      })

      this.engineProcess.on('error', (err) => {
        console.error('Engine process error:', err)
        this.engineProcess = null
      })

      // Wait for Engine to be ready
      await this.waitForEngine()

    } finally {
      this.isStarting = false
    }
  }

  /**
   * Wait for Engine to be ready
   */
  private async waitForEngine(): Promise<void> {
    const startTime = Date.now()

    while (Date.now() - startTime < ENGINE_START_TIMEOUT) {
      try {
        const response = await axios.get(`${ENGINE_API_URL}/webui/api/service?method=get_version`, {
          timeout: 2000
        })
        if (response.data?.result?.version) {
          console.log(`Ace Stream Engine ${response.data.result.version} is ready`)
          return
        }
      } catch {
        // Engine not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    throw new Error('Engine startup timeout')
  }

  /**
   * Wait for engine startup to complete (if already starting)
   */
  private async waitForStartupComplete(): Promise<void> {
    const startTime = Date.now()
    while (this.isStarting && Date.now() - startTime < ENGINE_START_TIMEOUT) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  /**
   * Ensure engine is running and ready
   */
  async ensureRunning(): Promise<void> {
    // If already starting - wait for completion
    if (this.isStarting) {
      console.log('Engine is starting, waiting...')
      await this.waitForStartupComplete()
    }

    // Check status
    const status = await this.getStatus()
    if (status.running) {
      return // Already running
    }

    // Not running - start
    await this.start()
  }

  /**
   * Stop Engine
   */
  stop(): void {
    if (this.engineProcess) {
      console.log('Stopping Engine...')
      
      const pid = this.engineProcess.pid
      
      if (pid) {
        // Kill entire process tree
        this.killProcessTree(pid)
      } else {
        this.engineProcess.kill()
      }
      
      this.engineProcess = null
    }
    
    // Additionally: kill all ace_console processes on macOS/Linux
    if (process.platform !== 'win32') {
      this.killAceStreamProcesses()
    }
    
    // On macOS: forcefully terminate wineserver
    if (process.platform === 'darwin') {
      this.forceKillWineServer()
    }
  }

  /**
   * Force kill wineserver
   */
  private forceKillWineServer(): void {
    try {
      const winePrefix = getWinePrefix()
      
      // Send command for immediate wineserver termination
      execSync(`WINEPREFIX="${winePrefix}" wineserver -k 2>/dev/null || true`, { 
        stdio: 'ignore',
        timeout: 3000 
      })
      
      // Small delay for completion
      setTimeout(() => {
        try {
          // If wineserver is still running - kill forcefully
          execSync(`WINEPREFIX="${winePrefix}" wineserver -k9 2>/dev/null || true`, { 
            stdio: 'ignore',
            timeout: 2000 
          })
        } catch (e) {
          // Ignore
        }
      }, 500)
      
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Kill process tree by PID
   */
  private killProcessTree(pid: number): void {
    try {
      if (process.platform === 'win32') {
        // Windows: taskkill with /T for process tree
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: 'ignore' })
      } else {
        // macOS/Linux: get all child processes and kill them
        try {
          // First get all child processes
          const childPids = this.getChildProcesses(pid)
          
          // Kill child processes
          for (const childPid of childPids) {
            try {
              process.kill(childPid, 'SIGKILL')
            } catch (e) {
              // Process already terminated
            }
          }
        } catch (e) {
          // Failed to get child processes
        }
        
        // Kill parent process
        try {
          process.kill(pid, 'SIGKILL')
        } catch (e) {
          // Process already terminated
        }
      }
    } catch (error) {
      console.error('Error killing process tree:', error)
    }
  }

  /**
   * Get list of child processes
   */
  private getChildProcesses(parentPid: number): number[] {
    const pids: number[] = []
    
    try {
      if (process.platform === 'darwin') {
        // macOS: use pgrep
        const output = execSync(`pgrep -P ${parentPid}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const lines = output.trim().split('\n').filter(l => l)
        for (const line of lines) {
          const pid = parseInt(line, 10)
          if (!isNaN(pid)) {
            pids.push(pid)
            // Recursively get child processes
            pids.push(...this.getChildProcesses(pid))
          }
        }
      } else if (process.platform === 'linux') {
        // Linux: use ps
        const output = execSync(`ps --ppid ${parentPid} -o pid=`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        const lines = output.trim().split('\n').filter(l => l)
        for (const line of lines) {
          const pid = parseInt(line.trim(), 10)
          if (!isNaN(pid)) {
            pids.push(pid)
            pids.push(...this.getChildProcesses(pid))
          }
        }
      }
    } catch (e) {
      // No child processes or error
    }
    
    return pids
  }

  /**
   * Kill all Ace Stream processes (fallback)
   */
  private killAceStreamProcesses(): void {
    try {
      if (process.platform === 'darwin') {
        // macOS: kill ONLY processes related to our application
        // Use exact patterns to not affect other Wine applications
        
        // Kill ace_console.exe (unique to our application)
        exec('pkill -9 -f "ace_console.exe"', () => {})
        exec('pkill -9 -f "acestreamengine"', () => {})
        
        // Kill processes ONLY with our WINEPREFIX in command line
        const winePrefix = getWinePrefix()
        
        // Terminate wineserver only for our prefix
        // This is safe - each WINEPREFIX has its own wineserver
        exec(`WINEPREFIX="${winePrefix}" wineserver -k 2>/dev/null`, () => {})
        
        // Clean up wine-preloader processes related ONLY to our path
        this.cleanupOurWineProcesses(winePrefix)
      } else if (process.platform === 'linux') {
        exec('pkill -9 -f "ace_console"', () => {})
        exec('pkill -9 -f "acestreamengine"', () => {})
      }
    } catch (e) {
      // Processes not found or already terminated
    }
  }

  /**
   * Cleanup Wine processes related ONLY to our application
   * Does not affect other Wine applications
   */
  private cleanupOurWineProcesses(winePrefix: string): void {
    try {
      // Search for processes with our WINEPREFIX or ace_console in command line
      // This ensures we don't kill other Wine processes
      
      const safePatterns = [
        'ace_console',           // Our executable file
        '.wine-acestream',       // Our WINEPREFIX
        'acestream'              // Any acestream processes
      ]
      
      for (const pattern of safePatterns) {
        // Use pgrep for safe search by command line
        exec(`pgrep -f "${pattern}" 2>/dev/null`, (error, stdout) => {
          if (error || !stdout.trim()) return
          
          const pids = stdout.trim().split('\n').filter(pid => pid)
          for (const pidStr of pids) {
            const pid = parseInt(pidStr, 10)
            if (!isNaN(pid)) {
              try {
                process.kill(pid, 'SIGKILL')
              } catch (e) {
                // Process already terminated
              }
            }
          }
        })
      }
      
    } catch (e) {
      console.error('Error cleaning up Wine processes:', e)
    }
  }

  /**
   * Get Engine status
   */
  async getStatus(): Promise<EngineStatus> {
    try {
      const response = await axios.get(`${ENGINE_API_URL}/webui/api/service?method=get_version`, {
        timeout: 2000
      })
      
      if (response.data?.result) {
        return {
          running: true,
          version: response.data.result.version,
          platform: response.data.result.platform
        }
      }
      
      return { running: false }
    } catch {
      return { running: false }
    }
  }

  /**
   * Start stream playback
   */
  async startPlayback(contentId: string): Promise<PlaybackSession> {
    // Ensure engine is running
    await this.ensureRunning()
    
    // Remove acestream:// prefix if present
    const cleanId = contentId.replace('acestream://', '')

    try {
      const response = await axios.get(`${ENGINE_API_URL}/ace/manifest.m3u8`, {
        params: {
          content_id: cleanId,
          format: 'json'
        },
        timeout: 30000
      })

      const result = response.data?.response
      if (!result) {
        throw new Error('Invalid response from Engine')
      }

      return {
        playbackUrl: result.playback_url,
        statUrl: result.stat_url,
        commandUrl: result.command_url,
        eventUrl: result.event_url,
        infoHash: result.infohash,
        sessionId: result.playback_session_id,
        isLive: result.is_live === 1
      }
    } catch (error: any) {
      if (error.response?.data?.error) {
        throw new Error(error.response.data.error)
      }
      throw error
    }
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(statUrl: string): Promise<StreamStats> {
    try {
      const response = await axios.get(statUrl, { timeout: 5000 })
      const result = response.data?.response

      // API returns speed_down/speed_up in KB/s, convert to bytes/s
      return {
        status: result?.status || 'unknown',
        peers: result?.peers || 0,
        speedDown: (result?.speed_down || 0) * 1024,
        speedUp: (result?.speed_up || 0) * 1024,
        downloaded: result?.downloaded || 0,
        uploaded: result?.uploaded || 0,
        isLive: result?.is_live === 1
      }
    } catch {
      return {
        status: 'error',
        peers: 0,
        speedDown: 0,
        speedUp: 0,
        downloaded: 0,
        uploaded: 0,
        isLive: false
      }
    }
  }

  /**
   * Stop playback
   */
  async stopPlayback(commandUrl: string): Promise<void> {
    try {
      await axios.get(`${commandUrl}?method=stop`, { timeout: 5000 })
    } catch (error) {
      console.error('Failed to stop playback:', error)
    }
  }
}

export const engineManager = new EngineManager()
