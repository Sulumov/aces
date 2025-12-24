/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { contextBridge, ipcRenderer } from 'electron'

// Types for the API
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

export interface WineInfo {
  applicable: boolean
  installed?: boolean
  version?: string | null
  path?: string | null
  appleSilicon?: boolean
  rosettaInstalled?: boolean
}

export interface PlatformInfo {
  platform: string
  arch: string
  isMac: boolean
  isWindows: boolean
  isLinux: boolean
}

export interface ApiResult<T = void> {
  success: boolean
  error?: string
  session?: T
}

export interface CacheInfo {
  success: boolean
  size: number
  path?: string
  error?: string
}

export interface InstallStatus {
  applicable: boolean
  internet?: boolean
  rosetta?: boolean
  rosettaRequired?: boolean
  homebrew?: boolean
  wine?: boolean
  wineVersion?: string | null
  allReady?: boolean
}

export interface InstallProgress {
  step: 'checking' | 'rosetta' | 'homebrew' | 'wine' | 'complete' | 'error'
  percent: number
  messageKey: string
  messageParams?: Record<string, string>
  logKey?: string
  logParams?: Record<string, string>
  rawLog?: string
}

// Expose API to renderer
const api = {
  // Engine methods
  engine: {
    start: (): Promise<ApiResult> => ipcRenderer.invoke('engine:start'),
    stop: (): Promise<ApiResult> => ipcRenderer.invoke('engine:stop'),
    getStatus: (): Promise<EngineStatus> => ipcRenderer.invoke('engine:status'),
    exists: (): Promise<boolean> => ipcRenderer.invoke('engine:exists')
  },

  // Ace Stream playback methods
  acestream: {
    play: (contentId: string): Promise<ApiResult<PlaybackSession>> => 
      ipcRenderer.invoke('acestream:play', contentId),
    getStats: (statUrl: string): Promise<StreamStats> => 
      ipcRenderer.invoke('acestream:stats', statUrl),
    stop: (commandUrl: string): Promise<ApiResult> => 
      ipcRenderer.invoke('acestream:stop', commandUrl)
  },

  // Wine methods (macOS)
  wine: {
    getInfo: (): Promise<WineInfo> => ipcRenderer.invoke('wine:info'),
    showInstallDialog: (): Promise<void> => ipcRenderer.invoke('wine:showInstallDialog')
  },

  // Platform info
  platform: {
    getInfo: (): Promise<PlatformInfo> => ipcRenderer.invoke('platform:info')
  },

  // Cache management
  cache: {
    getSize: (): Promise<CacheInfo> => ipcRenderer.invoke('cache:getSize'),
    clear: (): Promise<ApiResult> => ipcRenderer.invoke('cache:clear')
  },

  // Installer methods (macOS)
  installer: {
    checkAll: (): Promise<InstallStatus> => ipcRenderer.invoke('install:checkAll'),
    start: (): Promise<ApiResult & { homebrewWasAlreadyInstalled?: boolean }> => ipcRenderer.invoke('install:start'),
    continueWine: (): Promise<ApiResult> => ipcRenderer.invoke('install:continueWine'),
    cancel: (): Promise<ApiResult> => ipcRenderer.invoke('install:cancel'),
    checkHomebrew: (): Promise<{ installed: boolean }> => ipcRenderer.invoke('install:checkHomebrew'),
    onProgress: (callback: (progress: InstallProgress) => void) => {
      const handler = (_event: any, progress: InstallProgress) => callback(progress)
      ipcRenderer.on('install:progress', handler)
      return () => ipcRenderer.removeListener('install:progress', handler)
    }
  },

  // Protocol URL handling
  onOpenUrl: (callback: (contentId: string) => void) => {
    const handler = (_event: any, contentId: string) => callback(contentId)
    ipcRenderer.on('acestream:open-url', handler)
    // Return cleanup function
    return () => ipcRenderer.removeListener('acestream:open-url', handler)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Type declaration for renderer
declare global {
  interface Window {
    electronAPI: typeof api
  }
}
