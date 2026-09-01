import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { Tag } from '../components/ui/tag'
import { compactCount } from '../lib/format'
import { useGameStats } from '../services/stats/stats-provider'
import type { GameManifest, GameStatus } from './types'
import './game-card.css'

const STATUS_LABEL: Readonly<Record<GameStatus, string>> = {
  playable: 'Playable',
  prototype: 'Prototype',
  'coming-soon': 'In the lab',
}

/**
 * One card, three columns of them on the home page. The order is fixed by the
 * spec: image, name, description, times played, then the high score - which is
 * simply not printed when it does not exist yet.
 */
export function GameCard({ manifest }: { readonly manifest: GameManifest }) {
  const stats = useGameStats(manifest.slug)
  const highscore = stats.personalBest ?? stats.globalRecord

  return (
    <article className="nx-card" data-accent={manifest.accent}>
      <Link to={ROUTES.game(manifest.slug)} className="nx-card-media" tabIndex={-1} aria-hidden="true">
        <img src={manifest.cover} alt="" loading="lazy" decoding="async" />
        <span className="nx-card-cta">
          Play
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M5.4 3.4 10.6 8l-5.2 4.6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </Link>

      <div className="nx-card-body">
        <div className="nx-card-head">
          <h3 className="nx-card-title">
            <Link to={ROUTES.game(manifest.slug)}>{manifest.title}</Link>
          </h3>
          <Tag>{STATUS_LABEL[manifest.status]}</Tag>
        </div>

        <p className="nx-card-desc">{manifest.description}</p>

        <dl className="nx-card-meta">
          <div>
            <dt>
              Times played <span className="nx-card-scope">{stats.distributed ? '· global' : '· this device'}</span>
            </dt>
            <dd>
              {compactCount(stats.plays)}
              <em> runs</em>
            </dd>
          </div>
          <div>
            <dt>Highscore</dt>
            <dd>{highscore === null ? '' : `${highscore}`}</dd>
          </div>
        </dl>

        <ul className="nx-card-tags">
          {manifest.tags.slice(0, 4).map((tag) => (
            <li key={tag}>
              <Tag>{tag}</Tag>
            </li>
          ))}
        </ul>
      </div>
    </article>
  )
}
