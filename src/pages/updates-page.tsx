import { useState, useMemo } from 'react'
import { UPDATE_RELEASES } from '../data/updates'
import './updates-page.css'

export function UpdatesPage() {
  const [selectedGame, setSelectedGame] = useState<string>('all')

  // Collect distinct game slugs and titles
  const gameOptions = useMemo(() => {
    const map = new Map<string, string>()
    map.set('all', 'All Updates')
    for (const release of UPDATE_RELEASES) {
      for (const pillar of release.pillars) {
        if (!map.has(pillar.gameSlug)) {
          map.set(pillar.gameSlug, pillar.gameTitle)
        }
      }
    }
    return Array.from(map.entries()).map(([slug, title]) => ({ slug, title }))
  }, [])

  // Filter releases and their pillars
  const filteredReleases = useMemo(() => {
    if (selectedGame === 'all') {
      return UPDATE_RELEASES
    }
    return UPDATE_RELEASES.map((release) => {
      const matchingPillars = release.pillars.filter((p) => p.gameSlug === selectedGame)
      return {
        ...release,
        pillars: matchingPillars,
      }
    }).filter((release) => release.pillars.length > 0)
  }, [selectedGame])

  return (
    <div className="nx-updates-page">
      <header className="nx-updates-header">
        <h1 className="nx-updates-title">Update Notes</h1>
        <p className="nx-updates-subtitle">
          Changelogs, balance adjustments, engine upgrades, and release history.
        </p>
      </header>

      {/* Pillar filter pills */}
      <nav className="nx-updates-filters" aria-label="Filter updates by game">
        {gameOptions.map((opt) => (
          <button
            key={opt.slug}
            type="button"
            className="nx-updates-filter-btn"
            data-active={selectedGame === opt.slug ? 'true' : undefined}
            onClick={() => setSelectedGame(opt.slug)}
          >
            {opt.title}
          </button>
        ))}
      </nav>

      {/* Releases List */}
      <div className="nx-releases-list">
        {filteredReleases.map((release) => (
          <article key={release.version} className="nx-release-card">
            <div className="nx-release-meta-row">
              <span className="nx-release-version">v{release.version}</span>
              <time className="nx-release-date">{release.date}</time>
            </div>

            <h2 className="nx-release-title">{release.title}</h2>

            {release.developerRationale && (
              <section className="nx-release-rationale" aria-label="Developer notes">
                <div className="nx-release-rationale-title">Developer Rationale</div>
                <p className="nx-release-rationale-text">{release.developerRationale}</p>
              </section>
            )}

            <div className="nx-release-pillars">
              {release.pillars.map((pillar) => (
                <div key={pillar.gameSlug} className="nx-pillar-block">
                  <h3 className="nx-pillar-header">{pillar.gameTitle}</h3>
                  <ul className="nx-pillar-changes">
                    {pillar.changes.map((change, idx) => (
                      <li key={idx} className="nx-change-item">
                        <span className="nx-change-tag" data-tag={change.tag}>
                          {change.tag}
                        </span>
                        <span>
                          {change.subject && (
                            <strong className="nx-change-subject">{change.subject}:</strong>
                          )}
                          {change.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
