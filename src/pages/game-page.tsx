import { Suspense } from 'react'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { Tag } from '../components/ui/tag'
import { compactCount } from '../lib/format'
import { findGame } from '../games/registry'
import { useGameStats } from '../services/stats/stats-provider'
import { NotFoundPage } from './not-found-page'
import { emptyGameStats } from './game-stats'
import './game-page.css'

interface GamePageProps {
  readonly slug: string
}

/**
 * The shell around a game: header, record strip, the game's own view, and the
 * design notes the game published. The page never reaches into engine modules -
 * it only reads the manifest and the stats service.
 */
export function GamePage({ slug }: GamePageProps) {
  const game = findGame(slug)
  const liveStats = useGameStats(slug)
  const stats = game === undefined ? emptyGameStats() : liveStats

  if (game === undefined) {
    return <NotFoundPage path={`/games/${slug}`} />
  }

  const { manifest } = game
  const highscore = stats.personalBest ?? stats.globalRecord

  return (
    <article className="nx-game">
      <header className="nx-game-head">
        <Link to={ROUTES.home} className="nx-back">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M10.4 3.6 5.6 8l4.8 4.4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          All games
        </Link>
        <div className="nx-game-title">
          <h1>{manifest.title}</h1>
          <p className="nx-lede">{manifest.tagline}</p>
        </div>
        <dl className="nx-game-stats">
          <div>
            <dt>Times played {stats.distributed ? '· global' : '· this device'}</dt>
            <dd>{compactCount(stats.plays)}</dd>
          </div>
          <div>
            <dt>{manifest.formatScore !== undefined ? 'Best time' : 'Highscore'}</dt>
            <dd>
              {manifest.formatScore !== undefined
                ? manifest.formatScore(highscore)
                : highscore === null
                  ? ''
                  : highscore}
            </dd>
          </div>
          <div>
            <dt>Global record</dt>
            <dd>
              {manifest.formatScore !== undefined
                ? manifest.formatScore(stats.globalRecord)
                : stats.globalRecord === null
                  ? ''
                  : compactCount(stats.globalRecord)}
            </dd>
          </div>
          <div>
            <dt>{`${manifest.bonusLabel} bank`}</dt>
            <dd>{compactCount(stats.candy)}</dd>
          </div>
        </dl>
      </header>

      {manifest.banner !== undefined && (
        <img className="nx-game-banner" src={manifest.banner} alt="" aria-hidden="true" />
      )}

      <div className="nx-game-play">
        <Suspense fallback={<div className="nx-loading" />}>
          <game.Component />
        </Suspense>
      </div>

      <section className="nx-game-notes">
        <div className="nx-game-about">
          <h2>How it works</h2>
          <p>{manifest.description}</p>
          <ul className="nx-mechanics">
            {(manifest.mechanics ?? []).map((mechanic) => (
              <li key={mechanic.title}>
                <h3>{mechanic.title}</h3>
                <p>{mechanic.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <aside className="nx-game-side">
          <h2>Controls</h2>
          <dl className="nx-control-list">
            {manifest.controls.map((control) => (
              <div key={control.input}>
                <dt>
                  <kbd>{control.input}</kbd>
                </dt>
                <dd>{control.action}</dd>
              </div>
            ))}
          </dl>
          <h2>Scoring</h2>
          <p className="nx-game-side-note">
            {manifest.scoringNote}
          </p>
          <ul className="nx-game-tags" style={{ marginTop: 6 }}>
            <li>
              <Tag>{manifest.scoreLabel}</Tag>
            </li>
            {manifest.tags.map((tag) => (
              <li key={tag}>
                <Tag>{tag}</Tag>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </article>
  )
}
