import { useState } from 'react'
import type { AdminUserDetail } from '../../../../services/admin-api'
import { revokeUserSession } from '../../../../services/admin-api'
import { ConfirmDialog } from '../../../../components/ui/confirm-dialog'

interface SessionsTabProps {
  readonly detail: AdminUserDetail
  readonly onRefresh: () => void
  readonly showToast: (msg: string, type?: 'ok' | 'err') => void
}

export function SessionsTab({ detail, onRefresh, showToast }: SessionsTabProps) {
  const { user, sessions } = detail
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null)

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return
    try {
      await revokeUserSession(user.playerId, revokeTarget)
      showToast(revokeTarget === 'all' ? 'All active sessions terminated' : 'Session revoked', 'ok')
      setRevokeTarget(null)
      onRefresh()
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke session', 'err')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
          Active and historical session tokens minted for this account.
        </p>
        <button
          type="button"
          className="nx-admin-btn nx-admin-btn-danger nx-admin-btn-sm"
          onClick={() => setRevokeTarget('all')}
        >
          Force Logout All Sessions
        </button>
      </div>

      <div className="nx-admin-table-wrap">
        <table className="nx-admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Created</th>
              <th>Expires</th>
              <th>IP Hash</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.token}>
                <td>
                  {s.isActive ? (
                    <span className="nx-admin-badge" data-variant="green">
                      Active
                    </span>
                  ) : (
                    <span className="nx-admin-badge" data-variant="neutral">
                      Revoked
                    </span>
                  )}
                </td>
                <td>{new Date(s.createdAt).toLocaleString()}</td>
                <td>{new Date(s.expiresAt).toLocaleDateString()}</td>
                <td className="nx-admin-mono" style={{ fontSize: '0.7rem' }}>
                  {s.ipHash ? `${s.ipHash.slice(0, 12)}...` : 'Unknown'}
                </td>
                <td>
                  {s.isActive && (
                    <button
                      type="button"
                      className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                      onClick={() => setRevokeTarget(s.token)}
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

      <ConfirmDialog
        isOpen={revokeTarget !== null}
        title={revokeTarget === 'all' ? 'Force Logout All Sessions' : 'Revoke Session'}
        message={
          revokeTarget === 'all'
            ? `Terminate all active login sessions for @${user.username}? The user will be immediately logged out across all devices.`
            : 'Revoke this individual session token immediately?'
        }
        danger={true}
        confirmLabel={revokeTarget === 'all' ? 'Force Logout All' : 'Revoke Session'}
        onConfirm={handleConfirmRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
