import { useState } from 'react'
import type { ReleaseAggregate } from '../../../engine/updates/types'
import { MarkdownRenderer } from '../../../components/ui/rich-editor/markdown-renderer'
import { ReleaseAuthorByline } from '../../../components/ui/release-author-byline'
import '../../updates-page.css'

interface ReleasePreviewPaneProps {
  readonly release: ReleaseAggregate
}

export function ReleasePreviewPane({ release }: ReleasePreviewPaneProps) {
  const [viewMode, setViewMode] = useState<'by-game' | 'by-tag' | 'banner'>('by-game')

  return (
    <div className="nx-admin-preview-container">
      <div className="nx-preview-header">
        <h3 className="nx-preview-title">Live Engine Projection Preview</h3>
        <div className="nx-preview-mode-toggle">
          <button
            type="button"
            className="nx-preview-toggle-btn"
            data-active={viewMode === 'by-game' ? 'true' : undefined}
            onClick={() => setViewMode('by-game')}
          >
            By Game (Pillars)
          </button>
          <button
            type="button"
            className="nx-preview-toggle-btn"
            data-active={viewMode === 'by-tag' ? 'true' : undefined}
            onClick={() => setViewMode('by-tag')}
          >
            By Category (Tags)
          </button>
          <button
            type="button"
            className="nx-preview-toggle-btn"
            data-active={viewMode === 'banner' ? 'true' : undefined}
            onClick={() => setViewMode('banner')}
          >
            Top Banner CTA
          </button>
        </div>
      </div>

      <div className="nx-preview-card">
        {viewMode === 'banner' ? (
          <div className="nx-banner-preview-box">
            <div className="nx-top-banner" data-kind="update">
              <div className="nx-top-banner-inner">
                <span>
                  🚀 <strong>Update {release.meta.globalVersion}:</strong> {release.meta.headline}
                </span>
                <span className="nx-top-banner-cta">Read Patch Notes →</span>
              </div>
            </div>
            <p className="nx-banner-preview-note">
              This is how your headline appears globally across all players&apos; browser tabs when published.
            </p>
          </div>
        ) : (
          <article className="nx-release-card">
            <div className="nx-release-meta-row">
              <span className="nx-release-version">v{release.meta.globalVersion}</span>
              <time className="nx-release-date">{release.meta.releaseDate}</time>
            </div>

            <h2 className="nx-release-title">{release.meta.title}</h2>

            {release.rationale && (
              <section className="nx-release-rationale" aria-label="Developer notes">
                <MarkdownRenderer content={release.rationale.content} />
              </section>
            )}

            {viewMode === 'by-game' ? (
              <div className="nx-release-pillars">
                {release.pillars.length === 0 ? (
                  <p style={{ color: 'var(--nx-muted)', fontStyle: 'italic' }}>No change items added yet.</p>
                ) : (
                  release.pillars.map((pillar) => (
                    <div key={pillar.gameSlug} className="nx-pillar-block">
                      <h3 className="nx-pillar-header">{pillar.gameTitle}</h3>
                      <ul className="nx-pillar-changes">
                        {pillar.items.map((item) => (
                          <li key={item.id} className="nx-change-item">
                            <span className="nx-change-tag" data-tag={item.tag}>
                              {item.tag}
                            </span>
                            <div className="nx-change-content">
                              {item.itemVersion && (
                                <span className="nx-item-version">v{item.itemVersion}</span>
                              )}
                              {item.subject && (
                                <strong className="nx-change-subject">{item.subject}:</strong>
                              )}
                              <MarkdownRenderer content={item.description} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="nx-release-pillars">
                {release.tagGroups.length === 0 ? (
                  <p style={{ color: 'var(--nx-muted)', fontStyle: 'italic' }}>No change items added yet.</p>
                ) : (
                  release.tagGroups.map((group) => (
                    <div key={group.tag} className="nx-pillar-block">
                      <div className="nx-pillar-header">
                        <span>{group.tag} Updates</span>
                        <span className="nx-change-tag" data-tag={group.tag}>
                          {group.items.length}
                        </span>
                      </div>
                      <ul className="nx-pillar-changes">
                        {group.items.map((item) => (
                          <li key={item.id} className="nx-change-item">
                            <span className="nx-item-target-scope">
                              [{item.scope.targetId}]
                            </span>
                            <div className="nx-change-content">
                              {item.itemVersion && (
                                <span className="nx-item-version">v{item.itemVersion}</span>
                              )}
                              {item.subject && (
                                <strong className="nx-change-subject">{item.subject}:</strong>
                              )}
                              <MarkdownRenderer content={item.description} />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            )}

            <ReleaseAuthorByline
              author={release.meta.author}
              authorUsername={release.meta.authorUsername}
            />
          </article>
        )}
      </div>
    </div>
  )
}
