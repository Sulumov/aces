/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface WineInstallDialogProps {
  onClose: () => void
}

interface CopyableCommandProps {
  command: string
  copyText: string
  copiedText: string
}

function CopyableCommand({ command, copyText, copiedText }: CopyableCommandProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <div className="copyable-command">
      <code>{command}</code>
      <button 
        className={`copy-btn ${copied ? 'copied' : ''}`}
        onClick={handleCopy}
        title={copied ? copiedText : copyText}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        )}
      </button>
    </div>
  )
}

function WineInstallDialog({ onClose }: WineInstallDialogProps) {
  const { t } = useTranslation()

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <h2>{t('wine.title')}</h2>
        
        <p>
          {t('wine.description')}
        </p>

        <div className="instructions">
          <p><strong>{t('wine.stepsTitle')}</strong></p>
          
          <ol>
            <li>
              <p>{t('wine.step1')}</p>
              <CopyableCommand 
                command='/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
                copyText={t('common.copy')}
                copiedText={t('common.copied')}
              />
            </li>
            
            <li>
              <p>{t('wine.step2')}</p>
              <CopyableCommand 
                command="softwareupdate --install-rosetta --agree-to-license"
                copyText={t('common.copy')}
                copiedText={t('common.copied')}
              />
            </li>
            
            <li>
              <p>{t('wine.step3')}</p>
              <CopyableCommand 
                command="brew tap gcenx/wine && brew install --cask wine-crossover"
                copyText={t('common.copy')}
                copiedText={t('common.copied')}
              />
            </li>
            
            <li>
              <p>{t('wine.step4')}</p>
            </li>
          </ol>
        </div>

        <div className="dialog-actions">
          <button onClick={onClose} className="primary">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default WineInstallDialog
