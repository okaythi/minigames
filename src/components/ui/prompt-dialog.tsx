import { useState, useEffect } from 'react'

interface PromptDialogProps {
  readonly isOpen: boolean
  readonly title: string
  readonly message?: string | undefined
  readonly inputLabel?: string | undefined
  readonly placeholder?: string | undefined
  readonly defaultValue?: string | undefined
  readonly multiline?: boolean | undefined
  readonly required?: boolean | undefined
  readonly confirmLabel?: string | undefined
  readonly cancelLabel?: string | undefined
  readonly danger?: boolean | undefined
  readonly onSubmit: (value: string) => void | Promise<void>
  readonly onCancel: () => void
}

export function PromptDialog({
  isOpen,
  title,
  message,
  inputLabel = 'Reason / Note:',
  placeholder = 'Enter details...',
  defaultValue = '',
  multiline = false,
  required = true,
  confirmLabel = 'Submit',
  cancelLabel = 'Cancel',
  danger = false,
  onSubmit,
  onCancel,
}: PromptDialogProps) {
  const [val, setVal] = useState(defaultValue)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setVal(defaultValue)
      setIsSubmitting(false)
    }
  }, [isOpen, defaultValue])

  if (!isOpen) return null

  const isValid = !required || val.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    setIsSubmitting(true)
    try {
      await onSubmit(val.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="nx-admin-modal-overlay" onClick={onCancel} role="dialog" aria-modal="true">
      <div className="nx-admin-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="nx-admin-modal-header">
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: danger ? 'var(--nx-red)' : 'var(--nx-ink)' }}>
              {title}
            </h3>
            <button type="button" className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm" onClick={onCancel}>
              ✕
            </button>
          </div>
          <div className="nx-admin-modal-body">
            {message && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--nx-slate)', lineHeight: 1.5 }}>
                {message}
              </p>
            )}
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--nx-ink)', marginBottom: '0.35rem' }}>
                {inputLabel} {required && <span style={{ color: 'var(--nx-orange)' }}>*</span>}
              </label>
              {multiline ? (
                <textarea
                  className="nx-admin-input"
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder={placeholder}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  className="nx-admin-input"
                  style={{ width: '100%' }}
                  placeholder={placeholder}
                  value={val}
                  onChange={(e) => setVal(e.target.value)}
                  autoFocus
                />
              )}
            </div>
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
              type="submit"
              className={`nx-admin-btn ${danger ? 'nx-admin-btn-danger' : 'nx-admin-btn-primary'}`}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
