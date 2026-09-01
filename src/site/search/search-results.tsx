import { Highlighted } from './highlight'
import type { SearchResult } from './use-game-search'

interface SearchResultsProps {
  readonly listId: string
  readonly showPanel: boolean
  readonly results: readonly SearchResult[]
  readonly trimmed: string
  readonly activeIndex: number
  readonly status: string
  readonly onSelectIndex: (index: number) => void
  readonly onSelectGame: (slug: string) => void
}

export function SearchResults({
  listId,
  showPanel,
  results,
  trimmed,
  activeIndex,
  status,
  onSelectIndex,
  onSelectGame,
}: SearchResultsProps) {
  return (
    <div
      className="nx-search-panel"
      id={listId}
      role="listbox"
      aria-label="Game matches"
      data-empty={showPanel && results.length === 0 ? 'true' : undefined}
    >
      {showPanel &&
        (results.length === 0 ? (
          <p className="nx-search-none">
            Nothing in the lab matches <strong>“{trimmed}”</strong>. Try “avoid”, “spikes” or “arcade”.
          </p>
        ) : (
          <ul className="nx-search-list">
            {results.map((result, index) => (
              <li key={result.manifest.slug}>
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className="nx-search-item"
                  data-active={index === activeIndex ? 'true' : undefined}
                  onMouseEnter={() => onSelectIndex(index)}
                  onClick={() => onSelectGame(result.manifest.slug)}
                >
                  <img className="nx-search-thumb" src={result.manifest.cover} alt="" />
                  <span className="nx-search-copy">
                    <span className="nx-search-title">
                      <Highlighted text={result.manifest.title} match={result.titleMatch} />
                    </span>
                    <span className="nx-search-tagline">{result.manifest.tagline}</span>
                  </span>
                  <span className="nx-search-meta">
                    {result.matchedTags.slice(0, 1).map((tag: string) => (
                      <em key={tag}>{tag}</em>
                    ))}
                    <svg viewBox="0 0 16 16" aria-hidden="true">
                      <path
                        d="M5.5 3.2 10.6 8l-5.1 4.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ))}
      <p className="sr-only" aria-live="polite">
        {status}
      </p>
    </div>
  )
}
