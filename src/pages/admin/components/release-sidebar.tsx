import { asReleaseId, type ReleaseAggregate, type ReleaseId } from '../../../engine/updates/types'

interface ReleaseSidebarProps {
  readonly releases: readonly ReleaseAggregate[]
  readonly selectedId: ReleaseId | undefined
  readonly onSelect: (id: ReleaseId) => void
}

export function ReleaseSidebar({ releases, selectedId, onSelect }: ReleaseSidebarProps) {
  return (
    <aside className="nx-admin-sidebar">
      <div className="nx-sidebar-title">Releases &amp; Drafts ({releases.length})</div>
      {releases.length === 0 ? (
        <p className="nx-sidebar-empty">No releases found. Create your first draft!</p>
      ) : (
        <div className="nx-sidebar-list">
          {releases.map((rel) => (
            <button
              key={rel.meta.id}
              type="button"
              className="nx-sidebar-release-item"
              data-active={rel.meta.id === selectedId ? 'true' : undefined}
              onClick={() => onSelect(asReleaseId(rel.meta.id))}
            >
              <div className="nx-sidebar-release-top">
                <span className="nx-release-version">v{rel.meta.globalVersion}</span>
                <span className="nx-release-status-badge" data-status={rel.meta.status}>
                  {rel.meta.status}
                </span>
              </div>
              <div className="nx-sidebar-release-title">{rel.meta.title}</div>
              <div className="nx-sidebar-release-items-count">{rel.items.length} items</div>
            </button>
          ))}
        </div>
      )}
    </aside>
  )
}
