/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Player from './components/Player'
import Stats from './components/Stats'
import SetupWizard from './components/SetupWizard'
import WineInstallDialog from './components/WineInstallDialog'
import SettingsPage from './components/SettingsPage'
import History, { HistoryEntry } from './components/History'
import Bookmarks, { BookmarkEntry } from './components/Bookmarks'

const HISTORY_KEY = 'playbackHistory'
const BOOKMARKS_KEY = 'bookmarks'
const HISTORY_MAX_ITEMS = 200 // Limit history to prevent localStorage overflow

/**
 * Safe localStorage wrapper with error handling
 */
function safeLocalStorageSet(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.error(`Failed to save to localStorage (${key}):`, error)
    // Possible QuotaExceededError - try to clear old data
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, clearing old history entries')
      try {
        // Try to clear old history entries
        const history = localStorage.getItem(HISTORY_KEY)
        if (history) {
          const items = JSON.parse(history)
          if (Array.isArray(items) && items.length > 50) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 50)))
          }
        }
      } catch {
        // Ignore cleanup errors
      }
    }
    return false
  }
}

interface PlaybackSession {
  playbackUrl: string
  statUrl: string
  commandUrl: string
  infoHash: string
  isLive: boolean
  contentId: string
  streamName: string
}

interface StreamStats {
  status: string
  peers: number
  speedDown: number
  speedUp: number
  downloaded: number
  uploaded: number
  isLive: boolean
}

// Tab icons as SVG components
const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
)

const HistoryIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const SettingsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const BookmarkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
)

// Header with tabs navigation
interface HeaderProps {
  currentContentId: string | null
  bookmarkName: string | null
}

function Header({ currentContentId, bookmarkName }: HeaderProps) {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()

  const tabs = [
    { path: '/', icon: <PlayIcon /> },
    { path: '/history', icon: <HistoryIcon /> },
    { path: '/bookmarks', icon: <BookmarkIcon /> },
    { path: '/settings', icon: <SettingsIcon /> },
  ]

  // Show bookmark name only if there's an active stream from a bookmark
  const showBookmarkName = location.pathname === '/' && currentContentId && bookmarkName

  return (
    <header className="header">
      <h1>{t('app.title')}</h1>
      <p className="subtitle">{t('app.subtitle')}</p>
      {showBookmarkName && (
        <span className="header-stream-name">{bookmarkName}</span>
      )}
      <nav className="header-tabs">
        {tabs.map(tab => (
          <button
            key={tab.path}
            className={`tab ${location.pathname === tab.path ? 'active' : ''}`}
            onClick={() => navigate(tab.path)}
            title={tab.path === '/' ? t('tabs.main') : tab.path === '/history' ? t('tabs.history') : tab.path === '/bookmarks' ? t('tabs.bookmarks') : t('tabs.settings')}
          >
            <span className="tab-icon">{tab.icon}</span>
          </button>
        ))}
      </nav>
    </header>
  )
}

// Main page component
function MainPage({
  error,
  onDismissError
}: {
  error: string | null
  onDismissError: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {error && (
        <div className="error-toast">
          <p>{error}</p>
          <button onClick={onDismissError}>{t('common.dismiss')}</button>
        </div>
      )}
    </>
  )
}

