/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useTranslation } from 'react-i18next'
import { useEffect, useState } from 'react'
import AddStream from './AddStream'
import WineInstallDialog from './WineInstallDialog'

interface SettingsPageProps {
  showStats: boolean
  onShowStatsChange: (value: boolean) => void
  autoResume: boolean
  onAutoResumeChange: (value: boolean) => void
  engineRunning: boolean
  engineVersion: string | null
  isLoading: boolean
  onStartEngine: () => void
  onStopEngine: () => void
  onPlay: (contentId: string) => void
  onCancel: () => void
  autoFocusAddStream?: boolean
  onAutoFocusHandled?: () => void
}

function SettingsPage({
  showStats,
  onShowStatsChange,
  autoResume,
  onAutoResumeChange,
  engineRunning,
  engineVersion,
  isLoading,
  onStartEngine,
  onStopEngine,
  onPlay,
  onCancel,
  autoFocusAddStream,
  onAutoFocusHandled
}: SettingsPageProps) {
  const { t, i18n } = useTranslation()
  const [isMac, setIsMac] = useState(false)
  const [showWineDialog, setShowWineDialog] = useState(false)
  const [cacheSize, setCacheSize] = useState<number>(0)
  const [isLoadingCache, setIsLoadingCache] = useState(true)

  useEffect(() => {
    window.electronAPI.platform.getInfo().then(info => {
      setIsMac(info.isMac)
    })
    // Load cache size
    loadCacheSize()
  }, [])

  const loadCacheSize = async () => {
    setIsLoadingCache(true)
    try {
      const result = await window.electronAPI.cache.getSize()
      if (result.success) {
        setCacheSize(result.size)
      }
    } catch (error) {
      console.error('Failed to get cache size:', error)
    } finally {
      setIsLoadingCache(false)
    }
  }

  const handleClearCache = async () => {
    try {
      const result = await window.electronAPI.cache.clear()
      if (result.success) {
        setCacheSize(0)
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  useEffect(() => {
    if (autoFocusAddStream && onAutoFocusHandled) {
      // Reset flag after mounting
      const timer = setTimeout(() => onAutoFocusHandled(), 100)
      return () => clearTimeout(timer)
    }
  }, [autoFocusAddStream, onAutoFocusHandled]) 

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value
    i18n.changeLanguage(newLang)
  }

  const handleShowWineGuide = () => {
    setShowWineDialog(true)
  }

  return (
    <div className="settings-page">
      <div className="settings-content-page">
        {/* Add Stream Section */}
        <section className="settings-section-block">
          <AddStream
            onPlay={onPlay}
            onCancel={onCancel}
            isLoading={isLoading}
            disabled={isLoading}
            autoFocus={autoFocusAddStream}
          />
        </section>

        {/* Engine Section */}
        <section className="settings-section-block">
          <h2>{t('engine.title')}</h2>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">{t('settings.engineStatus')}</span>
                <span className="settings-label-description">
                  {engineRunning ? t('engine.running') : t('engine.stopped')}
                  {engineVersion && ` • ${t('engine.version')} ${engineVersion}`}
                </span>
              </div>
              <div className="engine-status-inline">
                <span className={`status-dot ${engineRunning ? 'running' : 'stopped'}`} />
                {engineRunning ? (
                  <button 
                    onClick={onStopEngine}
                    disabled={isLoading}
                    className="stop-engine-btn"
                  >
                    {t('engine.stopEngine')}
                  </button>
                ) : (
                  <button 
                    onClick={onStartEngine}
                    disabled={isLoading}
                    className="start-engine-btn"
                  >
                    {isLoading ? t('engine.starting') : t('engine.startEngine')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>



        {/* Interface Section */}
        <section className="settings-section-block">
          <h2>{t('settings.interfaceTitle')}</h2>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">{t('settings.language')}</span>
                <span className="settings-label-description">{t('settings.languageDescription')}</span>
              </div>
              <select 
                className="settings-select"
                value={i18n.language.split('-')[0]} 
                onChange={handleLanguageChange}
              >
                <option value="en">{t('settings.languages.en')}</option>
                <option value="ru">{t('settings.languages.ru')}</option>
                <option value="uk">{t('settings.languages.uk')}</option>
                <option value="es">{t('settings.languages.es')}</option>
                <option value="pt">{t('settings.languages.pt')}</option>
              </select>
            </div>
            
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">{t('settings.showStats')}</span>
                <span className="settings-label-description">{t('settings.showStatsDescription')}</span>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={showStats} 
                  onChange={(e) => onShowStatsChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">{t('settings.autoResume')}</span>
                <span className="settings-label-description">{t('settings.autoResumeDescription')}</span>
              </div>
              <label className="toggle">
                <input 
                  type="checkbox" 
                  checked={autoResume} 
                  onChange={(e) => onAutoResumeChange(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        {/* Storage Section */}
        <section className="settings-section-block">
          <h2>{t('settings.storageTitle')}</h2>
          <div className="settings-section">
            <div className="settings-row">
              <div className="settings-label">
                <span className="settings-label-title">{t('settings.cache')}</span>
                <span className="settings-label-description">
                  {t('settings.cacheDescription')}
                  {' • '}
                  {isLoadingCache ? '...' : formatSize(cacheSize)}
                </span>
              </div>
              <button 
                onClick={handleClearCache}
                className="settings-btn"
                disabled={isLoadingCache || cacheSize === 0}
              >
                {t('settings.clearCache')}
              </button>
            </div>
          </div>
        </section>

        {/* Launch Settings Section (macOS only) - at the very bottom */}
        {isMac && (
          <section className="settings-section-block">
            <h2>{t('settings.launchSettingsTitle')}</h2>
            <div className="settings-section">
              <div className="settings-row">
                <div className="settings-label">
                  <span className="settings-label-title">{t('settings.wineGuide')}</span>
                  <span className="settings-label-description">{t('settings.wineGuideDescription')}</span>
                </div>
                <button 
                  onClick={handleShowWineGuide}
                  className="settings-btn"
                >
                  {t('settings.showWineGuide')}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* Wine Install Dialog */}
      {showWineDialog && (
        <WineInstallDialog
          onClose={() => setShowWineDialog(false)}
        />
      )}
    </div>
  )
}

export default SettingsPage
