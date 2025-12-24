/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useState, FormEvent, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

interface AddStreamProps {
  onPlay: (contentId: string, name: string) => void
  onCancel: () => void
  isLoading: boolean
  disabled: boolean
  autoFocus?: boolean
}

const LAST_STREAM_KEY = 'lastStreamUrl'
const LAST_NAME_KEY = 'lastStreamName'

function AddStream({ onPlay, onCancel, isLoading, disabled, autoFocus }: AddStreamProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [input, setInput] = useState(() => {
    return localStorage.getItem(LAST_STREAM_KEY) || ''
  })
  const [streamName, setStreamName] = useState(() => {
    return localStorage.getItem(LAST_NAME_KEY) || ''
  })

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    
    const trimmed = input.trim()
    if (!trimmed) return

    // Save link and name
    localStorage.setItem(LAST_STREAM_KEY, trimmed)
    localStorage.setItem(LAST_NAME_KEY, streamName)

    // Extract content ID from various formats
    let contentId = trimmed

    // Handle acestream:// URLs
    if (trimmed.startsWith('acestream://')) {
      contentId = trimmed.replace('acestream://', '')
    }

    // Handle magnet-style with infohash
    const infohashMatch = trimmed.match(/infohash=([a-fA-F0-9]{40})/)
    if (infohashMatch) {
      contentId = infohashMatch[1]
    }

    // If name is not set, use first 8 characters of contentId
    const name = streamName.trim() || contentId.substring(0, 8) + '...'

    onPlay(contentId, name)
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      setInput(text)
    } catch (err) {
      console.error('Failed to read clipboard:', err)
    }
  }

  return (
    <div className="add-stream">
      <h3>{t('addStream.title')}</h3>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t('addStream.placeholder')}
            disabled={disabled}
          />
          <button
            type="button"
            onClick={handlePaste}
            className="paste-btn"
            title={t('addStream.pasteTitle')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
            </svg>
          </button>
        </div>
        <div className="input-group name-input-group">
          <input
            type="text"
            value={streamName}
            onChange={(e) => setStreamName(e.target.value)}
            placeholder={t('addStream.namePlaceholder')}
            disabled={disabled}
            className="name-input"
          />
        </div>
        <div className="button-group">
          <button
            type="submit"
            disabled={disabled || !input.trim() || isLoading}
            className="play-btn"
          >
            {isLoading ? t('addStream.loadingBtn') : t('addStream.playBtn')}
          </button>
          {isLoading && (
            <button
              type="button"
              onClick={onCancel}
              className="cancel-btn"
            >
              {t('addStream.cancelBtn')}
            </button>
          )}
        </div>
      </form>

      <div className="examples">
        <p className="examples-title">{t('addStream.examples')}</p>
        <code>acestream://94c2fd8fb9bc8f2fc71a2cbe9d4b866f227a0209</code>
      </div>
    </div>
  )
}

export default AddStream
