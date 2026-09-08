import { useState } from 'react'
import {
  type AdminUserDetail,
  scheduleUserDeletion,
  cancelUserDeletion,
  deleteUserImmediate,
  resetUserDismissable,
} from '../../../../services/admin-api'
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog'
import { PromptDialog } from '../../../../components/ui/prompt-dialog'

interface LifecycleTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly onClose: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

export function LifecycleTab({ detail, onRefresh, onClose, showToast }: LifecycleTabProps) {
  const { user, dismissables = [] } = detail

  // Scheduled deletion states
  const [scheduleDays, setScheduleDays] = useState<number>(14)
  const [scheduleReason, setScheduleReason] = useState('')
  const [isScheduling, setIsScheduling] = useState(false)

  // Dialog states
  const [showCancelPrompt, setShowCancelPrompt] = useState(false)
  const [showImmediateDeleteDialog, setShowImmediateDeleteDialog] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const handleScheduleDeletion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleReason.trim()) {
      showToast('A reason is required to schedule account deletion', 'err')
      return
    }

    setIsScheduling(true)
    try {
      const scheduledAt = Date.now() + scheduleDays * 86400 * 1000
      await scheduleUserDeletion(user.playerId, { scheduledAt, reason: scheduleReason.trim() })
      showToast(`Account scheduled for deletion in ${scheduleDays} days`, 'ok')
      setScheduleReason('')
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to schedule deletion', 'err')
    } finally {
      setIsScheduling(false)
    }
  }

  const handleCancelDeletion = async (reason: string) => {
    try {
      await cancelUserDeletion(user.playerId, reason)
      showToast('Scheduled deletion cancelled successfully', 'ok')
      setShowCancelPrompt(false)
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to cancel deletion', 'err')
    }
  }

  const handleImmediateDelete = async () => {
    if (!deleteReason.trim()) {
      showToast('Audit reason is required for immediate deletion', 'err')
      return
    }

    try {
      await deleteUserImmediate(user.playerId, user.username, deleteReason.trim())
      showToast(`User @${user.username} has been permanently purged`, 'ok')
      setShowImmediateDeleteDialog(false)
      onClose()
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user', 'err')
    }
  }

  const handleResetDismissable = async (key: string) => {
    try {
      await resetUserDismissable(user.playerId, key)
      showToast(`Dismissed state '${key}' has been reset for the user`, 'ok')
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to reset dismissable', 'err')
    }
  }

  const isDeletionScheduled = !!user.scheduledDeletionAt && user.scheduledDeletionAt > Date.now()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* 1. Scheduled Deletion Lifecycle */}
      <div className="nx-admin-card" style={{ padding: '1rem', borderLeft: isDeletionScheduled ? '4px solid var(--nx-orange)' : undefined }}>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem' }}>Scheduled Account Deletion</h4>
        {isDeletionScheduled ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ padding: '0.75rem', background: 'var(--nx-paper)', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span className="nx-admin-badge" data-variant="orange">DELETION SCHEDULED</span>
                <span className="nx-admin-mono" style={{ fontSize: '0.8125rem' }}>
                  Executes: {new Date(user.scheduledDeletionAt!).toLocaleDateString()}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                Reason: {user.scheduledDeletionReason || 'No reason specified'}
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="nx-admin-btn nx-admin-btn-secondary"
                onClick={() => setShowCancelPrompt(true)}
              >
                Cancel Scheduled Deletion
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleScheduleDeletion} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
              Set a future deletion date. The user will receive an in-app notice and their account will be queued for automated purge.
            </p>
            <div className="nx-admin-form-row">
              <div className="nx-admin-form-group">
                <label className="nx-admin-label">Grace Period Preset</label>
                <select
                  className="nx-admin-select"
                  value={scheduleDays}
                  onChange={(e) => setScheduleDays(Number(e.target.value))}
                >
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days</option>
                  <option value={30}>30 Days</option>
                  <option value={60}>60 Days</option>
                </select>
              </div>
              <div className="nx-admin-form-group" style={{ flex: 2 }}>
                <label className="nx-admin-label">Reason for Deletion Schedule</label>
                <input
                  type="text"
                  className="nx-admin-input"
                  placeholder="e.g. Inactivity request; Terms of service violation grace"
                  value={scheduleReason}
                  onChange={(e) => setScheduleReason(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="submit"
                className="nx-admin-btn nx-admin-btn-secondary"
                disabled={isScheduling || !scheduleReason.trim()}
              >
                {isScheduling ? 'Scheduling...' : `Queue Deletion (${scheduleDays}d)`}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. Dismissables Management */}
      <div className="nx-admin-card" style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h4 style={{ margin: 0, fontSize: '0.9375rem' }}>User Dismissables & Hint Banners</h4>
          {dismissables.length > 0 && (
            <button
              type="button"
              className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
              onClick={() => handleResetDismissable('all')}
            >
              Reset All Hints
            </button>
          )}
        </div>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
          Dismissed in-app announcements, patch highlights, or onboarding hints. Resetting forces them to show again for this user.
        </p>
        {dismissables.length === 0 ? (
          <span className="nx-admin-hint">User has not dismissed any banners or hints yet.</span>
        ) : (
          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>Dismissed Key</th>
                  <th>Dismissed At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {dismissables.map((d) => (
                  <tr key={d.key}>
                    <td className="nx-admin-mono">{d.key}</td>
                    <td>{new Date(d.dismissedAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        type="button"
                        className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                        onClick={() => handleResetDismissable(d.key)}
                      >
                        Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3. Immediate Hard Deletion Danger Zone */}
      <div className="nx-admin-danger-box">
        <h4 style={{ margin: 0, color: 'var(--nx-red)', fontSize: '0.9375rem' }}>Danger Zone: Immediate Hard Deletion</h4>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--nx-slate)', lineHeight: 1.4 }}>
          Permanently purges this user account from the database, cascades removal of all active sessions, user notifications, staff notes, and records. This action cannot be reversed.
        </p>
        <div className="nx-admin-form-group">
          <label className="nx-admin-label" style={{ color: 'var(--nx-red)' }}>Immediate Deletion Audit Reason</label>
          <input
            type="text"
            className="nx-admin-input"
            placeholder="e.g., GDPR Right to be Forgotten compliance request"
            value={deleteReason}
            onChange={(e) => setDeleteReason(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="nx-admin-btn nx-admin-btn-danger"
            disabled={!deleteReason.trim()}
            onClick={() => setShowImmediateDeleteDialog(true)}
          >
            Permanently Delete User Account
          </button>
        </div>
      </div>

      <PromptDialog
        isOpen={showCancelPrompt}
        title="Cancel Scheduled Deletion"
        message="Please provide an administrative reason for stopping the scheduled deletion. This will be audited and notified to the user."
        inputLabel="Cancellation Reason"
        placeholder="e.g. Account reinstated by security review"
        confirmLabel="Confirm Cancellation"
        onSubmit={handleCancelDeletion}
        onCancel={() => setShowCancelPrompt(false)}
      />

      <ConfirmDialog
        isOpen={showImmediateDeleteDialog}
        title="Confirm Immediate Hard Deletion"
        message={
          <div>
            <p style={{ margin: '0 0 0.5rem' }}>
              Are you absolutely certain you want to permanently delete user <strong>@{user.username}</strong>?
            </p>
            <p style={{ margin: 0, color: 'var(--nx-red)', fontWeight: 600 }}>
              All user data, sessions, notifications, and notes will be deleted immediately.
            </p>
          </div>
        }
        danger={true}
        confirmLabel="Permanently Delete Account"
        requireMatch={user.username}
        matchPlaceholder={user.username}
        onConfirm={handleImmediateDelete}
        onCancel={() => setShowImmediateDeleteDialog(false)}
      />
    </div>
  )
}