function AppContent() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [engineRunning, setEngineRunning] = useState(false)
  const [engineVersion, setEngineVersion] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentSession, setCurrentSession] = useState<PlaybackSession | null>(null)
  const [stats, setStats] = useState<StreamStats | null>(null)
  const [showWineDialog, setShowWineDialog] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)
  const [autoFocusAddStream, setAutoFocusAddStream] = useState(false)
  const [showStats, setShowStats] = useState(() => {
    return localStorage.getItem('showStats') !== 'false'
  })
  const [autoResume, setAutoResume] = useState(() => {
    return localStorage.getItem('autoResume') === 'true'
  })
  const [historyItems, setHistoryItems] = useState<HistoryEntry[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [bookmarkItems, setBookmarkItems] = useState<BookmarkEntry[]>(() => {
    try {
      const saved = localStorage.getItem(BOOKMARKS_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null)
  const activeStartTimeRef = useRef<number | null>(null)
  const engineStartedRef = useRef(false)
  const autoResumeAttemptedRef = useRef(false)
  const [retryCount, setRetryCount] = useState(0)
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isRetryingRef = useRef(false)
  const MAX_RETRIES = 5
  const RETRY_INTERVALS = [3000, 5000, 10000, 15000, 30000] // Increasing intervals

  // Listen for menu navigate-to-settings event
  useEffect(() => {
    const handleNavigateToSettings = () => {
      navigate('/settings')
    }

    const handleNavigateToHistory = () => {
      navigate('/history')
    }

    // Check if ipcRenderer is available
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.on('navigate-to-settings', handleNavigateToSettings)
      window.electron.ipcRenderer.on('navigate-to-history', handleNavigateToHistory)
      
      return () => {
        window.electron?.ipcRenderer?.removeListener('navigate-to-settings', handleNavigateToSettings)
        window.electron?.ipcRenderer?.removeListener('navigate-to-history', handleNavigateToHistory)
      }
    }
  }, [navigate])

  // Check platform and start engine on mount
  useEffect(() => {
    const init = async () => {
      const platformInfo = await window.electronAPI.platform.getInfo()

      // Check if dependencies are needed (macOS)
      if (platformInfo.isMac) {
        const installStatus = await window.electronAPI.installer.checkAll()
        if (installStatus.applicable && !installStatus.allReady) {
          setShowSetupWizard(true)
          return
        }
      }

      // Check engine status
      await checkEngineStatus()

      // Auto-start engine if not running
      if (!engineStartedRef.current) {
        engineStartedRef.current = true
        const status = await window.electronAPI.engine.getStatus()
        if (!status.running) {
          try {
            await window.electronAPI.engine.start()
            await checkEngineStatus()
          } catch (err) {
            console.error('Failed to auto-start engine:', err)
          }
        }
      }

      // Auto-resume last stream if enabled
      if (!autoResumeAttemptedRef.current) {
        autoResumeAttemptedRef.current = true
        const shouldAutoResume = localStorage.getItem('autoResume') === 'true'
        const lastStream = localStorage.getItem('lastStream')
        const lastStreamName = localStorage.getItem('lastStreamName')
        if (shouldAutoResume && lastStream) {
          try {
            // Small delay to ensure engine is ready
            setTimeout(() => {
              handlePlay(lastStream, lastStreamName || undefined)
            }, 1000)
          } catch (err) {
            console.error('Failed to auto-resume stream:', err)
          }
        }
      }
    }

    init()
  }, [])

  // Poll stats when playing and update duration
  useEffect(() => {
    if (!currentSession) {
      setStats(null)
      // Reset retry state when session ends
      setRetryCount(0)
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      isRetryingRef.current = false
      return
    }

    const interval = setInterval(async () => {
      const newStats = await window.electronAPI.acestream.getStats(currentSession.statUrl)
      setStats(newStats)
      
      // Check for error status and auto-retry
      if (newStats.status === 'error' && !isRetryingRef.current && retryCount < MAX_RETRIES) {
        isRetryingRef.current = true
        const retryDelay = RETRY_INTERVALS[Math.min(retryCount, RETRY_INTERVALS.length - 1)]
        
        console.log(`Stream error detected. Retry ${retryCount + 1}/${MAX_RETRIES} in ${retryDelay/1000}s...`)
        
        retryTimeoutRef.current = setTimeout(async () => {
          try {
            // Stop current session first
            await window.electronAPI.acestream.stop(currentSession.commandUrl)
            
            // Restart playback with same content
            const result = await window.electronAPI.acestream.play(currentSession.contentId)
            if (result.success && result.session) {
              setCurrentSession({
                playbackUrl: result.session.playbackUrl,
                statUrl: result.session.statUrl,
                commandUrl: result.session.commandUrl,
                infoHash: result.session.infoHash,
                isLive: result.session.isLive,
                contentId: currentSession.contentId,
                streamName: currentSession.streamName
              })
              setRetryCount(prev => prev + 1)
              console.log('Stream restarted successfully')
            } else {
              setRetryCount(prev => prev + 1)
              console.error('Failed to restart stream:', result.error)
            }
          } catch (err) {
            setRetryCount(prev => prev + 1)
            console.error('Error during stream restart:', err)
          } finally {
            isRetryingRef.current = false
          }
        }, retryDelay)
      }
      
      // Reset retry count on successful playback
      if (newStats.status === 'dl' && newStats.peers > 0 && retryCount > 0) {
        setRetryCount(0)
        console.log('Stream recovered, retry count reset')
      }
      
      // Update duration in history for active item
      if (activeHistoryId && activeStartTimeRef.current) {
        const duration = Math.floor((Date.now() - activeStartTimeRef.current) / 1000)
        setHistoryItems(prev => {
          const updated = prev.map(item => 
            item.id === activeHistoryId ? { ...item, duration } : item
          )
          safeLocalStorageSet(HISTORY_KEY, JSON.stringify(updated))
          return updated
        })
      }
    }, 2000)

    return () => {
      clearInterval(interval)
      // Cleanup retry timeout
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [currentSession, activeHistoryId, retryCount])

  const checkEngineStatus = async () => {
    const status = await window.electronAPI.engine.getStatus()
    setEngineRunning(status.running)
    setEngineVersion(status.version || null)
  }

  const handleStartEngine = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await window.electronAPI.engine.start()
      if (!result.success) {
        setError(result.error || 'Failed to start engine')
      } else {
        await checkEngineStatus()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start engine')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStopEngine = async () => {
    await window.electronAPI.engine.stop()
    await checkEngineStatus()
  }

  const handlePlay = useCallback(async (contentId: string, name: string = contentId.substring(0, 8) + '...') => {
    setIsLoading(true)
    setError(null)

    // Save last stream for auto-resume (including name)
    safeLocalStorageSet('lastStream', contentId)
    safeLocalStorageSet('lastStreamName', name)

    try {
      // Start engine if not running
      if (!engineRunning) {
        const startResult = await window.electronAPI.engine.start()
        if (!startResult.success) {
          throw new Error(startResult.error || 'Failed to start engine')
        }
        await checkEngineStatus()
      }

      // Start playback
      const result = await window.electronAPI.acestream.play(contentId)
      if (!result.success || !result.session) {
        throw new Error(result.error || 'Failed to start playback')
      }

      setCurrentSession({
        playbackUrl: result.session.playbackUrl,
        statUrl: result.session.statUrl,
        commandUrl: result.session.commandUrl,
        infoHash: result.session.infoHash,
        isLive: result.session.isLive,
        contentId,
        streamName: name
      })
      
      // Add to history
      const historyId = `${Date.now()}-${contentId.substring(0, 8)}`
      const newEntry: HistoryEntry = {
        id: historyId,
        contentId,
        name,
        startedAt: Date.now(),
        duration: 0,
        isLive: result.session.isLive
      }
      
      setHistoryItems(prev => {
        // Limit history to prevent localStorage overflow
        const updated = [newEntry, ...prev].slice(0, HISTORY_MAX_ITEMS)
        safeLocalStorageSet(HISTORY_KEY, JSON.stringify(updated))
        return updated
      })
      setActiveHistoryId(historyId)
      activeStartTimeRef.current = Date.now()
      
      // Navigate to main page with player
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Playback error')
    } finally {
      setIsLoading(false)
    }
  }, [engineRunning, navigate])

  // Handle acestream:// protocol URLs
  useEffect(() => {
    if (!window.electronAPI?.onOpenUrl) return

    const cleanup = window.electronAPI.onOpenUrl((contentId: string) => {
      console.log('Received acestream:// URL with content ID:', contentId)
      // Play the stream with a short name from the content ID
      handlePlay(contentId, `acestream://${contentId.substring(0, 8)}...`)
    })

    return cleanup
  }, [handlePlay])

  const handleStop = useCallback(async () => {
    if (currentSession) {
      // Cancel any pending retry
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
      isRetryingRef.current = false
      setRetryCount(0)
      
      await window.electronAPI.acestream.stop(currentSession.commandUrl)
      setCurrentSession(null)
      setStats(null)
      setActiveHistoryId(null)
      activeStartTimeRef.current = null
    }
  }, [currentSession])

  const handleDeleteHistoryItem = useCallback((id: string) => {
    setHistoryItems(prev => {
      const updated = prev.filter(item => item.id !== id)
      safeLocalStorageSet(HISTORY_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleClearHistory = useCallback(() => {
    setHistoryItems([])
    safeLocalStorageSet(HISTORY_KEY, JSON.stringify([]))
  }, [])

  const handleAddBookmark = useCallback((contentId: string, name: string, isLive: boolean) => {
    // Check for duplicate
    if (bookmarkItems.some(b => b.contentId === contentId)) return
    
    const newBookmark: BookmarkEntry = {
      id: `${Date.now()}-${contentId.substring(0, 8)}`,
      contentId,
      name,
      createdAt: Date.now(),
      isLive
    }
    setBookmarkItems(prev => {
      const updated = [newBookmark, ...prev]
      safeLocalStorageSet(BOOKMARKS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [bookmarkItems])

  const handleRemoveBookmark = useCallback((id: string) => {
    setBookmarkItems(prev => {
      const updated = prev.filter(item => item.id !== id)
      safeLocalStorageSet(BOOKMARKS_KEY, JSON.stringify(updated))
      return updated
    })
  }, [])

  const handleRenameBookmark = useCallback((id: string, newName: string) => {
    // Find the bookmark to get contentId
    const bookmark = bookmarkItems.find(b => b.id === id)
    
    setBookmarkItems(prev => {
      const updated = prev.map(item => 
        item.id === id ? { ...item, name: newName } : item
      )
      safeLocalStorageSet(BOOKMARKS_KEY, JSON.stringify(updated))
      return updated
    })

    // Sync name to history entries with same contentId
    if (bookmark) {
      setHistoryItems(prev => {
        const updated = prev.map(item =>
          item.contentId === bookmark.contentId ? { ...item, name: newName } : item
        )
        safeLocalStorageSet(HISTORY_KEY, JSON.stringify(updated))
        return updated
      })
    }
  }, [bookmarkItems])

  const handleReorderBookmarks = useCallback((reorderedItems: BookmarkEntry[]) => {
    setBookmarkItems(reorderedItems)
    safeLocalStorageSet(BOOKMARKS_KEY, JSON.stringify(reorderedItems))
  }, [])

  const handleToggleBookmark = useCallback((contentId: string, name: string, isLive: boolean) => {
    const existing = bookmarkItems.find(b => b.contentId === contentId)
    if (existing) {
      handleRemoveBookmark(existing.id)
    } else {
      handleAddBookmark(contentId, name, isLive)
    }
  }, [bookmarkItems, handleRemoveBookmark, handleAddBookmark])

  const isBookmarked = useCallback((contentId: string) => {
    return bookmarkItems.some(b => b.contentId === contentId)
  }, [bookmarkItems])

  const handleCancel = useCallback(() => {
    setIsLoading(false)
    setError(null)
  }, [])

  const handlePlaceholderClick = useCallback(() => {
    setAutoFocusAddStream(true)
    navigate('/settings')
  }, [navigate])

  const isOnSettingsPage = location.pathname === '/settings'
  const isOnHistoryPage = location.pathname === '/history'
  const isOnBookmarksPage = location.pathname === '/bookmarks'
  const isOnSubpage = isOnSettingsPage || isOnHistoryPage || isOnBookmarksPage

  return (
    <div className="app">
      {/* Header with tabs - always visible */}
      <Header 
        currentContentId={currentSession?.contentId || null}
        bookmarkName={currentSession ? (bookmarkItems.find(b => b.contentId === currentSession.contentId)?.name || null) : null}
      />

      {/* Player always mounted, hidden when on settings page */}
      <div className={`player-container ${isOnSubpage ? 'player-hidden' : ''}`}>
        <div className="content">
          <Player
            src={currentSession?.playbackUrl || null}
            isLive={currentSession?.isLive || false}
            onStop={handleStop}
            onPlaceholderClick={isLoading ? undefined : handlePlaceholderClick}
            contentId={currentSession?.contentId}
            streamName={currentSession?.streamName}
            isBookmarked={currentSession ? isBookmarked(currentSession.contentId) : false}
            onToggleBookmark={currentSession ? () => handleToggleBookmark(
              currentSession.contentId,
              currentSession.streamName,
              currentSession.isLive
            ) : undefined}
            showStats={(stats !== null || isLoading) && showStats}
            isConnecting={isLoading}
          />
        </div>
        {((stats || isLoading) && showStats) && (
          <Stats 
            stats={stats} 
            onHide={() => {
              setShowStats(false)
              safeLocalStorageSet('showStats', 'false')
            }}
            retryCount={retryCount}
            maxRetries={MAX_RETRIES}
            loadingStatus={isLoading ? t('stats.statusConnecting') : null}
          />
        )}
      </div>

      <Routes>
        <Route path="/" element={
          <MainPage 
            error={error}
            onDismissError={() => setError(null)}
          />
        } />
        <Route path="/settings" element={
          <SettingsPage
            showStats={showStats}
            onShowStatsChange={(value) => {
              setShowStats(value)
              safeLocalStorageSet('showStats', String(value))
            }}
            autoResume={autoResume}
            onAutoResumeChange={(value) => {
              setAutoResume(value)
              safeLocalStorageSet('autoResume', String(value))
            }}
            engineRunning={engineRunning}
            engineVersion={engineVersion}
            isLoading={isLoading}
            onStartEngine={handleStartEngine}
            onStopEngine={handleStopEngine}
            onPlay={handlePlay}
            onCancel={handleCancel}
            autoFocusAddStream={autoFocusAddStream}
            onAutoFocusHandled={() => setAutoFocusAddStream(false)}
          />
        } />
        <Route path="/history" element={
          <History
            items={historyItems}
            activeHistoryId={activeHistoryId}
            onPlay={handlePlay}
            onDelete={handleDeleteHistoryItem}
            onClearAll={handleClearHistory}
            onToggleBookmark={handleToggleBookmark}
            isBookmarked={isBookmarked}
          />
        } />
        <Route path="/bookmarks" element={
          <Bookmarks
            items={bookmarkItems}
            activeContentId={currentSession?.contentId || null}
            onPlay={handlePlay}
            onRemove={handleRemoveBookmark}
            onRename={handleRenameBookmark}
            onReorder={handleReorderBookmarks}
          />
        } />
      </Routes>

      {showSetupWizard && (
        <SetupWizard
          onComplete={() => {
            setShowSetupWizard(false)
            // Trigger engine start after setup completes
            window.electronAPI.engine.start().then(() => {
              checkEngineStatus()
            })
          }}
          onSkip={() => {
            setShowSetupWizard(false)
            setShowWineDialog(true)
          }}
        />
      )}

      {showWineDialog && (
        <WineInstallDialog
          onClose={() => setShowWineDialog(false)}
        />
      )}
    </div>
  )
}

// Error Boundary component for graceful error handling
interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App Error Boundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback error={this.state.error} onReload={this.handleReload} />
      )
    }

    return this.props.children
  }
}

// ErrorBoundary fallback component with i18n support
function ErrorBoundaryFallback({ error, onReload }: { error: Error | null, onReload: () => void }) {
  const { t } = useTranslation()
  
  return (
    <div className="error-boundary">
      <div className="error-boundary-content">
        <h1>{t('error.title')}</h1>
        <p>{t('error.message')}</p>
        {error && (
          <details>
            <summary>{t('error.details')}</summary>
            <pre>{error.message}</pre>
          </details>
        )}
        <button onClick={onReload}>
          {t('error.reload')}
        </button>
      </div>
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <AppContent />
      </HashRouter>
    </ErrorBoundary>
  )
}

export default App
