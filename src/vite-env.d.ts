/// <reference types="vite/client" />

interface Window {
  electron?: {
    ipcRenderer: {
      on: (channel: string, listener: (...args: any[]) => void) => void
      removeListener: (channel: string, listener: (...args: any[]) => void) => void
    }
  }
  electronAPI: {
    engine: {
      start: () => Promise<{ success: boolean; error?: string }>
      stop: () => Promise<{ success: boolean }>
      getStatus: () => Promise<{
        running: boolean
        version?: string
        platform?: string
        error?: string
      }>
      exists: () => Promise<boolean>
    }
    acestream: {
      play: (contentId: string) => Promise<{
        success: boolean
        error?: string
        session?: {
          playbackUrl: string
          statUrl: string
          commandUrl: string
          eventUrl: string
          infoHash: string
          sessionId: string
          isLive: boolean
        }
      }>
      getStats: (statUrl: string) => Promise<{
        status: string
        peers: number
        speedDown: number
        speedUp: number
        downloaded: number
        uploaded: number
        isLive: boolean
      }>
      stop: (commandUrl: string) => Promise<{ success: boolean }>
    }
    wine: {
      getInfo: () => Promise<{
        applicable: boolean
        installed?: boolean
        version?: string | null
        path?: string | null
        appleSilicon?: boolean
        rosettaInstalled?: boolean
      }>
      showInstallDialog: () => Promise<void>
    }
    platform: {
      getInfo: () => Promise<{
        platform: string
        arch: string
        isMac: boolean
        isWindows: boolean
        isLinux: boolean
      }>
    }
    cache: {
      getSize: () => Promise<{
        success: boolean
        size: number
        path?: string
        error?: string
      }>
      clear: () => Promise<{ success: boolean; error?: string }>
    }
    installer: {
      checkAll: () => Promise<{
        applicable: boolean
        internet?: boolean
        rosetta?: boolean
        rosettaRequired?: boolean
        homebrew?: boolean
        wine?: boolean
        wineVersion?: string | null
        allReady?: boolean
      }>
      start: () => Promise<{ success: boolean; error?: string; homebrewWasAlreadyInstalled?: boolean }>
      continueWine: () => Promise<{ success: boolean; error?: string }>
      cancel: () => Promise<{ success: boolean }>
      checkHomebrew: () => Promise<{ installed: boolean }>
      onProgress: (callback: (progress: {
        step: 'checking' | 'rosetta' | 'homebrew' | 'wine' | 'complete' | 'error'
        percent: number
        messageKey: string
        messageParams?: Record<string, string>
        logKey?: string
        logParams?: Record<string, string>
        rawLog?: string
      }) => void) => () => void
    }
    onOpenUrl: (callback: (contentId: string) => void) => () => void
  }
}
