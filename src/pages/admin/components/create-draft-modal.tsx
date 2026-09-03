import { useState } from 'react'

interface CreateDraftModalProps {
  readonly isOpen: boolean
  readonly onClose: () => void
  readonly onSubmit: (input: { globalVersion: string; title: string; headline: string }) => Promise<void>
}

export function CreateDraftModal({ isOpen, onClose, onSubmit }: CreateDraftModalProps) {
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('')
  const [headline, setHeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const isHeadlineOver = headline.length > 80

  const handleCreate = async () => {
    if (!version.trim() || !title.trim() || !headline.trim()) {
      setError('Please fill in version, title, and headline.')
      return
    }
    if (isHeadlineOver) {
      setError('Headline cannot exceed 80 characters.')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        globalVersion: version.trim(),
        title: title.trim(),
        headline: headline.trim(),
      })
      setVersion('')
      setTitle('')
      setHeadline('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create draft')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="nx-modal-overlay">
      <div className="nx-modal-card">
        <h2 className="nx-modal-title">Create New Update Draft</h2>
        <div className="nx-form-group">
          <label className="nx-form-label">Global Version (e.g. 0.3.0)</label>
          <input
            className="nx-form-input"
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            placeholder="0.3.0"
          />
        </div>
        <div className="nx-form-group">
          <label className="nx-form-label">Release Title</label>
          <input
            className="nx-form-input"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Mechanics tuning and engine updates"
          />
        </div>
        <div className="nx-form-group">
          <div className="nx-label-row">
            <label className="nx-form-label">Top Banner Headline (&le; 80 chars)</label>
            <span className="nx-char-counter" data-over-limit={isHeadlineOver ? 'true' : undefined}>
              {headline.length}/80
            </span>
          </div>
          <input
            className="nx-form-input"
            type="text"
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Short announcement CTA for top banner"
            maxLength={90}
          />
        </div>

        {error && <div className="nx-form-error">⚠️ {error}</div>}

        <div className="nx-modal-actions">
          <button type="button" className="nx-btn nx-btn-secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="nx-btn nx-btn-primary"
            onClick={() => void handleCreate()}
            disabled={submitting || isHeadlineOver}
          >
            {submitting ? 'Creating...' : 'Create Draft'}
          </button>
        </div>
      </div>
    </div>
  )
}
