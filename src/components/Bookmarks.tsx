/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useTranslation } from 'react-i18next'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'

export interface BookmarkEntry {
  id: string
  contentId: string
  name: string
  createdAt: number
  isLive: boolean
}

interface BookmarksProps {
  items: BookmarkEntry[]
  activeContentId: string | null
  onPlay: (contentId: string, name: string) => void
  onRemove: (id: string) => void
  onRename: (id: string, newName: string) => void
  onReorder: (reorderedItems: BookmarkEntry[]) => void
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function Bookmarks({ items, activeContentId, onPlay, onRemove, onRename, onReorder }: BookmarksProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

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
  
  // Drag and drop state
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const positionsRef = useRef<Map<string, DOMRect>>(new Map())
  const [isAnimating, setIsAnimating] = useState(false)

  // Focus input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleStartEdit = (item: BookmarkEntry) => {
    setEditingId(item.id)
    setEditingName(item.name.slice(0, 30))
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleSaveEdit = () => {
    if (editingId && editingName.trim()) {
      onRename(editingId, editingName.trim())
    }
    handleCancelEdit()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  // Filter items by search query (preserve user order, no auto-sort)
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return items
    }
    const query = searchQuery.toLowerCase()
    return items.filter(item => 
      item.name.toLowerCase().includes(query) || 
      item.contentId.toLowerCase().includes(query)
    )
  }, [items, searchQuery])

  // FLIP animation: capture positions before reorder
  const capturePositions = useCallback(() => {
    if (!listRef.current) return
    const elements = listRef.current.querySelectorAll('[data-bookmark-id]')
    const positions = new Map<string, DOMRect>()
    elements.forEach((el) => {
      const id = el.getAttribute('data-bookmark-id')
      if (id) {
        positions.set(id, el.getBoundingClientRect())
      }
    })
    positionsRef.current = positions
  }, [])

  // FLIP animation: animate from old positions to new
  const animatePositions = useCallback(() => {
    if (!listRef.current) return
    
    requestAnimationFrame(() => {
      const elements = listRef.current?.querySelectorAll('[data-bookmark-id]')
      if (!elements) return

      elements.forEach((el) => {
        const id = el.getAttribute('data-bookmark-id')
        if (!id) return

        const oldRect = positionsRef.current.get(id)
        const newRect = el.getBoundingClientRect()

        if (oldRect) {
          const deltaX = oldRect.left - newRect.left
          const deltaY = oldRect.top - newRect.top

          if (deltaX !== 0 || deltaY !== 0) {
            const htmlEl = el as HTMLElement
            // Apply inverse transform (move to old position)
            htmlEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`
            htmlEl.style.transition = 'none'

            // Force reflow
            htmlEl.offsetHeight

            // Animate to new position
            htmlEl.style.transition = 'transform 0.25s ease-out'
            htmlEl.style.transform = ''

            // Clean up after animation
            const cleanup = () => {
              htmlEl.style.transition = ''
              htmlEl.style.transform = ''
              htmlEl.removeEventListener('transitionend', cleanup)
            }
            htmlEl.addEventListener('transitionend', cleanup)
          }
        }
      })

      setIsAnimating(false)
    })
  }, [])

  // Trigger animation after items change
  useEffect(() => {
    if (isAnimating) {
      animatePositions()
    }
  }, [items, isAnimating, animatePositions])

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
    // Add a slight delay to allow the drag image to be captured
    setTimeout(() => {
      const element = document.querySelector(`[data-bookmark-id="${id}"]`)
      if (element) {
        element.classList.add('dragging')
      }
    }, 0)
  }

  const handleDragEnd = () => {
    if (draggedId) {
      const element = document.querySelector(`[data-bookmark-id="${draggedId}"]`)
      if (element) {
        element.classList.remove('dragging')
      }
    }
    setDraggedId(null)
    setDragOverId(null)
  }

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (id !== draggedId) {
      setDragOverId(id)
    }
  }

  const handleDragLeave = () => {
    setDragOverId(null)
  }

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    
    if (!draggedId || draggedId === targetId) {
      setDragOverId(null)
      return
    }

    // Capture current positions before reorder (FLIP animation)
    capturePositions()

    // Reorder items
    const newItems = [...items]
    const draggedIndex = newItems.findIndex(item => item.id === draggedId)
    const targetIndex = newItems.findIndex(item => item.id === targetId)

    if (draggedIndex !== -1 && targetIndex !== -1) {
      const [draggedItem] = newItems.splice(draggedIndex, 1)
      newItems.splice(targetIndex, 0, draggedItem)
      setIsAnimating(true)
      onReorder(newItems)
    }

    setDraggedId(null)
    setDragOverId(null)
  }

  // Disable drag when searching or editing
  const isDragDisabled = !!searchQuery.trim() || !!editingId

  return (
    <div className="bookmarks-page">
      <div className="bookmarks-content">
        {/* Search */}
        <div className="bookmarks-search">
          <input
            type="text"
            placeholder={t('bookmarks.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bookmarks-search-input"
          />
          {searchQuery && (
            <button 
              className="bookmarks-search-clear"
              onClick={() => setSearchQuery('')}
            >
              ✕
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="bookmarks-empty">
            <span className="bookmarks-empty-icon">⭐</span>
            <p>{t('bookmarks.empty')}</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="bookmarks-empty">
            <span className="bookmarks-empty-icon">🔍</span>
            <p>{t('bookmarks.noResults')}</p>
          </div>
        ) : (
          <div className="bookmarks-list" ref={listRef}>
            {filteredItems.map((item) => {
              const isActive = item.contentId === activeContentId
              const isDragging = draggedId === item.id
              const isDragOver = dragOverId === item.id
              return (
              <div 
                key={item.id}
                data-bookmark-id={item.id}
                className={`bookmark-item ${editingId === item.id ? 'editing' : ''} ${isActive ? 'bookmark-item-active' : ''} ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
                draggable={!isDragDisabled}
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, item.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, item.id)}
              >
                <div className="bookmark-item-info">
                  <div className="bookmark-item-header">
                    {editingId === item.id ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value.slice(0, 30))}
                        onKeyDown={handleEditKeyDown}
                        onBlur={handleSaveEdit}
                        className="bookmark-edit-input"
                        maxLength={30}
                      />
                    ) : (
                      <span 
                        className="bookmark-item-name"
                        onDoubleClick={() => handleStartEdit(item)}
                        title={t('bookmarks.doubleClickToRename')}
                      >
                        {item.name}
                      </span>
                    )}
                    {item.isLive && (
                      <span className="history-item-live">LIVE</span>
                    )}
                    {isActive && (
                      <span className="history-item-playing">
                        {t('history.nowPlaying')}
                      </span>
                    )}
                  </div>
                  <div className="bookmark-item-meta">
                    <span className="bookmark-item-date">
                      {t('bookmarks.added')}: {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
                <div className="bookmark-item-actions">
                  {editingId === item.id ? (
                    <>
                      <button 
                        className="bookmark-save-btn"
                        onClick={handleSaveEdit}
                        title={t('bookmarks.save')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </button>
                      <button 
                        className="bookmark-cancel-btn"
                        onClick={handleCancelEdit}
                        title={t('common.cancel')}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                      </button>
                    </>
                  ) : (
                    <>
                      {!isDragDisabled && (
                        <span 
                          className="bookmark-drag-handle"
                          title={t('bookmarks.dragToReorder')}
                        >
                          ⋮⋮
                        </span>
                      )}
                      <button 
                        className="bookmark-rename-btn"
                        onClick={() => handleStartEdit(item)}
                        title={t('bookmarks.rename')}
                      >
                        ✎
                      </button>
                      <button 
                        className={`bookmark-copy-btn ${copiedId === item.contentId ? 'copied' : ''}`}
                        onClick={() => handleCopyLink(item.contentId)}
                        title={copiedId === item.contentId ? t('common.copied') : t('bookmarks.copyLink')}
                      >
                        {copiedId === item.contentId ? '✓' : '⎘'}
                      </button>
                      {!isActive && (
                        <button 
                          className="bookmark-play-btn"
                          onClick={() => onPlay(item.contentId, item.name)}
                          title={t('bookmarks.play')}
                        >
                          ▶
                        </button>
                      )}
                      <button 
                        className="bookmark-remove-btn"
                        onClick={() => onRemove(item.id)}
                        title={t('bookmarks.remove')}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            )})
            }
          </div>
        )}
      </div>
    </div>
  )
}

export default Bookmarks
