import { useState } from 'react'
import type { ModerationReportItem } from '../../../services/admin-api'
import { PromptDialog } from '../../../components/ui/prompt-dialog'

interface ModerationReportsTableProps {
  readonly reports: ModerationReportItem[]
  readonly loading: boolean
  readonly reportFilter: 'open' | 'resolved' | 'all'
  readonly onFilterChange: (filter: 'open' | 'resolved' | 'all') => void
  readonly onRefresh: () => void
  readonly onResolve: (reportId: string, action: string) => Promise<void>
  readonly onOpenUser: (userId: string) => void
}

export function ModerationReportsTable({
  reports,
  loading,
  reportFilter,
  onFilterChange,
  onRefresh,
  onResolve,
  onOpenUser,
}: ModerationReportsTableProps) {
  const [resolvingReportId, setResolvingReportId] = useState<string | null>(null)

  const handleConfirmResolve = async (action: string) => {
    if (!resolvingReportId) return
    const id = resolvingReportId
    setResolvingReportId(null)
    await onResolve(id, action)
  }

  return (
    <div className="nx-admin-card">
      <div className="nx-admin-toolbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <select
            className="nx-admin-select"
            value={reportFilter}
            onChange={(e) => onFilterChange(e.target.value as 'open' | 'resolved' | 'all')}
          >
            <option value="open">Open Reports</option>
            <option value="resolved">Resolved Reports</option>
            <option value="all">All Reports</option>
          </select>
          <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
            Showing {reports.length} report{reports.length === 1 ? '' : 's'}
          </span>
        </div>
        <button
          type="button"
          className="nx-admin-btn nx-admin-btn-secondary"
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? 'Refreshing...' : 'Refresh'}
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
                <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--nx-slate)' }}>
                  {loading ? 'Loading reports...' : 'No reports found.'}
                </td>
              </tr>
            ) : (
              reports.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.status === 'open' ? (
                      <span className="nx-admin-badge" data-variant="orange">
                        Open
                      </span>
                    ) : (
                      <span className="nx-admin-badge" data-variant="green">
                        Resolved
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                      onClick={() => onOpenUser(r.reportedUserId)}
                    >
                      @{r.reportedUsername}
                    </button>
                  </td>
                  <td>@{r.reporterUsername}</td>
                  <td>
                    <strong>{r.reason}</strong>
                  </td>
                  <td
                    style={{
                      maxWidth: '240px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={r.details || undefined}
                  >
                    {r.details || '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                      {new Date(r.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    {r.status === 'open' ? (
                      <button
                        type="button"
                        className="nx-admin-btn nx-admin-btn-primary nx-admin-btn-sm"
                        onClick={() => setResolvingReportId(r.id)}
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

      <PromptDialog
        isOpen={!!resolvingReportId}
        title="Resolve Moderation Report"
        message="Enter the administrative resolution action taken (e.g. 'Warned user', 'Temporary mute applied', 'No violation found')."
        inputLabel="Resolution Action Taken"
        placeholder="e.g. Account suspended for abusive conduct"
        confirmLabel="Resolve Report"
        onSubmit={handleConfirmResolve}
        onCancel={() => setResolvingReportId(null)}
      />
    </div>
  )
}
