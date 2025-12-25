/**
 * @author Adam Sulumov <sulumov.adam@ya.ru>
 * @license MIT
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import '../styles/components/setup-wizard.css'
import logo from '/logo.png'

interface InstallProgress {
  step: 'checking' | 'rosetta' | 'homebrew' | 'wine' | 'complete' | 'error'
  percent: number
  messageKey: string
  messageParams?: Record<string, string>
  logKey?: string
  logParams?: Record<string, string>
  rawLog?: string
}

interface InstallStatus {
  applicable: boolean
  internet?: boolean
  rosetta?: boolean
  rosettaRequired?: boolean
  homebrew?: boolean
  wine?: boolean
  wineVersion?: string | null
  allReady?: boolean
}

interface SetupWizardProps {
  onComplete: () => void
  onSkip: () => void
}

type WizardPhase = 'checking' | 'ready' | 'installing' | 'waitingHomebrew' | 'installingWine' | 'complete' | 'error'

export default function SetupWizard({ onComplete, onSkip }: SetupWizardProps) {
  const { t } = useTranslation()
  const [phase, setPhase] = useState<WizardPhase>('checking')
  const [status, setStatus] = useState<InstallStatus | null>(null)
  const [progress, setProgress] = useState<InstallProgress | null>(null)
  const [logs, setLogs] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const logsEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  // Check initial status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await window.electronAPI.installer.checkAll()
        setStatus(result)
        
        if (!result.applicable || result.allReady) {
          onComplete()
        } else {
          setPhase('ready')
        }
      } catch (err) {
        setError(t('setup.errorChecking'))
        setPhase('error')
      }
    }
    
    checkStatus()
  }, [onComplete, t])

  // Listen for progress updates
  useEffect(() => {
    const unsubscribe = window.electronAPI.installer.onProgress((prog: InstallProgress) => {
      setProgress(prog)
      
      // Handle logs - either localized logKey or raw command output
      if (prog.logKey) {
        const translatedLog = t(prog.logKey, prog.logParams || {})
        setLogs(prev => prev + translatedLog)
      } else if (prog.rawLog) {
        setLogs(prev => prev + prog.rawLog)
      }
      
      if (prog.step === 'complete') {
        setPhase('complete')
      } else if (prog.step === 'error') {
        setError(t(prog.messageKey, prog.messageParams || {}))
        setPhase('error')
      }
    })

    return () => {
      unsubscribe()
    }
  }, [t])

  // Start installation
  const handleStart = useCallback(async () => {
    setPhase('installing')
    setLogs('')
    setError(null)
    
    try {
      const result = await window.electronAPI.installer.start()
      
      if (result.success) {
        // If Homebrew was already installed, proceed directly to Wine installation
        if (result.homebrewWasAlreadyInstalled) {
          setPhase('installingWine')
          const wineResult = await window.electronAPI.installer.continueWine()
          if (!wineResult.success && wineResult.error) {
            setError(wineResult.error)
            setPhase('error')
          }
          // Will receive 'complete' via progress events if successful
        } else {
          // After Homebrew opens Terminal, we wait for user
          setPhase('waitingHomebrew')
        }
      } else if (result.error) {
        setError(result.error)
        setPhase('error')
      }
    } catch (err) {
      setError(t('setup.errorInstalling'))
      setPhase('error')
    }
  }, [t])

  // Continue after Homebrew
  const handleContinue = useCallback(async () => {
    // Check if Homebrew is installed
    const brewCheck = await window.electronAPI.installer.checkHomebrew()
    
    if (!brewCheck.installed) {
      setError(t('setup.homebrewNotInstalled'))
      return
    }
    
    setPhase('installingWine')
    setError(null)
    
    try {
      const result = await window.electronAPI.installer.continueWine()
      
      if (result.success) {
        // Will receive 'complete' via progress events
      } else if (result.error) {
        setError(result.error)
        setPhase('error')
      }
    } catch (err) {
      setError(t('setup.errorInstalling'))
      setPhase('error')
    }
  }, [t])

  // Cancel installation
  const handleCancel = useCallback(async () => {
    setShowCancelConfirm(false)
    await window.electronAPI.installer.cancel()
    onSkip()
  }, [onSkip])

  // Retry after error
  const handleRetry = useCallback(() => {
    setError(null)
    setLogs('')
    
    if (phase === 'error' && status?.homebrew) {
      // Homebrew already installed, retry Wine
      handleContinue()
    } else {
      // Start from beginning
      handleStart()
    }
  }, [phase, status, handleContinue, handleStart])

  // Get current step info
  const getStepInfo = () => {
    const steps = []
    
    if (status?.rosettaRequired) {
      steps.push({
        id: 'rosetta',
        label: t('setup.stepRosetta'),
        done: status.rosetta || progress?.step === 'homebrew' || progress?.step === 'wine' || progress?.step === 'complete',
        active: progress?.step === 'rosetta'
      })
    }
    
    steps.push({
      id: 'homebrew',
      label: t('setup.stepHomebrew'),
      done: status?.homebrew || progress?.step === 'wine' || progress?.step === 'complete',
      active: progress?.step === 'homebrew' || phase === 'waitingHomebrew'
    })
    
    steps.push({
      id: 'wine',
      label: t('setup.stepWine'),
      done: status?.wine || progress?.step === 'complete',
      active: progress?.step === 'wine' || phase === 'installingWine'
    })
    
    return steps
  }

  return (
    <div className="setup-wizard">
      <div className="setup-wizard-content">
        {/* App branding */}
        <div className="setup-wizard-branding">
          <img 
            src={logo} 
            alt="Aces" 
            className="setup-wizard-logo"
          />
          <span className="setup-wizard-app-name">Aces</span>
        </div>

        <div className="setup-wizard-card">
          <div className="setup-wizard-header">
            <h1>{t('setup.title')}</h1>
            <p className="setup-wizard-subtitle">{t('setup.subtitle')}</p>
          </div>

        {/* Checking phase */}
        {phase === 'checking' && (
          <div className="setup-wizard-checking">
            <div className="spinner" />
            <p>{t('setup.checking')}</p>
          </div>
        )}

        {/* Ready to install */}
        {phase === 'ready' && status && (
          <div className="setup-wizard-ready">
            <div className="setup-requirements">
              <h3>{t('setup.requirementsTitle')}</h3>
              <ul className="requirements-list">
                {status.rosettaRequired && (
                  <li className={status.rosetta ? 'done' : ''}>
                    <span className="check-icon">{status.rosetta ? '✓' : '○'}</span>
                    <span>Rosetta 2</span>
                    <span className="status-badge">
                      {status.rosetta ? t('setup.installed') : t('setup.required')}
                    </span>
                  </li>
                )}
                <li className={status.homebrew ? 'done' : ''}>
                  <span className="check-icon">{status.homebrew ? '✓' : '○'}</span>
                  <span>Homebrew</span>
                  <span className="status-badge">
                    {status.homebrew ? t('setup.installed') : t('setup.required')}
                  </span>
                </li>
                <li className={status.wine ? 'done' : ''}>
                  <span className="check-icon">{status.wine ? '✓' : '○'}</span>
                  <span>Wine</span>
                  <span className="status-badge">
                    {status.wine ? status.wineVersion : t('setup.required')}
                  </span>
                </li>
              </ul>
            </div>
            
            <p className="setup-time-estimate">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {t('setup.timeEstimate')}
            </p>

            <div className="setup-actions">
              <button className="btn-primary" onClick={handleStart}>
                {t('setup.startInstall')}
              </button>
              <button className="btn-secondary" onClick={onSkip}>
                {t('setup.skipManual')}
              </button>
            </div>
          </div>
        )}

        {/* Installing */}
        {(phase === 'installing' || phase === 'installingWine') && (
          <div className="setup-wizard-installing">
            <div className="setup-steps">
              {getStepInfo().map((step, index) => (
                <div 
                  key={step.id} 
                  className={`setup-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}
                >
                  <div className="step-indicator">
                    {step.done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : step.active ? (
                      <div className="spinner-small" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>

            <div className="progress-section">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${progress?.percent || 0}%` }} 
                />
              </div>
              <div className="progress-info">
                <span className="progress-message">
                  {progress?.messageKey ? t(progress.messageKey, progress.messageParams || {}) : t('setup.preparing')}
                </span>
                <span className="progress-percent">{progress?.percent || 0}%</span>
              </div>
            </div>

            <div className="logs-section">
              <div className="logs-header">
                <span>{t('setup.installationLog')}</span>
              </div>
              <div className="logs-content">
                <pre>{logs || t('setup.waitingLogs')}</pre>
                <div ref={logsEndRef} />
              </div>
            </div>

            <button 
              className="btn-cancel" 
              onClick={() => setShowCancelConfirm(true)}
            >
              {t('common.cancel')}
            </button>
          </div>
        )}

        {/* Waiting for Homebrew */}
        {phase === 'waitingHomebrew' && (
          <div className="setup-wizard-waiting">
            <div className="setup-steps">
              {getStepInfo().map((step, index) => (
                <div 
                  key={step.id} 
                  className={`setup-step ${step.done ? 'done' : ''} ${step.active ? 'active' : ''}`}
                >
                  <div className="step-indicator">
                    {step.done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                      </svg>
                    ) : step.active ? (
                      <div className="spinner-small" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </div>
                  <span className="step-label">{step.label}</span>
                </div>
              ))}
            </div>

            <div className="waiting-message">
              <div className="terminal-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M6 8l4 4-4 4" />
                  <path d="M12 16h6" />
                </svg>
              </div>
              <h3>{t('setup.homebrewWaiting')}</h3>
              <p>{t('setup.homebrewInstructions')}</p>
              <ol className="homebrew-steps">
                <li>{t('setup.homebrewStep1')}</li>
                <li>{t('setup.homebrewStep2')}</li>
                <li>{t('setup.homebrewStep3')}</li>
              </ol>
            </div>

            {error && (
              <div className="error-message">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <div className="logs-section">
              <div className="logs-header">
                <span>{t('setup.installationLog')}</span>
              </div>
              <div className="logs-content">
                <pre>{logs || t('setup.waitingLogs')}</pre>
                <div ref={logsEndRef} />
              </div>
            </div>

            <div className="setup-actions">
              <button className="btn-primary" onClick={handleContinue}>
                {t('setup.checkAndContinue')}
              </button>
              <button className="btn-cancel" onClick={() => setShowCancelConfirm(true)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Complete */}
        {phase === 'complete' && (
          <div className="setup-wizard-complete">
            <div className="success-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <h2>{t('setup.complete')}</h2>
            <p>{t('setup.completeMessage')}</p>
            <button className="btn-primary" onClick={onComplete}>
              {t('setup.startApp')}
            </button>
          </div>
        )}

        {/* Error */}
        {phase === 'error' && (
          <div className="setup-wizard-error">
            <div className="error-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
            </div>
            <h2>{t('setup.errorTitle')}</h2>
            <p className="error-description">{error || t('setup.errorGeneric')}</p>
            
            <div className="logs-section">
              <div className="logs-header">
                <span>{t('setup.installationLog')}</span>
              </div>
              <div className="logs-content">
                <pre>{logs}</pre>
                <div ref={logsEndRef} />
              </div>
            </div>

            <div className="setup-actions">
              <button className="btn-primary" onClick={handleRetry}>
                {t('setup.retry')}
              </button>
              <button className="btn-secondary" onClick={onSkip}>
                {t('setup.skipManual')}
              </button>
            </div>
          </div>
        )}

        </div>

        {/* Cancel confirmation modal */}
        {showCancelConfirm && (
          <div className="confirm-overlay">
            <div className="confirm-dialog">
              <h3>{t('setup.cancelConfirmTitle')}</h3>
              <p>{t('setup.cancelConfirmMessage')}</p>
              <div className="confirm-actions">
                <button className="btn-secondary" onClick={() => setShowCancelConfirm(false)}>
                  {t('setup.continueInstall')}
                </button>
                <button className="btn-danger" onClick={handleCancel}>
                  {t('setup.cancelInstall')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
