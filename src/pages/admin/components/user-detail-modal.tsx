import { useState } from 'react'
import type { AdminUserDetail } from '../../../services/admin-api'
import { ProfileTab } from './user-tabs/profile-tab'
import { RolesTab } from './user-tabs/roles-tab'
import { ModerationTab } from './user-tabs/moderation-tab'
import { LifecycleTab } from './user-tabs/lifecycle-tab'
import { SessionsTab } from './user-tabs/sessions-tab'
import { NotesTab } from './user-tabs/notes-tab'

interface UserDetailModalProps {
  readonly detail: AdminUserDetail
  readonly onClose: () => void
  readonly onRefresh: () => void
  readonly showFeedback: (msg: string, type?: 'ok' | 'err') => void
}

type TabKey = 'overview' | 'profile' | 'roles' | 'moderation' | 'sessions' | 'notes' | 'lifecycle'

export function UserDetailModal({
  detail,
  onClose,
  onRefresh,
  showFeedback,
}: UserDetailModalProps) {
  const { user, notes, sessions } = detail
  const [activeTab, setActiveTab] = useState<TabKey>('overview')

  return (
    <div className="nx-admin-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="nx-admin-modal" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="nx-admin-modal-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h3 style={{ margin: 0, fontSize: '1.25rem', letterSpacing: '-0.022em' }}>
                @{user.username} {user.nickname ? `(${user.nickname})` : ''}
              </h3>
              {user.accountLocked ? (
                <span className="nx-admin-badge" data-variant="red">
                  LOCKED
                </span>
              ) : user.scheduledDeletionAt && user.scheduledDeletionAt > Date.now() ? (
                <span className="nx-admin-badge" data-variant="orange">
                  DELETION SCHEDULED
                </span>
              ) : (
                <span className="nx-admin-badge" data-variant="green">
                  ACTIVE
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--nx-slate)' }}>
              <span className="nx-admin-mono">Snowflake: {user.displaySnowflakeId || 'None'}</span>
              <span className="nx-admin-mono">Player ID: {user.playerId.slice(0, 13)}...</span>
              <span>Registered: {new Date(user.createdOn * 1000).toLocaleDateString()}</span>
            </div>
          </div>
          <button type="button" className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Navigation Tab Strip */}
        <div className="nx-admin-modal-tabs" role="tablist">
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
            role="tab"
            aria-selected={activeTab === 'overview'}
          >
            Overview
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
            role="tab"
            aria-selected={activeTab === 'profile'}
          >
            Profile &amp; PII
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
            role="tab"
            aria-selected={activeTab === 'roles'}
          >
            Roles &amp; Flags
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'moderation' ? 'active' : ''}`}
            onClick={() => setActiveTab('moderation')}
            role="tab"
            aria-selected={activeTab === 'moderation'}
          >
            Moderation ({detail.moderationActions.length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
            role="tab"
            aria-selected={activeTab === 'sessions'}
          >
            Sessions ({sessions.filter((s) => s.isActive).length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'notes' ? 'active' : ''}`}
            onClick={() => setActiveTab('notes')}
            role="tab"
            aria-selected={activeTab === 'notes'}
          >
            Staff Notes ({notes.length})
          </button>
          <button
            type="button"
            className={`nx-admin-nav-tab ${activeTab === 'lifecycle' ? 'active' : ''}`}
            onClick={() => setActiveTab('lifecycle')}
            role="tab"
            aria-selected={activeTab === 'lifecycle'}
          >
            Lifecycle &amp; Danger
          </button>
        </div>

        {/* Modal Body */}
        <div className="nx-admin-modal-body">
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="nx-admin-stats-grid">
                <div className="nx-admin-stat-card">
                  <span className="nx-admin-stat-card-label">Account Status</span>
                  <span className="nx-admin-stat-card-value" style={{ fontSize: '1.1rem' }}>
                    {user.accountLocked ? 'Suspended' : 'Active'}
                  </span>
                </div>
                <div className="nx-admin-stat-card">
                  <span className="nx-admin-stat-card-label">Active Sessions</span>
                  <span className="nx-admin-stat-card-value">{sessions.filter((s) => s.isActive).length}</span>
                </div>
                <div className="nx-admin-stat-card">
                  <span className="nx-admin-stat-card-label">Staff Notes</span>
                  <span className="nx-admin-stat-card-value">{notes.length}</span>
                </div>
                <div className="nx-admin-stat-card">
                  <span className="nx-admin-stat-card-label">Reports</span>
                  <span className="nx-admin-stat-card-value">{detail.reportsCount}</span>
                </div>
              </div>

              <div className="nx-admin-card" style={{ padding: '1rem' }}>
                <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }}>Account Metadata</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem', fontSize: '0.8125rem' }}>
                  <div>
                    <strong>Country:</strong> {user.registeredInCountry || 'Unknown'}
                  </div>
                  <div>
                    <strong>Registration IP:</strong>{' '}
                    <span className="nx-admin-mono">{user.registeredIp || 'None'}</span>
                  </div>
                  <div>
                    <strong>Last Login IP:</strong>{' '}
                    <span className="nx-admin-mono">{user.lastLoginIp || 'None'}</span>
                  </div>
                  <div>
                    <strong>VPN / Proxy:</strong> {user.lastLoginIpIsVpn ? 'Detected' : 'No'}
                  </div>
                  <div>
                    <strong>Candy Balance:</strong> {user.candy ?? 0}
                  </div>
                  <div>
                    <strong>Nickname Changes:</strong> {user.nicknameChangedCount ?? 0} / 1
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="nx-admin-btn nx-admin-btn-secondary"
                  onClick={() => setActiveTab('profile')}
                >
                  Edit User Details
                </button>
                <button
                  type="button"
                  className="nx-admin-btn nx-admin-btn-secondary"
                  onClick={() => setActiveTab('moderation')}
                >
                  Manage Moderation
                </button>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <ProfileTab detail={detail} onRefresh={onRefresh} showToast={showFeedback} />
          )}

          {activeTab === 'roles' && (
            <RolesTab detail={detail} onRefresh={onRefresh} showToast={showFeedback} />
          )}

          {activeTab === 'moderation' && (
            <ModerationTab detail={detail} onRefresh={onRefresh} showToast={showFeedback} />
          )}

          {activeTab === 'sessions' && (
            <SessionsTab detail={detail} onRefresh={onRefresh} showToast={showFeedback} />
          )}

          {activeTab === 'notes' && (
            <NotesTab detail={detail} onRefresh={onRefresh} showToast={showFeedback} />
          )}

          {activeTab === 'lifecycle' && (
            <LifecycleTab detail={detail} onRefresh={onRefresh} onClose={onClose} showToast={showFeedback} />
          )}
        </div>
      </div>
    </div>
  )
}
