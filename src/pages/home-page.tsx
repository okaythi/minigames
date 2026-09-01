import { useState } from 'react'
import { Button } from '../components/ui/button'
import { GameGrid } from '../games/game-grid'
import { useStatsController } from '../services/stats/stats-provider'
import { compactCount } from '../lib/format'
import { MANIFESTS, gameCount } from '../games/registry'
import { LOAD_MORE, pageLimit } from './pagination'
import './pages.css'

/** 9 cards, then +6 per press, exactly as specified. */
export function HomePage() {
  const { uniquePlayers } = useStatsController()
  const [page, setPage] = useState(1)
  const limit = pageLimit(page)
  const shown = MANIFESTS.slice(0, limit)
  const remaining = Math.max(0, gameCount - shown.length)

  return (
    <div className="nx-home">
      <section className="nx-hero">
        <div className="nx-hero-copy">
          <h1>Small games, shipped from my lab.</h1>
          <p className="nx-lede">A collection of games previously made by me and new ones!</p>
        </div>
        <dl className="nx-hero-stats">
          <div>
            <dt>Catalogue</dt>
            <dd>{gameCount}</dd>
          </div>
          <div>
            <dt>Unique players</dt>
            <dd>{compactCount(uniquePlayers)}</dd>
          </div>
        </dl>
      </section>

      <hr className="nx-hairline" />

      <GameGrid games={shown} label="All games" />

      <div className="nx-more">
        {remaining > 0 ? (
          <>
            <Button variant="default" size="large" onClick={() => setPage((value) => value + 1)}>
              View more
              <span className="nx-more-count">+{Math.min(LOAD_MORE, remaining)}</span>
            </Button>
            <p className="nx-more-note">
              Showing {shown.length} of {gameCount}
            </p>
          </>
        ) : (
          <p className="nx-more-note">
            {shown.length} of {gameCount} games · that is the whole lab for now
          </p>
        )}
      </div>
    </div>
  )
}
