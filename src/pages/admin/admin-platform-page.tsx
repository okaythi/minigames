import { useState, useEffect } from 'react'
import { isPlatformAdmin, subscribeAuth } from '../../services/auth-api'
import {
  fetchPlatformMetadata,
  updatePlatformMetadata,
  fetchAuditLog,
  type AuditLogItem,
} from '../../services/admin-api'
import { AdminNavBar } from './components/admin-nav-bar'
import { AdminRestrictedCard } from './components/admin-restricted-card'
import './admin-common.css'

export function AdminPlatformPage() {
  const [authorized, setAuthorized] = useState<boolean>(isPlatformAdmin())
  const [activeTab, setActiveTab] = useState<'metadata' | 'audit'>('metadata')

  // Metadata state
  const [metadata, setMetadata] = useState<Record<string, { value: string | null; updatedBy: string | null; updatedAt: number }>>({})
  const [systemConfig, setSystemConfig] = useState<Record<string, number>>({})
  const [loadingMeta, setLoadingMeta] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [isAddingMeta, setIsAddingMeta] = useState(false)

  // Audit log state
  const [auditEntries, setAuditEntries] = useState<AuditLogItem[]>([])
  const [auditTotal, setAuditTotal] = useState(0)
  const [filterTargetType, setFilterTargetType] = useState<string>('')
  const [filterAction, setFilterAction] = useState<string>('')
  const [loadingAudit, setLoadingAudit] = useState(false)

  // Metadata inline edit
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')

  // Selected audit diff modal
  const [inspectAudit, setInspectAudit] = useState<AuditLogItem | null>(null)

  // Feedback banner
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  useEffect(() => {
    setAuthorized(isPlatformAdmin())
    return subscribeAuth(() => {
      setAuthorized(isPlatformAdmin())
    })
  }, [])

  const showFeedback = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  const loadMetadata = async () => {
    setLoadingMeta(true)
    try {
      const res = await fetchPlatformMetadata()
      setMetadata(res.metadata)
      setSystemConfig(res.systemConfig)
    } catch (err: any) {
      showFeedback(err.message || 'Failed to load platform metadata', 'err')
    } finally {
      setLoadingMeta(false)
    }
  }

  const loadAudit = async () => {
    setLoadingAudit(true)
    try {
      const res = await fetchAuditLog({
        targetType: filterTargetType || undefined,
        action: filterAction || undefined,
        limit: 50,
      })
      setAuditEntries(res.entries)
      setAuditTotal(res.total)
    } catch (err: any) {
      showFeedback(err.message || 'Failed to load audit log', 'err')
    } finally {
      setLoadingAudit(false)
    }
  }

  useEffect(() => {
    if (!authorized) return
    if (activeTab === 'metadata') {
      void loadMetadata()
    } else {
      void loadAudit()
    }
  }, [authorized, activeTab, filterTargetType, filterAction])

  const handleSaveMetadata = async (key: string, value: string) => {
    const reason = window.prompt(`Audit reason for saving metadata '${key}':`)
    if (reason === null) return
    try {
      await updatePlatformMetadata(key, value, reason.trim() || undefined)
      showFeedback(`Metadata '${key}' updated!`, 'ok')
      setEditingKey(null)
      void loadMetadata()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to update metadata', 'err')
    }
  }

  const handleAddMetadata = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newKey.trim()) return
    setIsAddingMeta(true)
    try {
      await handleSaveMetadata(newKey.trim(), newValue)
      setNewKey('')
      setNewValue('')
    } finally {
      setIsAddingMeta(false)
    }
  }

  if (!authorized) {
    return (
      <AdminRestrictedCard
        title="Platform Administration Access Required"
        requiredFlags="PLATFORM_ADMIN"
        panelName="Platform Metadata & Audit Explorer"
      />
    )
  }

  return (
    <div className="nx-page nx-admin-layout">
      <div className="nx-admin-header">
        <div className="nx-admin-header-title">
          <h1>Platform Administration</h1>
          <p>Configure text metadata, inspect immutable system audit logs, and administer global parameters.</p>
        </div>
        <AdminNavBar activeTab="platform" />
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
          className={`nx-admin-nav-tab ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          📋 Platform Metadata ({Object.keys(metadata).length})
        </button>
        <button
          type="button"
          className={`nx-admin-nav-tab ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          📜 Audit Log ({auditTotal})
        </button>
      </div>

      {activeTab === 'metadata' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="nx-admin-card">
            <h3>Add / Update Platform Key</h3>
            <form onSubmit={handleAddMetadata} style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <input
                type="text"
                className="nx-admin-input"
                placeholder="Key (e.g. announcement_banner)"
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                style={{ flex: 1, minWidth: '200px' }}
              />
              <input
                type="text"
                className="nx-admin-input"
                placeholder="Value text..."
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                style={{ flex: 2, minWidth: '300px' }}
              />
              <button type="submit" className="nx-admin-btn nx-admin-btn-primary" disabled={isAddingMeta}>
                Save Key
              </button>
            </form>
          </div>

          <div className="nx-admin-card">
            <div className="nx-admin-toolbar" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 600 }}>Active Platform Metadata Records</span>
              <button type="button" className="nx-admin-btn nx-admin-btn-secondary" onClick={loadMetadata} disabled={loadingMeta}>
                {loadingMeta ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>

            <div className="nx-admin-table-wrap">
              <table className="nx-admin-table">
                <thead>
                  <tr>
                    <th>Key</th>
                    <th>Value</th>
                    <th>Last Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(metadata).length === 0 ? (
                    <tr>
                      <td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--nx-slate)' }}>
                        No platform metadata entries found.
                      </td>
                    </tr>
                  ) : (
                    Object.entries(metadata).map(([key, data]) => {
                      const isEditing = editingKey === key

                      return (
                        <tr key={key}>
                          <td><strong className="nx-admin-mono">{key}</strong></td>
                          <td>
                            {isEditing ? (
                              <input
                                type="text"
                                className="nx-admin-input"
                                value={editingValue}
                                onChange={(e) => setEditingValue(e.target.value)}
                                style={{ width: '100%' }}
                              />
                            ) : (
                              <span>{data.value || '<empty>'}</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                              {new Date(data.updatedAt).toLocaleString()}
                            </span>
                          </td>
                          <td>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                <button
                                  type="button"
                                  className="nx-admin-btn nx-admin-btn-primary nx-admin-btn-sm"
                                  onClick={() => handleSaveMetadata(key, editingValue)}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                                  onClick={() => setEditingKey(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                                onClick={() => {
                                  setEditingKey(key)
                                  setEditingValue(data.value || '')
                                }}
                              >
                                Edit
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {Object.keys(systemConfig).length > 0 && (
            <div className="nx-admin-card">
              <h3>System Feature Flags (Integer Store)</h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {Object.entries(systemConfig).map(([k, v]) => (
                  <div key={k} style={{ background: 'var(--nx-sand)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                    <span className="nx-admin-mono" style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>{k}: </span>
                    <strong className="nx-admin-mono">{v}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="nx-admin-card">
          <div className="nx-admin-toolbar">
            <select
              className="nx-admin-select"
              value={filterTargetType}
              onChange={(e) => setFilterTargetType(e.target.value)}
            >
              <option value="">All Targets</option>
              <option value="user">Users</option>
              <option value="game">Games</option>
              <option value="platform">Platform</option>
            </select>
            <input
              type="text"
              className="nx-admin-input"
              placeholder="Filter by action (e.g. ban, flags)..."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            />
            <button type="button" className="nx-admin-btn nx-admin-btn-secondary" onClick={loadAudit} disabled={loadingAudit}>
              {loadingAudit ? 'Loading...' : 'Filter'}
            </button>
          </div>

          <div className="nx-admin-table-wrap">
            <table className="nx-admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                  <th>Diff</th>
                </tr>
              </thead>
              <tbody>
                {auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--nx-slate)' }}>
                      {loadingAudit ? 'Loading audit records...' : 'No audit entries found.'}
                    </td>
                  </tr>
                ) : (
                  auditEntries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                          {new Date(e.createdAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        <strong>@{e.actorUsername}</strong>
                      </td>
                      <td>
                        <span className="nx-admin-badge" data-variant="neutral">{e.action}</span>
                      </td>
                      <td>
                        <span className="nx-admin-mono">{e.targetType}:{e.targetId || 'global'}</span>
                      </td>
                      <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.reason || '—'}
                      </td>
                      <td>
                        {e.metadata ? (
                          <button
                            type="button"
                            className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                            onClick={() => setInspectAudit(e)}
                          >
                            Inspect
                          </button>
                        ) : (
                          <span style={{ color: 'var(--nx-slate)', fontSize: '0.75rem' }}>None</span>
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

      {inspectAudit && (
        <div className="nx-admin-modal-overlay" onClick={() => setInspectAudit(null)}>
          <div className="nx-admin-modal" onClick={(ev) => ev.stopPropagation()}>
            <div className="nx-admin-modal-header">
              <h3>Audit Detail #{inspectAudit.id}: {inspectAudit.action}</h3>
              <button type="button" className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm" onClick={() => setInspectAudit(null)}>
                ✕
              </button>
            </div>
            <div className="nx-admin-modal-body">
              <p style={{ margin: 0 }}>
                <strong>Actor:</strong> @{inspectAudit.actorUsername} · <strong>Target:</strong> {inspectAudit.targetType}:{inspectAudit.targetId}
              </p>
              <p style={{ margin: 0 }}>
                <strong>Reason:</strong> {inspectAudit.reason || 'None specified'}
              </p>
              <h4>Metadata / Diff</h4>
              <pre
                className="nx-admin-mono"
                style={{
                  background: 'var(--nx-sand)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  maxHeight: '300px',
                }}
              >
                {JSON.stringify(inspectAudit.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
