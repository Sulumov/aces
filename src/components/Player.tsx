/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Hls, { Level } from 'hls.js'

interface PlayerProps {
  src: string | null
  isLive: boolean
  onStop: () => void
  onPlaceholderClick?: () => void
  contentId?: string
  streamName?: string
  isBookmarked?: boolean
  onToggleBookmark?: () => void
  showStats?: boolean
  isConnecting?: boolean
}

interface QualityLevel {
  index: number
  height: number
  bitrate: number
  label: string
}

function Player({ src, isLive, onStop, onPlaceholderClick, contentId, isBookmarked, onToggleBookmark, showStats, isConnecting }: PlayerProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([])
  const [currentQuality, setCurrentQuality] = useState(-1) // -1 = auto
  const [showControls, setShowControls] = useState(false)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) {
      // Cleanup when no source
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      setIsPlaying(false)
      setIsBuffering(false)
      setQualityLevels([])
      setCurrentQuality(-1)
      return
    }

    setError(null)
    setIsBuffering(true)

    // Check if HLS.js is supported
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: isLive,
        backBufferLength: isLive ? 30 : 90,
        // More aggressive settings for P2P streams
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        manifestLoadingTimeOut: 30000,
        manifestLoadingMaxRetry: 6,
        levelLoadingTimeOut: 30000,
        levelLoadingMaxRetry: 6,
        fragLoadingTimeOut: 60000,
        fragLoadingMaxRetry: 6
      })

      hlsRef.current = hls

      hls.loadSource(src)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Normalize resolution to standard names
        const normalizeHeight = (h: number): string => {
          if (h >= 2100) return '4K'
          if (h >= 1400) return '1440p'
          if (h >= 1000) return '1080p'
          if (h >= 700) return '720p'
          if (h >= 560) return '576p'
          if (h >= 440) return '480p'
          if (h >= 340) return '360p'
          if (h >= 220) return '240p'
          return `${h}p`
        }
        
        // Get available quality levels (only with known resolution)
        const allLevels: QualityLevel[] = hls.levels
          .map((level: Level, index: number) => ({
            index,
            height: level.height,
            bitrate: level.bitrate,
            label: level.height ? normalizeHeight(level.height) : ''
          }))
          .filter(level => level.height > 0)
        
        // Deduplication: keep only one level per label (with highest bitrate)
        const labelMap = new Map<string, QualityLevel>()
        for (const level of allLevels) {
          const existing = labelMap.get(level.label)
          if (!existing || level.bitrate > existing.bitrate) {
            labelMap.set(level.label, level)
          }
        }
        const levels = Array.from(labelMap.values())
        
        setQualityLevels(levels)
        setCurrentQuality(-1) // Auto by default
        
        setIsBuffering(false)
        video.play()
          .then(() => setIsPlaying(true))
          .catch(err => {
            console.error('Autoplay failed:', err)
            // Autoplay failed - user can click on video to start
          })
      })

      hls.on(Hls.Events.LEVEL_SWITCHED, () => {
        // Update current quality level on automatic switch
        if (hls.autoLevelEnabled) {
          setCurrentQuality(-1)
        }
      })

      hls.on(Hls.Events.FRAG_BUFFERED, () => {
        setIsBuffering(false)
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Network error, trying to recover...')
              setIsBuffering(true)
              hls.startLoad()
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Media error, trying to recover...')
              setIsBuffering(true)
              hls.recoverMediaError()
              break
            default:
              console.error('Fatal error:', data)
              setError(t('player.playbackError') + ' ' + data.details)
              hls.destroy()
              break
          }
        }
      })

      return () => {
        hls.destroy()
        hlsRef.current = null
      }
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src
      video.addEventListener('loadedmetadata', () => {
        video.play()
          .then(() => setIsPlaying(true))
          .catch(err => console.error('Autoplay failed:', err))
      })
    } else {
      setError('HLS is not supported in this browser')
    }
  }, [src, isLive])

  const handlePlay = () => {
    videoRef.current?.play()
      .then(() => {
        setIsPlaying(true)
        setError(null)
      })
      .catch(err => console.error('Play failed:', err))
  }

  const handlePause = () => {
    videoRef.current?.pause()
    setIsPlaying(false)
  }

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen()
  }

  const handleQualityChange = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level
      setCurrentQuality(level)
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    const video = videoRef.current
    if (video) {
      video.volume = newVolume
      setVolume(newVolume)
      if (newVolume > 0 && isMuted) {
        video.muted = false
        setIsMuted(false)
      }
    }
  }

  const handleToggleMute = () => {
    const video = videoRef.current
    if (video) {
      video.muted = !video.muted
      setIsMuted(!isMuted)
    }
  }

  const getCurrentQualityLabel = () => {
    if (currentQuality === -1) {
      const autoLevel = hlsRef.current?.currentLevel
      const level = qualityLevels.find(l => l.index === autoLevel)
      return level ? `${t('player.auto')} (${level.label})` : t('player.auto')
    }
    const level = qualityLevels.find(l => l.index === currentQuality)
    return level?.label || 'Unknown'
  }

  const handleMouseEnter = () => {
    setShowControls(true)
  }

  const handleMouseLeave = () => {
    setShowControls(false)
  }

  return (
    <div 
      className="player"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="player-wrapper">
        {!src ? (
          <div 
            className="player-placeholder" 
            onClick={onPlaceholderClick}
            style={{ cursor: onPlaceholderClick ? 'pointer' : 'default' }}
          >
            <div className="placeholder-icon">▶</div>
            <p>{t('player.placeholder')}</p>
          </div>
        ) : (
          <div className="video-container">
            <video
              ref={videoRef}
              className="player-video"
              playsInline
            />
            <div className={`player-controls ${showControls ? 'visible' : ''} ${showStats ? 'with-stats' : ''}`}>
              <button 
                className="control-btn" 
                onClick={isPlaying ? handlePause : handlePlay}
                title={isPlaying ? t('player.pauseBtn') : t('player.playBtn')}
              >
                {isPlaying ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="4" width="4" height="16" rx="1" />
                    <rect x="14" y="4" width="4" height="16" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="5,3 19,12 5,21" />
                  </svg>
                )}
              </button>
              <button 
                className="control-btn" 
                onClick={handleFullscreen}
                title={t('player.fullscreenBtn')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
              <button 
                className="control-btn control-btn--stop" 
                onClick={onStop}
                title={t('player.stopBtn')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              </button>
              
              {contentId && onToggleBookmark && (
                <button 
                  className={`player-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}`}
                  onClick={onToggleBookmark}
                  title={isBookmarked ? t('bookmarks.remove') : t('bookmarks.add')}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill={isBookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              )}
              
              <div className="volume-control">
                <button 
                  className="control-btn volume-btn" 
                  onClick={handleToggleMute}
                  title={isMuted ? t('player.unmuteBtn') : t('player.muteBtn')}
                >
                  {isMuted || volume === 0 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : volume < 0.5 ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>
                <input
                  type="range"
                  className="volume-slider"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(Number(e.target.value))}
                  title={t('player.volumeSlider')}
                />
              </div>
              
              <div className="player-controls-right">
                {qualityLevels.length > 0 && (
                  <div className="quality-selector">
                    {qualityLevels.length > 1 && (
                      <>
                        <select 
                          value={currentQuality} 
                          onChange={(e) => handleQualityChange(Number(e.target.value))}
                        >
                          <option value={-1}>{t('player.auto')}</option>
                          {qualityLevels
                            .sort((a, b) => b.height - a.height)
                            .map(level => (
                              <option key={level.index} value={level.index}>
                                {level.label}
                              </option>
                            ))
                          }
                        </select>
                      </>
                    )}
                    <span className="current-quality">{getCurrentQualityLabel()}</span>
                  </div>
                )}
                
                {isLive && <span className="live-badge">{t('player.liveBadge')}</span>}
                {isBuffering && <span className="buffering-badge">{t('player.bufferingBadge')}</span>}
              </div>
            </div>
            {(isBuffering || isConnecting) && !error && (
              <div className="player-loading">
                <div className="loading-spinner"></div>
              </div>
            )}
            {error && (
              <div className="player-error">
                <p>{error}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default Player
