import { useState } from 'react'
import { PromptDialog } from '../../../components/ui/prompt-dialog'
import './admin-change-pill.css'

interface PlatformMetadataTableProps {
  readonly metadata: Record<string, { value: string | null; updatedBy: string | null; updatedAt: number }>
  readonly systemConfig: Record<string, number>
  readonly loading: boolean
  readonly onRefresh: () => void
  readonly onSaveMetadata: (key: string, value: string, reason?: string) => Promise<void>
}

export function PlatformMetadataTable({
  metadata,
  systemConfig,
  loading,
  onRefresh,
  onSaveMetadata,
}: PlatformMetadataTableProps) {
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [pendingSave, setPendingSave] = useState<{ key: string; value: string } | null>(null)

  const handleStartSave = (key: string, value: string) => {
    setPendingSave({ key, value })
  }

  const handleConfirmSave = async (reason: string) => {
    if (!pendingSave) return
    const { key, value } = pendingSave
    setPendingSave(null)
    await onSaveMetadata(key, value, reason.trim() || undefined)
    setEditingKey(null)
    if (key === newKey) {
      setNewKey('')
      setNewValue('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <div className="nx-admin-card">
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Add / Update Configuration Key</h3>
        <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
          Set global runtime parameters, announcements, and operational switches.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!newKey.trim()) return
            handleStartSave(newKey.trim(), newValue)
          }}
          style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}
        >
          <input
            type="text"
            className="nx-admin-input"
            placeholder="Key (e.g. announcement_banner)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            style={{ flex: 1, minWidth: '220px' }}
          />
          <input
            type="text"
            className="nx-admin-input"
            placeholder="Value string..."
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            style={{ flex: 2, minWidth: '280px' }}
          />
          <button type="submit" className="nx-admin-btn nx-admin-btn-primary" disabled={!newKey.trim()}>
            Save Key
          </button>
        </form>
      </div>

      <div className="nx-admin-card">
        <div className="nx-admin-toolbar" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
            Active Platform Metadata Records ({Object.keys(metadata).length})
          </span>
          <button type="button" className="nx-admin-btn nx-admin-btn-secondary" onClick={onRefresh} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
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
                  <td colSpan={4} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--nx-slate)' }}>
                    {loading ? 'Loading metadata...' : 'No platform metadata entries found.'}
                  </td>
                </tr>
              ) : (
                Object.entries(metadata).map(([key, data]) => {
                  const isEditing = editingKey === key

                  return (
                    <tr key={key}>
                      <td>
                        <strong className="nx-admin-mono">{key}</strong>
                      </td>
                      <td>
                        {isEditing ? (
                          <input
                            type="text"
                            className="nx-admin-input"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            style={{ width: '100%' }}
                            autoFocus
                          />
                        ) : (
                          <span style={{ wordBreak: 'break-all' }}>{data.value || '<empty>'}</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                          {new Date(data.updatedAt).toLocaleString()}
                        </span>
                      </td>
                      <td>
                        {isEditing ? (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button
                              type="button"
                              className="nx-pill-btn nx-pill-btn-discard"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.65rem' }}
                              onClick={() => setEditingKey(null)}
                            >
                              Discard
                            </button>
                            <button
                              type="button"
                              className="nx-pill-btn nx-pill-btn-save"
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem' }}
                              onClick={() => handleStartSave(key, editingValue)}
                            >
                              Save
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="nx-pill-btn nx-pill-btn-discard"
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.75rem', background: 'var(--nx-sand)', color: 'var(--nx-ink)' }}
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
          <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>System Feature Flags (Integer Store)</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {Object.entries(systemConfig).map(([k, v]) => (
              <div key={k} style={{ background: 'var(--nx-sand)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                <span className="nx-admin-mono" style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                  {k}:{' '}
                </span>
                <strong className="nx-admin-mono">{v}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      <PromptDialog
        isOpen={!!pendingSave}
        title="Audit Reason Required"
        message={`Provide an operational audit log reason for updating '${pendingSave?.key}'.`}
        inputLabel="Audit Reason"
        placeholder="e.g. Updating maintenance banner message"
        confirmLabel="Save Configuration"
        onSubmit={handleConfirmSave}
        onCancel={() => setPendingSave(null)}
      />
    </div>
  )
}
