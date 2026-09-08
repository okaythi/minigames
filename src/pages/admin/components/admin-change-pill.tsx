import type { FormEvent } from 'react'
import './admin-change-pill.css'

export interface AdminChangePillProps {
  readonly hasChanges: boolean
  readonly isSaving?: boolean | undefined
  readonly onSave: () => void | Promise<void>
  readonly onDiscard: () => void
  readonly saveLabel?: string | undefined
  readonly discardLabel?: string | undefined
  readonly message?: string | undefined
  readonly auditReason?: string | undefined
  readonly onAuditReasonChange?: ((val: string) => void) | undefined
  readonly auditPlaceholder?: string | undefined
}

export function AdminChangePill({
  hasChanges,
  isSaving = false,
  onSave,
  onDiscard,
  saveLabel = 'Save Changes',
  discardLabel = 'Discard',
  message = 'Unsaved changes',
  auditReason,
  onAuditReasonChange,
  auditPlaceholder = 'Audit reason (optional)...',
}: AdminChangePillProps) {
  if (!hasChanges && !isSaving) {
    return null
  }

  const handleSaveClick = (e: React.MouseEvent | FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSaving) return
    void onSave()
  }

  const handleDiscardClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isSaving) return
    onDiscard()
  }

  return (
    <div
      className="nx-change-pill-dock"
      data-visible={hasChanges || isSaving ? 'true' : 'false'}
      role="region"
      aria-label="Unsaved changes dock"
    >
      <div className="nx-change-pill-status">
        <span className="nx-change-pill-dot" aria-hidden="true" />
        <span>{message}</span>
      </div>

      {onAuditReasonChange && (
        <input
          type="text"
          className="nx-change-pill-input"
          placeholder={auditPlaceholder}
          value={auditReason || ''}
          onChange={(e) => onAuditReasonChange(e.target.value)}
          disabled={isSaving}
        />
      )}

      <div className="nx-change-pill-actions">
        <button
          type="button"
          className="nx-pill-btn nx-pill-btn-discard"
          onClick={handleDiscardClick}
          disabled={isSaving}
        >
          {discardLabel}
        </button>
        <button
          type="button"
          className="nx-pill-btn nx-pill-btn-save"
          onClick={handleSaveClick}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )
}
