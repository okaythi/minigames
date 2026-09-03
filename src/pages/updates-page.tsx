import { useState, useMemo } from 'react'
import { usePublishedUpdates } from '../engine/updates'
import type { UpdateTag } from '../engine/updates'
import { BrokenFlaskEmptyState } from '../components/ui/broken-flask-empty-state'
import { MarkdownRenderer } from '../components/ui/rich-editor/markdown-renderer'
import { ReleaseAuthorByline } from '../components/ui/release-author-byline'
import './updates-page.css'


type ViewMode = 'by-game' | 'by-tag'

const ALL_TAGS: readonly UpdateTag[] = [
  'Balance',
  'New',
  'Fix',
  'Feature',
  'Polish',
]

export function UpdatesPage() {
  const { releases, loading } = usePublishedUpdates()
  const [viewMode, setViewMode] = useState<ViewMode>('by-game')
  const [selectedFilter, setSelectedFilter] = useState<string>('all')

  // Collect distinct game slugs and count matching releases
  const gameOptions = useMemo(() => {
    const titleMap = new Map<string, string>()
    const countMap = new Map<string, number>()

    titleMap.set('all', 'All Games')
    countMap.set('all', releases.length)

    for (const release of releases) {
      const seen = new Set<string>()
      for (const pillar of release.pillars) {
        if (!titleMap.has(pillar.gameSlug)) {
          titleMap.set(pillar.gameSlug, pillar.gameTitle)
        }
        if (!seen.has(pillar.gameSlug)) {
          seen.add(pillar.gameSlug)
          countMap.set(pillar.gameSlug, (countMap.get(pillar.gameSlug) ?? 0) + 1)
        }
      }
    }

    return Array.from(titleMap.entries()).map(([slug, title]) => ({
      id: slug,
      title,
      count: countMap.get(slug) ?? 0,
    }))
  }, [releases])

  // Collect tag options and count matching releases
  const tagOptions = useMemo(() => {
    const countMap = new Map<string, number>()
    countMap.set('all', releases.length)

    for (const release of releases) {
      const seen = new Set<string>()
      for (const group of release.tagGroups) {
        if (!seen.has(group.tag)) {
          seen.add(group.tag)
          countMap.set(group.tag, (countMap.get(group.tag) ?? 0) + 1)
        }
      }
    }

    return [
      { id: 'all', title: 'All Categories', count: countMap.get('all') ?? 0 },
      ...ALL_TAGS.map((tag) => ({
        id: tag,
        title: tag,
        count: countMap.get(tag) ?? 0,
      })),
    ]
  }, [releases])

  // Filter releases according to active viewMode and selectedFilter
  const filteredReleases = useMemo(() => {
    if (viewMode === 'by-game') {
      if (selectedFilter === 'all') {
        return releases
      }
      return releases
        .map((rel) => ({
          ...rel,
          pillars: rel.pillars.filter((p) => p.gameSlug === selectedFilter),
        }))
        .filter((rel) => rel.pillars.length > 0)
    }

    // viewMode === 'by-tag'
    if (selectedFilter === 'all') {
      return releases
    }
    return releases
      .map((rel) => ({
        ...rel,
        tagGroups: rel.tagGroups.filter((tg) => tg.tag === selectedFilter),
      }))
      .filter((rel) => rel.tagGroups.length > 0)
  }, [releases, viewMode, selectedFilter])

  return (
    <div className="nx-updates-page">
      <header className="nx-updates-header">
        <h1 className="nx-updates-title">Update Notes</h1>
        <p className="nx-updates-subtitle">
          Changelogs, balance adjustments, engine upgrades, and release history.
        </p>
      </header>

      {/* Integrated Controls Bar (Option 1: Nixlabs Brand Warmth) */}
      <div className="nx-updates-controls">
        <div className="nx-updates-toolbar">
          <nav className="nx-view-mode-toggle" aria-label="View mode switcher">
            <button
              type="button"
              className="nx-view-mode-btn"
              data-active={viewMode === 'by-game' ? 'true' : undefined}
              onClick={() => {
                setViewMode('by-game')
                setSelectedFilter('all')
              }}
            >
              By Game
            </button>
            <button
              type="button"
              className="nx-view-mode-btn"
              data-active={viewMode === 'by-tag' ? 'true' : undefined}
              onClick={() => {
                setViewMode('by-tag')
                setSelectedFilter('all')
              }}
            >
              By Category
            </button>
          </nav>

          <span className="nx-updates-count-indicator">
            {filteredReleases.length === 1 ? '1 update release' : `${filteredReleases.length} update releases`}
          </span>
        </div>

        {/* Dynamic Filter Pills */}
        <nav
          className="nx-updates-filters"
          aria-label={viewMode === 'by-game' ? 'Filter updates by game' : 'Filter updates by category'}
        >
          {(viewMode === 'by-game' ? gameOptions : tagOptions).map((opt) => {
            const isActive = selectedFilter === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                className="nx-updates-filter-btn"
                data-active={isActive ? 'true' : undefined}
                onClick={() => setSelectedFilter(opt.id)}
              >
                {isActive && <span className="nx-filter-active-pip" aria-hidden="true" />}
                <span className="nx-filter-title">{opt.title}</span>
                <span className="nx-filter-count">{opt.count}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Releases List */}
      <div className="nx-releases-list">
        {loading && releases.length === 0 ? (
          <p style={{ color: 'var(--nx-muted)', textAlign: 'center', padding: '32px' }}>Loading update history...</p>
        ) : releases.length === 0 ? (
          <BrokenFlaskEmptyState message="nothing to see here yet" subtitle="Our lab researchers haven't published any updates yet. Check back soon!" />
        ) : filteredReleases.length === 0 ? (
          <p style={{ color: 'var(--nx-muted)', textAlign: 'center', padding: '32px' }}>No updates match the selected filter.</p>
        ) : (
          filteredReleases.map((release) => (
            <article key={release.meta.id} className="nx-release-card">
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
                  {release.pillars.map((pillar) => (
                    <div key={pillar.gameSlug} className="nx-pillar-block">
                      <h3 className="nx-pillar-header">{pillar.gameTitle}</h3>
                      <ul className="nx-pillar-changes">
                        {pillar.items.map((item) => (
                          <li key={item.id} className="nx-change-item">
                            <span className="nx-change-tag" data-tag={item.tag}>
                              {item.tag}
                            </span>
                            <span>
                              {item.itemVersion && (
                                <span className="nx-item-version">v{item.itemVersion}</span>
                              )}
                              {item.subject && (
                                <strong className="nx-change-subject">{item.subject}:</strong>
                              )}
                              <MarkdownRenderer content={item.description} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="nx-release-pillars">
                  {release.tagGroups.map((group) => (
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
                            <span
                              style={{
                                fontFamily: 'var(--nx-font-mono)',
                                fontSize: '0.75rem',
                                color: 'var(--nx-muted)',
                                minWidth: '90px',
                                flexShrink: 0,
                              }}
                            >
                              [{item.scope.targetId}]
                            </span>
                            <span>
                              {item.itemVersion && (
                                <span className="nx-item-version">v{item.itemVersion}</span>
                              )}
                              {item.subject && (
                                <strong className="nx-change-subject">{item.subject}:</strong>
                              )}
                              <MarkdownRenderer content={item.description} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <ReleaseAuthorByline
                author={release.meta.author}
                authorUsername={release.meta.authorUsername}
              />
            </article>
          ))
        )}
      </div>

    </div>
  )
}
