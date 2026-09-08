import { useState } from 'react'
import type { AdminUserDetail } from '../../../../services/admin-api'
import { addStaffNote } from '../../../../services/admin-api'

interface NotesTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

export function NotesTab({ detail, onRefresh, showToast }: NotesTabProps) {
  const { user, notes } = detail
  const [noteBody, setNoteBody] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    setIsSubmittingNote(true)
    try {
      await addStaffNote(user.playerId, noteBody.trim())
      showToast('Staff note recorded', 'ok')
      setNoteBody('')
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to add staff note', 'err')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          className="nx-admin-input"
          style={{ flex: 1 }}
          placeholder="Record confidential staff note..."
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
        />
        <button type="submit" className="nx-admin-btn nx-admin-btn-primary" disabled={isSubmittingNote}>
          Add Note
        </button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {notes.length === 0 ? (
          <span className="nx-admin-hint">No staff notes on file for this account.</span>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              style={{
                background: 'var(--nx-paper)',
                border: '1px solid var(--nx-line)',
                padding: '0.75rem',
                borderRadius: '6px',
              }}
            >
              <p
                style={{
                  margin: '0 0 0.25rem',
                  color: 'var(--nx-ink)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.4,
                }}
              >
                {n.body}
              </p>
              <span style={{ fontSize: '0.7rem', color: 'var(--nx-slate)' }}>
                {new Date(n.createdAt).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
