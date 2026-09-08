import { useState } from 'react'
import {
  type AdminUserDetail,
  applyModerationAction,
  liftModerationAction,
  addStaffNote,
  revokeUserSession,
  updateUserFlags,
} from '../../../services/admin-api'
import { isPlatformAdmin } from '../../../services/auth-api'
import { UserFlags, hasFlag, enableFlag, disableFlag } from '../../../../shared/flags'

interface UserDetailModalProps {
  readonly detail: AdminUserDetail
  readonly onClose: () => void
  readonly onRefresh: () => void
  readonly showFeedback: (msg: string, type?: 'ok' | 'err') => void
}

export function UserDetailModal({
  detail,
  onClose,
  onRefresh,
  showFeedback,
}: UserDetailModalProps) {
  const { user, notes, moderationActions, sessions } = detail
  const canManageFlags = isPlatformAdmin()

  const [activeTab, setActiveTab] = useState<'moderation' | 'sessions' | 'notes' | 'flags'>('moderation')
  const [modType, setModType] = useState<'ban' | 'mute' | 'friends_block' | 'warn'>('warn')
  const [modReason, setModReason] = useState('')
  const [modDuration, setModDuration] = useState<number>(86400) // 1 day
  const [isSubmittingMod, setIsSubmittingMod] = useState(false)

  const [noteBody, setNoteBody] = useState('')
  const [isSubmittingNote, setIsSubmittingNote] = useState(false)

  const [editFlags, setEditFlags] = useState<number>(user.flags)
  const [isSavingFlags, setIsSavingFlags] = useState(false)

  const handleApplyAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modReason.trim()) {
      showFeedback('Please provide a reason', 'err')
      return
    }
    setIsSubmittingMod(true)
    try {
      await applyModerationAction(user.playerId, {
        actionType: modType,
        reason: modReason.trim(),
        durationSeconds: modDuration > 0 ? modDuration : null,
      })
      showFeedback(`Action ${modType} applied successfully!`, 'ok')
      setModReason('')
      onRefresh()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to apply moderation action', 'err')
    } finally {
      setIsSubmittingMod(false)
    }
  }

  const handleLift = async (actionId?: number, actionType?: string) => {
    const reason = window.prompt('Reason for lifting this restriction:')
    if (!reason || !reason.trim()) return
    try {
      await liftModerationAction(user.playerId, { actionId, actionType, reason: reason.trim() })
      showFeedback('Restriction lifted successfully!', 'ok')
      onRefresh()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to lift restriction', 'err')
    }
  }

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!noteBody.trim()) return
    setIsSubmittingNote(true)
    try {
      await addStaffNote(user.playerId, noteBody.trim())
      showFeedback('Staff note added', 'ok')
      setNoteBody('')
      onRefresh()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to add staff note', 'err')
    } finally {
      setIsSubmittingNote(false)
    }
  }

  const handleRevokeSession = async (token: string) => {
    if (!confirm(token === 'all' ? 'Force logout all active sessions?' : 'Revoke this session?')) return
    try {
      await revokeUserSession(user.playerId, token)
      showFeedback(token === 'all' ? 'All sessions revoked' : 'Session revoked', 'ok')
      onRefresh()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to revoke session', 'err')
    }
  }

  const handleSaveFlags = async () => {
    setIsSavingFlags(true)
    try {
      await updateUserFlags(user.playerId, editFlags, 'Staff panel role update')
      showFeedback('User flags updated!', 'ok')
      onRefresh()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update flags', 'err')
    } finally {
      setIsSavingFlags(false)
    }
  }

  const toggleFlagBit = (bit: number) => {
    setEditFlags((prev) => (hasFlag(prev, bit) ? disableFlag(prev, bit) : enableFlag(prev, bit)))
  }

  return (
    <div className="nx-admin-modal-overlay" onClick={onClose}>
      <div className="nx-admin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="nx-admin-modal-header">
          <div>
            <h3>@{user.username} {user.nickname ? `(${user.nickname})` : ''}</h3>
            <span className="nx-admin-mono" style={{ color: 'var(--nx-slate)' }}>
              Snowflake: {user.displaySnowflakeId || 'None'} · ID: {user.playerId.slice(0, 8)}...
            </span>
          </div>
          <button type="button" className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ padding: '0.75rem 1.25rem 0', display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--nx-line)' }}>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'moderation' ? 'active' : ''}`}
            onClick={() => setActiveTab('moderation')}
          >
            🛡️ Moderation ({moderationActions.length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            🔑 Sessions ({sessions.filter((s) => s.isActive).length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
          >
            📋 Notes ({notes.length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'flags' ? 'active' : ''}`}
            onClick={() => setActiveTab('flags')}
          >
            🏷️ Flags
          </button>
        </div>

        <div className="nx-admin-modal-body">
          {activeTab === 'moderation' && (
            <div>
              <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--nx-paper)', borderRadius: '6px' }}>
                <strong>Account Status: </strong>
                {user.accountLocked ? (
                  <span className="nx-admin-badge" data-variant="red">BANNED / LOCKED</span>
                ) : (
                  <span className="nx-admin-badge" data-variant="green">ACTIVE</span>
                )}
                {user.accountLocked && (
                  <button
                    type="button"
                    className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                    style={{ marginLeft: '0.5rem' }}
                    onClick={() => handleLift(undefined, 'ban')}
                  >
                    Lift Ban
                  </button>
                )}
              </div>

              <form onSubmit={handleApplyAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    className="nx-admin-select"
                    value={modType}
                    onChange={(e) => setModType(e.target.value as any)}
                  >
                    <option value="warn">Warn User</option>
                    <option value="mute">Mute (Suspend DM)</option>
                    <option value="friends_block">Block Friends</option>
                    <option value="ban">Ban (Lock Account)</option>
                  </select>
                  <select
                    className="nx-admin-select"
                    value={modDuration}
                    onChange={(e) => setModDuration(Number(e.target.value))}
                  >
                    <option value={3600}>1 Hour</option>
                    <option value={86400}>1 Day</option>
                    <option value={604800}>7 Days</option>
                    <option value={2592000}>30 Days</option>
                    <option value={0}>Permanent</option>
                  </select>
                </div>
                <input
                  type="text"
                  className="nx-admin-input"
                  placeholder="Reason for moderation action..."
                  value={modReason}
                  onChange={(e) => setModReason(e.target.value)}
                />
                <button
                  type="submit"
                  className="nx-admin-btn nx-admin-btn-danger"
                  disabled={isSubmittingMod}
                >
                  {isSubmittingMod ? 'Applying...' : `Apply ${modType}`}
                </button>
              </form>

              <h4>History</h4>
              {moderationActions.length === 0 ? (
                <p style={{ color: 'var(--nx-slate)' }}>No moderation actions on record.</p>
              ) : (
                <div className="nx-admin-table-wrap">
                  <table className="nx-admin-table">
                    <thead>
                      <tr>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Lift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moderationActions.map((a) => (
                        <tr key={a.id}>
                          <td><strong>{a.actionType}</strong></td>
                          <td>{a.reason}</td>
                          <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                          <td>{a.revokedAt ? 'Revoked' : 'Active'}</td>
                          <td>
                            {!a.revokedAt && (
                              <button
                                type="button"
                                className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                                onClick={() => handleLift(a.id, a.actionType)}
                              >
                                Lift
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {activeTab === 'sessions' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center' }}>
                <p style={{ margin: 0 }}>Active and recent sessions</p>
                <button
                  type="button"
                  className="nx-admin-btn nx-admin-btn-danger nx-admin-btn-sm"
                  onClick={() => handleRevokeSession('all')}
                >
                  Force Logout All
                </button>
              </div>
              <div className="nx-admin-table-wrap">
                <table className="nx-admin-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Expires</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s) => (
                      <tr key={s.token}>
                        <td>
                          {s.isActive ? (
                            <span className="nx-admin-badge" data-variant="green">Active</span>
                          ) : (
                            <span className="nx-admin-badge" data-variant="neutral">Revoked</span>
                          )}
                        </td>
                        <td>{new Date(s.createdAt).toLocaleString()}</td>
                        <td>{new Date(s.expiresAt).toLocaleDateString()}</td>
                        <td>
                          {s.isActive && (
                            <button
                              type="button"
                              className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                              onClick={() => handleRevokeSession(s.token)}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'notes' && (
            <div>
              <form onSubmit={handleAddNote} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  className="nx-admin-input"
                  style={{ flex: 1 }}
                  placeholder="Add confidential staff note..."
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                />
                <button type="submit" className="nx-admin-btn nx-admin-btn-primary" disabled={isSubmittingNote}>
                  Add Note
                </button>
              </form>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notes.map((n) => (
                  <div key={n.id} style={{ background: 'var(--nx-paper)', padding: '0.75rem', borderRadius: '6px' }}>
                    <p style={{ margin: '0 0 0.25rem', color: 'var(--nx-ink)' }}>{n.body}</p>
                    <span style={{ fontSize: '0.75rem', color: 'var(--nx-slate)' }}>
                      {new Date(n.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'flags' && (
            <div>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: 'var(--nx-slate)' }}>
                {canManageFlags
                  ? 'PLATFORM_ADMIN capability: grant or revoke entitlement and role bits.'
                  : 'Read-only view (PLATFORM_ADMIN flag required to edit).'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                {Object.entries(UserFlags)
                  .filter(([name, bit]) => typeof bit === 'number' && bit > 0 && name !== 'NONE')
                  .map(([name, bit]) => {
                    const isChecked = hasFlag(editFlags, bit as number)
                    return (
                      <label
                        key={name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          background: isChecked ? 'var(--nx-orange-tint)' : 'var(--nx-paper)',
                          padding: '0.5rem',
                          borderRadius: '6px',
                          cursor: canManageFlags ? 'pointer' : 'default',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={!canManageFlags}
                          onChange={() => toggleFlagBit(bit as number)}
                        />
                        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{name}</span>
                      </label>
                    )
                  })}
              </div>
              {canManageFlags && (
                <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="nx-admin-btn nx-admin-btn-primary"
                    onClick={handleSaveFlags}
                    disabled={isSavingFlags || editFlags === user.flags}
                  >
                    {isSavingFlags ? 'Saving...' : 'Save Flags'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
