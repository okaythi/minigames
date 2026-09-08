import { useState, useEffect } from 'react'

interface ConfirmDialogProps {
  readonly isOpen: boolean
  readonly title: string
  readonly message: string | React.ReactNode
  readonly confirmLabel?: string | undefined
  readonly cancelLabel?: string | undefined
  readonly danger?: boolean | undefined
  readonly requireMatch?: string | undefined
  readonly matchPlaceholder?: string | undefined
  readonly onConfirm: () => void | Promise<void>
  readonly onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  requireMatch,
  matchPlaceholder,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [typedMatch, setTypedMatch] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTypedMatch('')
      setIsSubmitting(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const isMatchValid = !requireMatch || typedMatch.trim().toLowerCase() === requireMatch.trim().toLowerCase()

  const handleConfirm = async () => {
    if (!isMatchValid) return
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="nx-admin-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="nx-admin-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div className="nx-admin-modal-header">
          <h3 style={{ margin: 0, fontSize: '1.1rem', color: danger ? 'var(--nx-red)' : 'var(--nx-ink)' }}>
            {title}
          </h3>
          <button type="button" className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm" onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className="nx-admin-modal-body">
          <div style={{ fontSize: '0.875rem', color: 'var(--nx-slate)', lineHeight: 1.5 }}>
            {message}
          </div>
          {requireMatch && (
            <div style={{ marginTop: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--nx-ink)', marginBottom: '0.25rem' }}>
                Type <code className="nx-admin-mono" style={{ color: 'var(--nx-red)' }}>{requireMatch}</code> to confirm:
              </label>
              <input
                type="text"
                className="nx-admin-input"
                style={{ width: '100%' }}
                placeholder={matchPlaceholder || requireMatch}
                value={typedMatch}
                onChange={(e) => setTypedMatch(e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>
        <div className="nx-admin-modal-footer">
          <button
            type="button"
            className="nx-admin-btn nx-admin-btn-secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`nx-admin-btn ${danger ? 'nx-admin-btn-danger' : 'nx-admin-btn-primary'}`}
            onClick={handleConfirm}
            disabled={!isMatchValid || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
