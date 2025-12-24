/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useTranslation } from 'react-i18next'

interface StatsProps {
  stats: {
    status: string
    peers: number
    speedDown: number
    speedUp: number
    downloaded: number
    uploaded: number
    isLive: boolean
  } | null
  onHide: () => void
  retryCount?: number
  maxRetries?: number
  loadingStatus?: string | null
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + '/s'
}

function getStatusText(status: string, peers: number, speedDown: number, t: (key: string) => string): string {
  // If status is dl but no peers and no speed - actually searching for peers
  if (status === 'dl' && peers === 0 && speedDown === 0) {
    return t('stats.statusSearching')
  }
  
  switch (status) {
    case 'prebuf':
      return t('stats.statusBuffering')
    case 'dl':
      return t('stats.statusPlaying')
    case 'check':
      return t('stats.statusChecking')
    case 'idle':
      return t('stats.statusIdle')
    case 'error':
      return t('stats.statusError')
    default:
      return status
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'dl':
      return '#4ade80'
    case 'prebuf':
    case 'check':
      return '#fbbf24'
    case 'error':
      return '#ef4444'
    default:
      return '#9ca3af'
  }
}

function Stats({ stats, onHide, retryCount = 0, maxRetries = 5, loadingStatus }: StatsProps) {
  const { t } = useTranslation()
  
  // If connecting (no stats) - show only connection status
  if (!stats && loadingStatus) {
    return (
      <div className="stats stats-loading">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">{t('stats.status')}</span>
            <span className="stat-value status" style={{ color: '#fbbf24' }}>
              {loadingStatus}
            </span>
          </div>
        </div>
        <button 
          className="stats-toggle" 
          onClick={onHide}
          title={t('stats.hide')}
        >
          ✕
        </button>
      </div>
    )
  }
  
  if (!stats) return null
  
  const statusText = getStatusText(stats.status, stats.peers, stats.speedDown, t)
  const isSearching = stats.status === 'dl' && stats.peers === 0 && stats.speedDown === 0
  const isRetrying = stats.status === 'error' && retryCount < maxRetries
  
  return (
    <div className="stats">
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">{t('stats.status')}</span>
          <span 
            className="stat-value status"
            style={{ color: isSearching ? '#fbbf24' : getStatusColor(stats.status) }}
          >
            {isRetrying ? t('stats.statusRetrying', { attempt: retryCount + 1, max: maxRetries }) : statusText}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.peers')}</span>
          <span className="stat-value" style={{ color: stats.peers === 0 ? '#ef4444' : undefined }}>
            {stats.peers}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.download')}</span>
          <span className="stat-value download">
            ↓ {formatSpeed(stats.speedDown)}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.upload')}</span>
          <span className="stat-value upload">
            ↑ {formatSpeed(stats.speedUp)}
          </span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.downloaded')}</span>
          <span className="stat-value">{formatBytes(stats.downloaded)}</span>
        </div>

        <div className="stat-item">
          <span className="stat-label">{t('stats.uploaded')}</span>
          <span className="stat-value">{formatBytes(stats.uploaded)}</span>
        </div>
      </div>
      
      <button 
        className="stats-toggle" 
        onClick={onHide}
        title={t('stats.hide')}
      >
        ✕
      </button>
    </div>
  )
}

export default Stats
