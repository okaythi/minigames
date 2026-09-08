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
import './admin-common.css'

export function AdminUsersPage() {
  const [authorized, setAuthorized] = useState<boolean>(isUsersAdmin())
  const [activeTab, setActiveTab] = useState<'users' | 'reports'>('users')

  // Users Directory state
  const [users, setUsers] = useState<AdminUserListItem[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'banned'>('all')
  const [loading, setLoading] = useState(false)
  const [selectedUserDetail, setSelectedUserDetail] = useState<AdminUserDetail | null>(null)

  // Reports state
  const [reports, setReports] = useState<ModerationReportItem[]>([])
  const [reportFilter, setReportFilter] = useState<'open' | 'resolved' | 'all'>('open')
  const [loadingReports, setLoadingReports] = useState(false)

  // Feedback banner
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    setAuthorized(isUsersAdmin())
    return subscribeAuth(() => {
      setAuthorized(isUsersAdmin())
    })
  }, [])

  const showFeedback = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await fetchAdminUsers({
        q: searchQuery,
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 50,
      })
      setUsers(res.users)
      setTotalUsers(res.total)
    } catch (err: any) {
      showFeedback(err.message || 'Failed to load users', 'err')
    } finally {
      setLoading(false)
    }
  }

  const loadReports = async () => {
    setLoadingReports(true)
    try {
      const res = await fetchModerationReports({ status: reportFilter, limit: 50 })
      setReports(res.reports)
    } catch (err: any) {
      showFeedback(err.message || 'Failed to load reports', 'err')
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
      showFeedback(err.message || 'Failed to load user details', 'err')
    }
  }

  const handleResolveReport = async (reportId: string) => {
    const action = window.prompt('Resolution action taken (e.g. "Warned user", "Account locked", "No action needed"):')
    if (!action || !action.trim()) return
    try {
      await resolveModerationReport(reportId, { resolutionAction: action.trim() })
      showFeedback('Report resolved!', 'ok')
      void loadReports()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to resolve report', 'err')
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

  return (
    <div className="nx-page nx-admin-layout">
      <div className="nx-admin-header">
        <div className="nx-admin-header-title">
          <h1>Users & Moderation</h1>
          <p>Inspect accounts, enforce discipline, view active sessions, and review player reports.</p>
        </div>
        <AdminNavBar activeTab="users" />
      </div>

      {feedback && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '6px',
            background: feedback.type === 'ok' ? 'rgba(31, 157, 91, 0.1)' : 'rgba(216, 67, 61, 0.1)',
            color: feedback.type === 'ok' ? 'var(--nx-green-deep)' : 'var(--nx-red)',
            fontWeight: 600,
          }}
        >
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--nx-line)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 User Directory ({totalUsers})
        </button>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          🚨 Moderation Reports ({reports.filter((r) => r.status === 'open').length} Open)
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
              style={{ minWidth: '300px' }}
            />
            <select
              className="nx-admin-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
            >
              <option value="all">All Accounts</option>
              <option value="active">Active Only</option>
              <option value="banned">Banned / Locked Only</option>
            </select>
            <button type="button" className="nx-admin-btn nx-admin-btn-primary" onClick={loadUsers} disabled={loading}>
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Snowflake ID</th>
                  <th>Status</th>
                  <th>Flags Bitmask</th>
                  <th>Joined</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--nx-slate)' }}>
                      {loading ? 'Loading users...' : 'No users found.'}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.playerId}>
                      <td>
                        <strong>@{u.username}</strong>
                        {u.nickname && <span style={{ color: 'var(--nx-slate)', marginLeft: '0.25rem' }}>({u.nickname})</span>}
                      </td>
                      <td>
                        <span className="nx-admin-mono">{u.displaySnowflakeId || '—'}</span>
                      </td>
                      <td>
                        {u.accountLocked ? (
                          <span className="nx-admin-badge" data-variant="red">BANNED</span>
                        ) : (
                          <span className="nx-admin-badge" data-variant="green">Active</span>
                        )}
                      </td>
                      <td>
                        <span className="nx-admin-mono">{u.flags}</span>
                      </td>
                      <td>{new Date(u.createdOn * 1000).toLocaleDateString()}</td>
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
        <div className="nx-admin-card">
          <div className="nx-admin-toolbar">
            <select
              className="nx-admin-select"
              value={reportFilter}
              onChange={(e) => setReportFilter(e.target.value as any)}
            >
              <option value="open">Open Reports</option>
              <option value="resolved">Resolved Reports</option>
              <option value="all">All Reports</option>
            </select>
            <button type="button" className="nx-admin-btn nx-admin-btn-secondary" onClick={loadReports} disabled={loadingReports}>
              Refresh
            </button>
          </div>

          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Reported User</th>
                  <th>Reporter</th>
                  <th>Reason</th>
                  <th>Details</th>
                  <th>Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--nx-slate)' }}>
                      {loadingReports ? 'Loading reports...' : 'No reports found.'}
                    </td>
                  </tr>
                ) : (
                  reports.map((r) => (
                    <tr key={r.id}>
                      <td>
                        {r.status === 'open' ? (
                          <span className="nx-admin-badge" data-variant="orange">Open</span>
                        ) : (
                          <span className="nx-admin-badge" data-variant="green">Resolved</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                          onClick={() => openUserDetail(r.reportedUserId)}
                        >
                          @{r.reportedUsername}
                        </button>
                      </td>
                      <td>@{r.reporterUsername}</td>
                      <td><strong>{r.reason}</strong></td>
                      <td style={{ maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.details || '—'}
                      </td>
                      <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                      <td>
                        {r.status === 'open' ? (
                          <button
                            type="button"
                            className="nx-admin-btn nx-admin-btn-primary nx-admin-btn-sm"
                            onClick={() => handleResolveReport(r.id)}
                          >
                            Resolve
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--nx-slate)' }}>
                            {r.resolutionAction}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedUserDetail && (
        <UserDetailModal
          detail={selectedUserDetail}
          onClose={() => setSelectedUserDetail(null)}
          onRefresh={() => openUserDetail(selectedUserDetail.user.playerId)}
          showFeedback={showFeedback}
        />
      )}
    </div>
  )
}
