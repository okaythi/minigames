import { useState, useEffect } from 'react'
import { isUsersAdmin, subscribeAuth } from '../../services/auth-api'
import {
  fetchAdminUsers,
  fetchAdminUser,
  fetchModerationReports,
  resolveModerationReport,
  type AdminUserListItem,
  type AdminUserDetail,
  type ModerationReportItem,
} from '../../services/admin-api'
import { AdminNavBar } from './components/admin-nav-bar'
import { AdminRestrictedCard } from './components/admin-restricted-card'
import { UserDetailModal } from './components/user-detail-modal'
import { ModerationReportsTable } from './components/moderation-reports-table'
import { FeedbackToast, type ToastMessage } from '../../components/ui/feedback-toast'
import './admin-common.css'

export function AdminUsersPage() {
  const [authorized, setAuthorized] = useState<boolean>(isUsersAdmin())
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users')

  // Users Directory state
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null)

  // Reports state
  const [reports, setReports] = useState<ModerationReportItem[]>([])
  const [reportFilter, setReportFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [loadingReports, setLoadingReports] = useState(false)

  // Native toast feedback
  const [toast, setToast] = useState<ToastMessage | null>(null)

  useEffect(() => {
    setAuthorized(isUsersAdmin())
    return subscribeAuth(() => {
      setAuthorized(isUsersAdmin())
    })
  }, [])

  const showToast = (message: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    setToast({ id: String(Date.now()), message, type })
  }

  const loadUsers = async () => {
    setLoadingUsers(true)
    try {
      const res = await fetchAdminUsers({
        q: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      })
      setUsers(res.users)
      setTotalUsers(res.total)
    } catch (err: any) {
      showToast(err.message || 'Failed to load user directory', 'err')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadReports = async () => {
    setLoadingReports(true)
    try {
      const res = await fetchModerationReports({ status: reportFilter, limit: 50 })
      setReports(res.reports)
    } catch (err: any) {
      showToast(err.message || 'Failed to load moderation reports', 'err')
    } finally {
      setLoadingReports(false)
    }
  }

  useEffect(() => {
    if (!authorized) return
    if (activeTab === 'users') {
      void loadUsers()
    } else {
      void loadReports()
    }
  }, [authorized, activeTab, statusFilter, reportFilter])

  const openUserDetail = async (id: string) => {
    try {
      const detail = await fetchAdminUser(id)
      setSelectedUserDetail(detail)
    } catch (err: any) {
      showToast(err.message || 'Failed to load user details', 'err')
    }
  }

  const handleResolveReport = async (reportId: string, action: string) => {
    try {
      await resolveModerationReport(reportId, { resolutionAction: action })
      showToast('Report resolved successfully', 'ok')
      void loadReports()
    } catch (err: any) {
      showToast(err.message || 'Failed to resolve report', 'err')
    }
  }

  if (!authorized) {
    return (
      <AdminRestrictedCard
        title="Users Administration Access Required"
        requiredFlags="USERS_ADMIN"
        panelName="Users & Moderation Management"
      />
    )
  }

  const activeCount = users.filter((u) => !u.accountLocked).length
  const lockedCount = users.filter((u) => u.accountLocked).length
  const openReportsCount = reports.filter((r) => r.status === 'open').length

  return (
    <div className="nx-page nx-admin-layout">
      <div className="nx-admin-header">
        <div className="nx-admin-header-title">
          <h1>Users &amp; Moderation</h1>
          <p>Inspect accounts, enforce discipline, view active sessions, and review player reports.</p>
        </div>
        <AdminNavBar activeTab="users" />
      </div>

      <div className="nx-admin-stats-grid">
        <div className="nx-admin-stat-card">
          <span className="nx-admin-stat-card-label">Total Accounts</span>
          <span className="nx-admin-stat-card-value">{totalUsers}</span>
        </div>
        <div className="nx-admin-stat-card">
          <span className="nx-admin-stat-card-label">Active (Sample)</span>
          <span className="nx-admin-stat-card-value">{activeCount}</span>
        </div>
        <div className="nx-admin-stat-card">
          <span className="nx-admin-stat-card-label">Banned / Locked</span>
          <span className="nx-admin-stat-card-value" style={{ color: lockedCount > 0 ? 'var(--nx-red)' : undefined }}>
            {lockedCount}
          </span>
        </div>
        <div className="nx-admin-stat-card">
          <span className="nx-admin-stat-card-label">Open Reports</span>
          <span className="nx-admin-stat-card-value" style={{ color: openReportsCount > 0 ? 'var(--nx-orange)' : undefined }}>
            {openReportsCount}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--nx-line)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          User Directory ({totalUsers})
        </button>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          Moderation Reports ({openReportsCount} Open)
        </button>
      </div>

      {activeTab === 'users' ? (
        <div className="nx-admin-card">
          <div className="nx-admin-toolbar">
            <input
              type="text"
              className="nx-admin-input"
              placeholder="Search username, player ID, or snowflake..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void loadUsers()}
              style={{ minWidth: '320px' }}
            />
            <select
              className="nx-admin-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'banned')}
            >
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned / Locked Only</option>
            </select>
            <button
              type="button"
              className="nx-admin-btn nx-admin-btn-primary"
              onClick={loadUsers}
              disabled={loadingUsers}
            >
              {loadingUsers ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Snowflake ID</th>
                  <th>Status</th>
                  <th>Flags</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--nx-slate)' }}>
                      {loadingUsers ? 'Loading accounts...' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.playerId}>
                      <td>
                        <strong>@{u.username}</strong>
                        {u.nickname && (
                          <span style={{ color: 'var(--nx-slate)', marginLeft: '0.35rem', fontSize: '0.8125rem' }}>
                            ({u.nickname})
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="nx-admin-mono">{u.displaySnowflakeId || '—'}</span>
                      </td>
                      <td>
                        {u.accountLocked ? (
                          <span className="nx-admin-badge" data-variant="red">
                            LOCKED
                          </span>
                        ) : (
                          <span className="nx-admin-badge" data-variant="green">
                            ACTIVE
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="nx-admin-mono">{u.flags}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                          {new Date(u.createdOn * 1000).toLocaleDateString()}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                          onClick={() => openUserDetail(u.playerId)}
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <ModerationReportsTable
          reports={reports}
          loading={loadingReports}
          reportFilter={reportFilter}
          onFilterChange={setReportFilter}
          onRefresh={loadReports}
          onResolve={handleResolveReport}
          onOpenUser={openUserDetail}
        />
      )}

      {selectedUserDetail && (
        <UserDetailModal
          detail={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onRefresh={() => openUserDetail(selectedUserDetail.user.playerId)}
          showFeedback={(msg, type) => showToast(msg, type === 'err' ? 'err' : 'ok')}
        />
      )}

      <FeedbackToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
