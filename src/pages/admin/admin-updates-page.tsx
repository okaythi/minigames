import { useState, useEffect } from 'react'
import { isCmsEditor, getCurrentUser, subscribeAuth } from '../../services/auth-api'
import { useUpdateEditor } from '../../engine/updates/hooks'
import type { ReleaseId, UpdateReleaseMetaInput } from '../../engine/updates/types'
import { ReleaseMetaForm } from './components/release-meta-form'
import { ReleaseItemsList } from './components/release-items-list'
import { ReleasePreviewPane } from './components/release-preview-pane'
import { ReleaseSidebar } from './components/release-sidebar'
import { CreateDraftModal } from './components/create-draft-modal'
import { ArcadeTextEditor } from '../../components/ui/rich-editor/arcade-text-editor'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'
import './admin-updates-page.css'

export function AdminUpdatesPage() {
  const [authorized, setAuthorized] = useState<boolean>(isCmsEditor())
  const [selectedReleaseId, setSelectedReleaseId] = useState<ReleaseId | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'meta' | 'rationale' | 'items' | 'preview'>('meta')
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [rationaleContent, setRationaleContent] = useState('')
  const [savingRationale, setSavingRationale] = useState(false)
  const [feedback, setFeedback] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const {
    drafts,
    activeRelease,
    createDraft,
    updateMeta,
    setRationale,
    addItem,
    updateItem,
    removeItem,
    reorderItems,
    publish,
    archive,
    deleteDraft,
  } = useUpdateEditor(selectedReleaseId)

  useEffect(() => {
    setAuthorized(isCmsEditor())
    return subscribeAuth(() => {
      setAuthorized(isCmsEditor())
    })
  }, [])

  useEffect(() => {
    if (!selectedReleaseId && drafts.length > 0) {
      setSelectedReleaseId(drafts[0]!.meta.id)
    }
  }, [drafts, selectedReleaseId])

  useEffect(() => {
    if (activeRelease?.rationale) {
      setRationaleContent(activeRelease.rationale.content)
    } else {
      setRationaleContent('')
    }
  }, [activeRelease])

  const showFeedback = (msg: string, type: 'ok' | 'err' = 'ok') => {
    setFeedback({ msg, type })
    setTimeout(() => setFeedback(null), 3000)
  }

  if (!authorized) {
    const user = getCurrentUser()
    return (
      <div className="nx-admin-restricted-page nx-page">
        <div className="nx-restricted-card">
          <div className="nx-restricted-icon">🛡️</div>
          <h1 className="nx-restricted-title">Lab Staff Access Required</h1>
          <p className="nx-restricted-text">
            Access to the Update Notes CMS is restricted to verified Nixlabs staff holding both the{' '}
            <code className="nx-md-inline-code">STAFF</code> and{' '}
            <code className="nx-md-inline-code">CMS_EDITOR</code> flags.
          </p>
          {user ? (
            <p className="nx-restricted-user">
              Signed in as <strong>@{user.username}</strong> (Missing required platform flags).
            </p>
          ) : (
            <p className="nx-restricted-user">You are currently not signed in.</p>
          )}
          <div className="nx-restricted-actions">
            <Link to={ROUTES.home} className="nx-btn nx-btn-secondary">
              Back to Arcade
            </Link>
            {!user && (
              <button
                type="button"
                className="nx-btn nx-btn-primary"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('nx:open-auth'))
                }}
              >
                Sign In
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  const handleCreateDraft = async (input: { globalVersion: string; title: string; headline: string }) => {
    const draftId = await createDraft({
      globalVersion: input.globalVersion,
      title: input.title,
      headline: input.headline,
      releaseDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    })
    setSelectedReleaseId(draftId)
    showFeedback('Draft release created successfully!')
  }

  const handleSaveMeta = async (patch: UpdateReleaseMetaInput) => {
    if (!selectedReleaseId) return
    await updateMeta(selectedReleaseId, patch)
    showFeedback('Metadata updated!')
  }

  const handleSaveRationale = async () => {
    if (!selectedReleaseId) return
    setSavingRationale(true)
    try {
      await setRationale(selectedReleaseId, rationaleContent)
      showFeedback('Developer rationale saved!')
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Failed to save rationale', 'err')
    } finally {
      setSavingRationale(false)
    }
  }

  const handlePublish = async () => {
    if (!selectedReleaseId || !activeRelease) return
    if (!window.confirm(`Publish release v${activeRelease.meta.globalVersion} live to players?`)) return

    try {
      await publish(selectedReleaseId)
      showFeedback(`Release v${activeRelease.meta.globalVersion} is now LIVE!`)
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Publish failed', 'err')
    }
  }

  const handleDelete = async () => {
    if (!selectedReleaseId || !activeRelease) return
    if (!window.confirm(`Permanently delete draft v${activeRelease.meta.globalVersion}?`)) return

    try {
      await deleteDraft(selectedReleaseId)
      setSelectedReleaseId(undefined)
      showFeedback('Draft deleted.')
    } catch (err: unknown) {
      showFeedback(err instanceof Error ? err.message : 'Delete failed', 'err')
    }
  }

  return (
    <div className="nx-admin-cms-page nx-page">
      <header className="nx-admin-header">
        <div className="nx-admin-title-row">
          <h1 className="nx-admin-title">Update Notes CMS</h1>
          <span className="nx-admin-role-badge">STAFF &bull; CMS_EDITOR</span>
        </div>
        <div className="nx-admin-header-actions">
          <button
            type="button"
            className="nx-btn nx-btn-primary"
            onClick={() => setIsCreatingDraft(true)}
          >
            + New Release Draft
          </button>
        </div>
      </header>

      {feedback && (
        <div className={`nx-admin-feedback nx-feedback-${feedback.type}`}>{feedback.msg}</div>
      )}

      <CreateDraftModal
        isOpen={isCreatingDraft}
        onClose={() => setIsCreatingDraft(false)}
        onSubmit={handleCreateDraft}
      />

      <div className="nx-admin-layout">
        <ReleaseSidebar
          releases={drafts}
          selectedId={selectedReleaseId}
          onSelect={setSelectedReleaseId}
        />

        <main className="nx-admin-workspace">
          {!activeRelease ? (
            <div className="nx-admin-empty-workspace">
              <p>Select a release from the sidebar or create a new draft.</p>
            </div>
          ) : (
            <div>
              <div className="nx-workspace-header">
                <div>
                  <h2 className="nx-workspace-title">
                    v{activeRelease.meta.globalVersion}: {activeRelease.meta.title}
                  </h2>
                  <span className="nx-release-status-badge" data-status={activeRelease.meta.status}>
                    Status: {activeRelease.meta.status.toUpperCase()}
                  </span>
                </div>

                <div className="nx-workspace-actions">
                  {activeRelease.meta.status !== 'published' && (
                    <button type="button" className="nx-btn nx-btn-publish" onClick={() => void handlePublish()}>
                      🚀 Publish Live
                    </button>
                  )}
                  {activeRelease.meta.status === 'published' && (
                    <button type="button" className="nx-btn nx-btn-secondary" onClick={() => void archive(activeRelease.meta.id)}>
                      📦 Archive
                    </button>
                  )}
                  {activeRelease.meta.status !== 'published' && (
                    <button type="button" className="nx-btn nx-btn-danger" onClick={() => void handleDelete()}>
                      🗑️ Delete Draft
                    </button>
                  )}
                </div>
              </div>

              <nav className="nx-workspace-tabs" aria-label="Release editor tabs">
                <button
                  type="button"
                  className="nx-workspace-tab"
                  data-active={activeTab === 'meta' ? 'true' : undefined}
                  onClick={() => setActiveTab('meta')}
                >
                  1. Metadata &amp; Banner
                </button>
                <button
                  type="button"
                  className="nx-workspace-tab"
                  data-active={activeTab === 'rationale' ? 'true' : undefined}
                  onClick={() => setActiveTab('rationale')}
                >
                  2. Developer Rationale
                </button>
                <button
                  type="button"
                  className="nx-workspace-tab"
                  data-active={activeTab === 'items' ? 'true' : undefined}
                  onClick={() => setActiveTab('items')}
                >
                  3. Change Items ({activeRelease.items.length})
                </button>
                <button
                  type="button"
                  className="nx-workspace-tab"
                  data-active={activeTab === 'preview' ? 'true' : undefined}
                  onClick={() => setActiveTab('preview')}
                >
                  4. Live Engine Preview
                </button>
              </nav>

              {activeTab === 'meta' && (
                <div className="nx-tab-content">
                  <ReleaseMetaForm release={activeRelease} onSave={handleSaveMeta} />
                </div>
              )}

              {activeTab === 'rationale' && (
                <div className="nx-tab-content">
                  <p className="nx-section-desc">
                    Explain the design rationale, physics intentions, and balance considerations behind this release.
                  </p>
                  <ArcadeTextEditor
                    label="Developer Rationale (Markdown, Media & Domain Tags Supported)"
                    value={rationaleContent}
                    onChange={setRationaleContent}
                    minHeight={220}
                    placeholder="Describe design decisions, why certain mechanics changed..."
                  />
                  <div className="nx-form-actions" style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="nx-btn nx-btn-primary"
                      onClick={() => void handleSaveRationale()}
                      disabled={savingRationale}
                    >
                      {savingRationale ? 'Saving...' : 'Save Developer Rationale'}
                    </button>
                  </div>
                </div>
              )}

              {activeTab === 'items' && (
                <ReleaseItemsList
                  release={activeRelease}
                  onAddItem={(input) => addItem(activeRelease.meta.id, input).then(() => {})}
                  onUpdateItem={updateItem}
                  onRemoveItem={removeItem}
                  onReorderItems={(orderedIds) => reorderItems(activeRelease.meta.id, orderedIds)}
                  onFeedback={showFeedback}
                />
              )}

              {activeTab === 'preview' && (
                <div className="nx-tab-content">
                  <ReleasePreviewPane release={activeRelease} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
