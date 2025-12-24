/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'

export interface HistoryEntry {
  id: string
  contentId: string
  name: string
  startedAt: number
  duration: number
  isLive: boolean
}

interface GroupedEntry extends HistoryEntry {
  totalDuration: number
  playCount: number
}

interface HistorySection {
  key: string
  label: string
  items: GroupedEntry[]
}

interface HistoryProps {
  items: HistoryEntry[]
  activeHistoryId: string | null
  onPlay: (contentId: string, name: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
  onToggleBookmark: (contentId: string, name: string, isLive: boolean) => void
  isBookmarked: (contentId: string) => boolean
}

function formatDuration(seconds: number): string {
  if (seconds < 0) seconds = 0
  
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getDateKey(timestamp: number): string {
  return new Date(timestamp).toDateString()
}

function getSectionInfo(timestamp: number, t: (key: string) => string): { key: string; label: string } {
  const date = new Date(timestamp)
  const now = new Date()
  
  // Reset time to start of day for comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const targetDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  
  const diffDays = Math.floor((today.getTime() - targetDay.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDays === 0) {
    return { key: 'today', label: t('history.today') }
  } else if (diffDays === 1) {
    return { key: 'yesterday', label: t('history.yesterday') }
  } else if (diffDays < 7) {
    return { key: 'week', label: t('history.thisWeek') }
  } else if (diffDays < 30) {
    return { key: 'month', label: t('history.thisMonth') }
  } else {
    // Return specific date for older entries
    const label = date.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })
    return { key: `date-${targetDay.getTime()}`, label }
  }
}

function History({ items, activeHistoryId, onPlay, onDelete, onClearAll, onToggleBookmark, isBookmarked }: HistoryProps) {
  const { t } = useTranslation()
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyLink = async (contentId: string) => {
    const aceLink = `acestream://${contentId}`
    try {
      await navigator.clipboard.writeText(aceLink)
      setCopiedId(contentId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Group items by section and merge duplicates within same day
  const sections = useMemo(() => {
    const sectionMap = new Map<string, HistorySection>()
    
    // Sort items by date (newest first)
    const sortedItems = [...items].sort((a, b) => b.startedAt - a.startedAt)
    
    for (const item of sortedItems) {
      const { key: sectionKey, label: sectionLabel } = getSectionInfo(item.startedAt, t)
      const dateKey = getDateKey(item.startedAt)
      const groupKey = `${dateKey}-${item.contentId}`
      
      if (!sectionMap.has(sectionKey)) {
        sectionMap.set(sectionKey, {
          key: sectionKey,
          label: sectionLabel,
          items: []
        })
      }
      
      const section = sectionMap.get(sectionKey)!
      
      // Check if there's already an entry with the same contentId on the same day
      const existingIndex = section.items.findIndex(
        existing => `${getDateKey(existing.startedAt)}-${existing.contentId}` === groupKey
      )
      
      if (existingIndex !== -1) {
        // Merge with existing entry
        const existing = section.items[existingIndex]
        existing.totalDuration += item.duration
        existing.playCount += 1
        // Keep the most recent startedAt
        if (item.startedAt > existing.startedAt) {
          existing.startedAt = item.startedAt
          existing.id = item.id
          existing.duration = item.duration
        }
      } else {
        // Add new entry
        section.items.push({
          ...item,
          totalDuration: item.duration,
          playCount: 1
        })
      }
    }
    
    // Convert map to array, maintaining section order
    const sectionOrder = ['today', 'yesterday', 'week', 'month']
    const result: HistorySection[] = []
    
    for (const key of sectionOrder) {
      if (sectionMap.has(key)) {
        result.push(sectionMap.get(key)!)
        sectionMap.delete(key)
      }
    }
    
    // Add remaining sections (specific dates) sorted by date
    const remainingSections = Array.from(sectionMap.values())
      .sort((a, b) => {
        const aDate = a.items[0]?.startedAt || 0
        const bDate = b.items[0]?.startedAt || 0
        return bDate - aDate
      })
    
    result.push(...remainingSections)
    
    return result
  }, [items, t])

  return (
    <div className="history-page">

      <div className="history-content">
        {items.length > 0 && (
          <div className="history-actions-top">
            <button 
              className="clear-all-btn-top"
              onClick={onClearAll}
            >
              {t('history.clearAll')}
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="history-empty">
            <span className="history-empty-icon">📺</span>
            <p>{t('history.empty')}</p>
          </div>
        ) : (
          <div className="history-sections">
            {sections.map((section) => (
              <div key={section.key} className="history-section">
                <h2 className="history-section-title">{section.label}</h2>
                <div className="history-list">
                  {section.items.map((item) => {
                    const isActive = item.id === activeHistoryId
                    return (
                      <div 
                        key={item.id} 
                        className={`history-item ${isActive ? 'history-item-active' : ''}`}
                      >
                        <div className="history-item-info">
                          <div className="history-item-header">
                            <span className="history-item-name">{item.name}</span>
                            {item.isLive && (
                              <span className="history-item-live">LIVE</span>
                            )}
                            {isActive && (
                              <span className="history-item-playing">
                                {t('history.nowPlaying')}
                              </span>
                            )}
                            {item.playCount > 1 && (
                              <span className="history-item-count">
                                ×{item.playCount}
                              </span>
                            )}
                          </div>
                          <div className="history-item-meta">
                            <span className="history-item-date">
                              {formatTime(item.startedAt)}
                            </span>
                            <span className="history-item-separator">•</span>
                            <span className="history-item-duration">
                              {item.playCount > 1 
                                ? `${formatDuration(item.totalDuration)} ${t('history.total')}`
                                : formatDuration(item.duration)
                              }
                            </span>
                          </div>
                        </div>
                        <div className="history-item-actions">
                          {!isActive && (
                            <button 
                              className="history-play-btn"
                              onClick={() => onPlay(item.contentId, item.name)}
                              title={t('history.playAgain')}
                            >
                              ▶
                            </button>
                          )}
                          <button 
                            className={`history-bookmark-btn ${isBookmarked(item.contentId) ? 'bookmarked' : ''}`}
                            onClick={() => onToggleBookmark(item.contentId, item.name, item.isLive)}
                            title={isBookmarked(item.contentId) ? t('bookmarks.remove') : t('bookmarks.add')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill={isBookmarked(item.contentId) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                            </svg>
                          </button>
                          <button 
                            className={`history-copy-btn ${copiedId === item.contentId ? 'copied' : ''}`}
                            onClick={() => handleCopyLink(item.contentId)}
                            title={copiedId === item.contentId ? t('common.copied') : t('history.copyLink')}
                          >
                            {copiedId === item.contentId ? (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                              </svg>
                            )}
                          </button>
                          <button 
                            className="history-delete-btn"
                            onClick={() => onDelete(item.id)}
                            title={t('history.delete')}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default History
