import { useState } from 'react'
import {
  type AdminUserDetail,
  applyModerationAction,
  liftModerationAction,
} from '../../../../services/admin-api'
import { PromptDialog } from '../../../../components/ui/prompt-dialog'

interface ModerationTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

export function ModerationTab({ detail, onRefresh, showToast }: ModerationTabProps) {
  const { user, moderationActions } = detail
  const [modType, setModType] = useState<'ban' | 'mute' | 'friends_block' | 'warn'>('warn')
  const [modReason, setModReason] = useState('')
  const [modDuration, setModDuration] = useState<number>(86400)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // PromptDialog state for lifting restrictions
  const [liftTarget, setLiftTarget] = useState<{ actionId?: number; actionType?: string } | null>(null)

  const handleApplyAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modReason.trim()) {
      showToast('A reason is strictly required for moderation actions', 'err')
      return
    }

    setIsSubmitting(true)
    try {
      await applyModerationAction(user.playerId, {
        actionType: modType,
        reason: modReason.trim(),
        durationSeconds: modDuration > 0 ? modDuration : null,
      })
      showToast(`Action '${modType}' applied successfully`, 'ok')
      setModReason('')
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to apply moderation action', 'err')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmLift = async (reason: string) => {
    if (!liftTarget) return
    try {
      await liftModerationAction(user.playerId, {
        actionId: liftTarget.actionId,
        actionType: liftTarget.actionType,
        reason: reason.trim(),
      })
      showToast('Restriction lifted and recorded in audit ledger', 'ok')
      setLiftTarget(null)
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to lift restriction', 'err')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1rem',
          background: 'var(--nx-paper)',
          borderRadius: '6px',
          border: '1px solid var(--nx-line)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Account Standing:</span>
          {user.accountLocked ? (
            <span className="nx-admin-badge" data-variant="red">LOCKED / SUSPENDED</span>
          ) : (
            <span className="nx-admin-badge" data-variant="green">ACTIVE</span>
          )}
        </div>
        {user.accountLocked && (
          <button
            type="button"
            className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
            onClick={() => setLiftTarget({ actionType: 'ban' })}
          >
            Lift Suspension
          </button>
        )}
      </div>

      <form onSubmit={handleApplyAction} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.875rem' }}>Enforce Moderation Action</h4>
        <div className="nx-admin-form-row">
          <div className="nx-admin-form-group">
            <label className="nx-admin-label">Action Type</label>
            <select
              className="nx-admin-select"
              value={modType}
              onChange={(e) => setModType(e.target.value as any)}
            >
              <option value="warn">Formal Warning</option>
              <option value="mute">Mute (Suspend Messages)</option>
              <option value="friends_block">Block Friend Interactions</option>
              <option value="ban">Account Suspension (Lock Account)</option>
            </select>
          </div>
          <div className="nx-admin-form-group">
            <label className="nx-admin-label">Duration</label>
            <select
              className="nx-admin-select"
              value={modDuration}
              onChange={(e) => setModDuration(Number(e.target.value))}
            >
              <option value={3600}>1 Hour</option>
              <option value={86400}>24 Hours (1 Day)</option>
              <option value={604800}>7 Days</option>
              <option value={2592000}>30 Days</option>
              <option value={0}>Permanent</option>
            </select>
          </div>
        </div>

        <div className="nx-admin-form-group">
          <label className="nx-admin-label">Reason (Dispatched to user as notification, except for bans)</label>
          <input
            type="text"
            className="nx-admin-input"
            placeholder="Specify reason for moderation action..."
            value={modReason}
            onChange={(e) => setModReason(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="submit"
            className={`nx-admin-btn ${modType === 'ban' ? 'nx-admin-btn-danger' : 'nx-admin-btn-primary'}`}
            disabled={isSubmitting || !modReason.trim()}
          >
            {isSubmitting ? 'Applying...' : `Enforce ${modType.toUpperCase()}`}
          </button>
        </div>
      </form>

      <div style={{ borderTop: '1px solid var(--nx-line)', paddingTop: '1rem' }}>
        <h4 style={{ margin: '0 0 0.75rem', fontSize: '0.875rem' }}>Action History</h4>
        {moderationActions.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>No moderation actions recorded for this user.</p>
        ) : (
          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {moderationActions.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <span className="nx-admin-badge" data-variant={a.actionType === 'ban' ? 'red' : 'orange'}>
                        {a.actionType.toUpperCase()}
                      </span>
                    </td>
                    <td>{a.reason}</td>
                    <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td>
                      {a.revokedAt ? (
                        <span className="nx-admin-badge" data-variant="neutral">Lifted</span>
                      ) : a.expiresAt && a.expiresAt < Date.now() ? (
                        <span className="nx-admin-badge" data-variant="neutral">Expired</span>
                      ) : (
                        <span className="nx-admin-badge" data-variant="red">Active</span>
                      )}
                    </td>
                    <td>
                      {!a.revokedAt && (!a.expiresAt || a.expiresAt > Date.now()) && (
                        <button
                          type="button"
                          className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                          onClick={() => setLiftTarget({ actionId: a.id, actionType: a.actionType })}
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

      <PromptDialog
        isOpen={liftTarget !== null}
        title={`Lift ${liftTarget?.actionType?.toUpperCase() || 'Restriction'}`}
        message="Please state the administrative reason for lifting this restriction. This reason will be audited and notified to the user."
        inputLabel="Lift Reason"
        placeholder="e.g., User appealed restriction; resolved via support ticket"
        confirmLabel="Lift Restriction"
        onSubmit={handleConfirmLift}
        onCancel={() => setLiftTarget(null)}
      />
    </div>
  )
}
