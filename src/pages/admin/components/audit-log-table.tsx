import { useState } from 'react'
import type { AuditLogItem } from '../../../services/admin-api'

interface AuditLogTableProps {
  readonly entries: AuditLogItem[]
  readonly total: number
  readonly loading: boolean
  readonly filterTargetType: string
  readonly filterAction: string
  readonly onTargetTypeChange: (type: string) => void
  readonly onActionChange: (action: string) => void
  readonly onFilterSubmit: () => void
}

export function AuditLogTable({
  entries,
  total,
  loading,
  filterTargetType,
  filterAction,
  onTargetTypeChange,
  onActionChange,
  onFilterSubmit,
}: AuditLogTableProps) {
  const [inspectEntry, setInspectEntry] = useState<AuditLogItem | null>(null)

  return (
    <div className="nx-admin-card">
      <div className="nx-admin-toolbar">
        <select
          className="nx-admin-select"
          value={filterTargetType}
          onChange={(e) => onTargetTypeChange(e.target.value)}
        >
          <option value="">All Targets</option>
          <option value="user">Users</option>
          <option value="game">Games</option>
          <option value="platform">Platform</option>
        </select>
        <input
          type="text"
          className="nx-admin-input"
          placeholder="Filter by action (e.g. ban, flags, update_profile)..."
          value={filterAction}
          onChange={(e) => onActionChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onFilterSubmit()}
          style={{ minWidth: '280px' }}
        />
        <button
          type="button"
          className="nx-admin-btn nx-admin-btn-secondary"
          onClick={onFilterSubmit}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Filter'}
        </button>
        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)', marginLeft: 'auto' }}>
          Total logged events: {total}
        </span>
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
            {entries.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--nx-slate)' }}>
                  {loading ? 'Loading audit records...' : 'No audit entries found.'}
                </td>
              </tr>
            ) : (
              entries.map((e) => (
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
                    <span className="nx-admin-badge" data-variant="neutral">
                      {e.action}
                    </span>
                  </td>
                  <td>
                    <span className="nx-admin-mono">
                      {e.targetType}:{e.targetId || 'global'}
                    </span>
                  </td>
                  <td
                    style={{
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={e.reason || undefined}
                  >
                    {e.reason || '—'}
                  </td>
                  <td>
                    {e.metadata ? (
                      <button
                        type="button"
                        className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                        onClick={() => setInspectEntry(e)}
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

      {inspectEntry && (
        <div className="nx-admin-modal-overlay" onClick={() => setInspectEntry(null)} role="dialog" aria-modal="true">
          <div className="nx-admin-modal" style={{ maxWidth: '640px' }} onClick={(ev) => ev.stopPropagation()}>
            <div className="nx-admin-modal-header">
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>
                Audit Log #{inspectEntry.id}: {inspectEntry.action}
              </h3>
              <button
                type="button"
                className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                onClick={() => setInspectEntry(null)}
              >
                ✕
              </button>
            </div>
            <div className="nx-admin-modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.875rem' }}>
                <strong>Actor:</strong>
                <span>@{inspectEntry.actorUsername}</span>
                <strong>Target:</strong>
                <span className="nx-admin-mono">
                  {inspectEntry.targetType}:{inspectEntry.targetId || 'global'}
                </span>
                <strong>Timestamp:</strong>
                <span>{new Date(inspectEntry.createdAt).toLocaleString()}</span>
                <strong>Reason:</strong>
                <span>{inspectEntry.reason || 'None specified'}</span>
              </div>
              <h4 style={{ margin: '1rem 0 0.5rem', fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Action Payload / Diff
              </h4>
              <pre
                className="nx-admin-mono"
                style={{
                  background: 'var(--nx-sand)',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  overflowX: 'auto',
                  maxHeight: '280px',
                  fontSize: '0.8125rem',
                  margin: 0,
                }}
              >
                {JSON.stringify(inspectEntry.metadata, null, 2)}
              </pre>
            </div>
            <div className="nx-admin-modal-footer">
              <button
                type="button"
                className="nx-admin-btn nx-admin-btn-secondary"
                onClick={() => setInspectEntry(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
