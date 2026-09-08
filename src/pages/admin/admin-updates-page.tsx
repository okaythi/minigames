import { useState, useEffect } from 'react'
import { isCmsEditor, subscribeAuth } from '../../services/auth-api'
import { useUpdateEditor } from '../../engine/updates/hooks'
import type { ReleaseId, UpdateReleaseMetaInput } from '../../engine/updates/types'
import { ReleaseMetaForm } from './components/release-meta-form'
import { ReleaseRationaleTab } from './components/release-rationale-tab'
import { ReleaseItemsList } from './components/release-items-list'
import { ReleasePreviewPane } from './components/release-preview-pane'
import { ReleaseSidebar } from './components/release-sidebar'
import { CreateDraftModal } from './components/create-draft-modal'
import { AdminRestrictedCard } from './components/admin-restricted-card'
import { ConfirmDialog } from '../../components/ui/confirm-dialog'
import { FeedbackToast, type ToastMessage } from '../../components/ui/feedback-toast'
import './admin-updates-page.css'

export function AdminUpdatesPage() {
  const [authorized, setAuthorized] = useState<boolean>(isCmsEditor())
  const [selectedReleaseId, setSelectedReleaseId] = useState<ReleaseId | undefined>(undefined)
  const [activeTab, setActiveTab] = useState<'meta' | 'rationale' | 'items' | 'preview'>('meta')
  const [isCreatingDraft, setIsCreatingDraft] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  // Dialog state
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  const showToast = (message: string, type: 'ok' | 'err' | 'info' = 'ok') => {
    setToast({ id: String(Date.now()), message, type })
  }

  if (!authorized) {
    return (
      <AdminRestrictedCard
        title="Lab Staff Access Required"
        requiredFlags="CMS_EDITOR"
        panelName="Update Notes CMS"
      />
    )
  }

  const handleCreateDraft = async (input: {
    globalVersion: string
    title: string
    headline: string
    authorUsername?: string | undefined
  }) => {
    const draftId = await createDraft({
      globalVersion: input.globalVersion,
      title: input.title,
      headline: input.headline,
      releaseDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      authorUsername: input.authorUsername,
    })
    setSelectedReleaseId(draftId)
    showToast('Draft release created successfully')
  }

  const handleSaveMeta = async (patch: UpdateReleaseMetaInput) => {
    if (!selectedReleaseId) return
    await updateMeta(selectedReleaseId, patch)
    showToast('Metadata updated')
  }

  const handleSaveRationale = async (content: string) => {
    if (!selectedReleaseId) return
    try {
      await setRationale(selectedReleaseId, content)
      showToast('Developer rationale saved')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to save rationale', 'err')
    }
  }

  const handleConfirmPublishAction = async () => {
    if (!selectedReleaseId || !activeRelease) return
    setConfirmPublish(false)
    try {
      await publish(selectedReleaseId)
      showToast(`Release v${activeRelease.meta.globalVersion} is now LIVE!`)
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Publish failed', 'err')
    }
  }

  const handleConfirmDeleteAction = async () => {
    if (!selectedReleaseId || !activeRelease) return
    setConfirmDelete(false)
    try {
      await deleteDraft(selectedReleaseId)
      setSelectedReleaseId(undefined)
      showToast('Draft deleted')
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Delete failed', 'err')
    }
  }

  return (
    <div className="nx-admin-cms-page nx-page">
      <header className="nx-admin-header">
        <div className="nx-admin-title-row">
          <h1 className="nx-admin-title">Update Notes CMS</h1>
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
                    <button
                      type="button"
                      className="nx-btn nx-btn-publish"
                      onClick={() => setConfirmPublish(true)}
                    >
                      Publish Live
                    </button>
                  )}
                  {activeRelease.meta.status === 'published' && (
                    <button
                      type="button"
                      className="nx-btn nx-btn-secondary"
                      onClick={() => void archive(activeRelease.meta.id)}
                    >
                      Archive
                    </button>
                  )}
                  {activeRelease.meta.status !== 'published' && (
                    <button
                      type="button"
                      className="nx-btn nx-btn-danger"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete Draft
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
                <ReleaseRationaleTab release={activeRelease} onSave={handleSaveRationale} />
              )}

              {activeTab === 'items' && (
                <ReleaseItemsList
                  release={activeRelease}
                  onAddItem={(input) => addItem(activeRelease.meta.id, input).then(() => {})}
                  onUpdateItem={updateItem}
                  onRemoveItem={removeItem}
                  onReorderItems={(orderedIds) => reorderItems(activeRelease.meta.id, orderedIds)}
                  onFeedback={(msg, type) => showToast(msg, type === 'err' ? 'err' : 'ok')}
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

      <ConfirmDialog
        isOpen={confirmPublish}
        title="Publish Release Live"
        message={`Are you sure you want to publish release v${activeRelease?.meta.globalVersion} live to players? This will immediately syndicate to all players.`}
        confirmLabel="Publish Live"
        onConfirm={handleConfirmPublishAction}
        onCancel={() => setConfirmPublish(false)}
      />

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Release Draft"
        message={`Permanently delete draft v${activeRelease?.meta.globalVersion}? This cannot be undone.`}
        confirmLabel="Delete Draft"
        danger
        onConfirm={handleConfirmDeleteAction}
        onCancel={() => setConfirmDelete(false)}
      />

      <FeedbackToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  )
}
