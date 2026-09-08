import { useState, useEffect } from 'react'
import { isGamesAdmin, subscribeAuth } from '../../services/auth-api'
import {
  fetchAdminGames,
  updateGameOverride,
  type AdminGameItem,
} from '../../services/admin-api'
import { GameFlags, hasGameFlag, enableGameFlag, disableGameFlag } from '../../../shared/flags'
import { AdminNavBar } from './components/admin-nav-bar'
import { AdminRestrictedCard } from './components/admin-restricted-card'
import './admin-common.css'

export function AdminGamesPage() {
  const [authorized, setAuthorized] = useState<boolean>(isGamesAdmin())
  const [games, setGames] = useState<AdminGameItem[]>([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // In-flight edits
  const [editingSlug, setEditingSlug] = useState<string | null>(null)
  const [editStatus, setEditStatus] = useState<string>('published')
  const [editFlags, setEditFlags] = useState<number>(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setAuthorized(isGamesAdmin())
    return subscribeAuth(() => {
      setAuthorized(isGamesAdmin())
    })
  }, [])

  const showFeedback = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3500)
  }

  const loadGames = async () => {
    setLoading(true)
    try {
      const res = await fetchAdminGames()
      setGames(res.games)
    } catch (err: any) {
      showFeedback(err.message || 'Failed to load games', 'err')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authorized) {
      void loadGames()
    }
  }, [authorized])

  const startEdit = (game: AdminGameItem) => {
    setEditingSlug(game.slug)
    setEditStatus(game.status)
    setEditFlags(game.flags)
  }

  const cancelEdit = () => {
    setEditingSlug(null)
  }

  const handleSave = async (slug: string) => {
    const reason = window.prompt('Audit reason for updating this game override:')
    if (reason === null) return
    setSaving(true)
    try {
      await updateGameOverride(slug, {
        status: editStatus,
        flags: editFlags,
        reason: reason.trim() || undefined,
      })
      showFeedback(`Overrides for '${slug}' updated!`, 'ok')
      setEditingSlug(null)
      void loadGames()
    } catch (err: any) {
      showFeedback(err.message || 'Failed to save game override', 'err')
    } finally {
      setSaving(false)
    }
  }

  const toggleFlag = (flagBit: number) => {
    setEditFlags((prev) =>
      hasGameFlag(prev, flagBit) ? disableGameFlag(prev, flagBit) : enableGameFlag(prev, flagBit),
    )
  }

  if (!authorized) {
    return (
      <AdminRestrictedCard
        title="Games Administration Access Required"
        requiredFlags="GAMES_ADMIN"
        panelName="Live Games & Catalog Management"
      />
    )
  }

  return (
    <div className="nx-page nx-admin-layout">
      <div className="nx-admin-header">
        <div className="nx-admin-header-title">
          <h1>Games Management</h1>
          <p>Control live runtime visibility, feature flags, and maintenance status without redeploying.</p>
        </div>
        <AdminNavBar activeTab="games" />
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

      <div className="nx-admin-card">
        <div className="nx-admin-toolbar" style={{ justifyContent: 'space-between' }}>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Registered Arcade Titles ({games.length})</span>
          <button type="button" className="nx-admin-btn nx-admin-btn-secondary" onClick={loadGames} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="nx-admin-table-wrap">
          <table className="nx-admin-table">
            <thead>
              <tr>
                <th>Title & Slug</th>
                <th>Status</th>
                <th>Active Flags</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((g) => {
                const isEditing = editingSlug === g.slug

                return (
                  <tr key={g.slug}>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <strong>{g.title}</strong>
                        <span className="nx-admin-mono" style={{ color: 'var(--nx-slate)' }}>{g.slug}</span>
                      </div>
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="nx-admin-select"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          <option value="published">Published</option>
                          <option value="maintenance">Maintenance</option>
                          <option value="hidden">Hidden</option>
                        </select>
                      ) : (
                        <span
                          className="nx-admin-badge"
                          data-variant={
                            g.status === 'published'
                              ? 'green'
                              : g.status === 'maintenance'
                              ? 'orange'
                              : 'neutral'
                          }
                        >
                          {g.status.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
                            <input
                              type="checkbox"
                              checked={hasGameFlag(editFlags, GameFlags.FEATURED)}
                              onChange={() => toggleFlag(GameFlags.FEATURED)}
                            />
                            Featured
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem' }}>
                            <input
                              type="checkbox"
                              checked={hasGameFlag(editFlags, GameFlags.GAME_BETA)}
                              onChange={() => toggleFlag(GameFlags.GAME_BETA)}
                            />
                            Beta
                          </label>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          {hasGameFlag(g.flags, GameFlags.FEATURED) && (
                            <span className="nx-admin-badge" data-variant="orange">⭐ Featured</span>
                          )}
                          {hasGameFlag(g.flags, GameFlags.GAME_BETA) && (
                            <span className="nx-admin-badge" data-variant="neutral">Beta</span>
                          )}
                          {!hasGameFlag(g.flags, GameFlags.FEATURED) &&
                            !hasGameFlag(g.flags, GameFlags.GAME_BETA) && (
                              <span style={{ color: 'var(--nx-slate)', fontSize: '0.8125rem' }}>None</span>
                            )}
                        </div>
                      )}
                    </td>
                    <td>
                      {g.updatedAt ? (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>
                          {new Date(g.updatedAt).toLocaleDateString()}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.8125rem', color: 'var(--nx-slate)' }}>Static defaults</span>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            className="nx-admin-btn nx-admin-btn-primary nx-admin-btn-sm"
                            onClick={() => handleSave(g.slug)}
                            disabled={saving}
                          >
                            {saving ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="nx-admin-btn nx-admin-btn-secondary nx-admin-btn-sm"
                          onClick={() => startEdit(g)}
                        >
                          Configure
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
