import { Suspense, useEffect, useState } from 'react'
import { Link } from '../app/link'
import { ROUTES } from '../app/parse-route'
import { useRouter } from '../app/router'
import { Tag } from '../components/ui/tag'
import { compactCount } from '../lib/format'
import { findGame } from '../games/registry'
import { useGameStats } from '../services/stats/stats-provider'
import { setCurrentlyPlaying } from '../services/presence-service'
import { getChallenge, resolveChallenge } from '../services/social-api'
import { useCanSeeBetaGames } from '../services/auth-api'
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
  const { route, navigate } = useRouter()
  const { canSeeBetaGames, loading: authLoading } = useCanSeeBetaGames()
  const challengeId = route.name === 'game' ? route.query['challengeId'] : undefined
  const [challenge, setChallenge] = useState<any>(null)
  const [challengeWon, setChallengeWon] = useState(false)

  const game = findGame(slug)
  const isBetaGame = game?.manifest.flag === 'GAME_BETA' || game?.manifest.gameFlag === 'GAME_BETA'

  useEffect(() => {
    if (authLoading) return
    if (isBetaGame && !canSeeBetaGames) {
      navigate(ROUTES.home, { replace: true })
    }
  }, [authLoading, isBetaGame, canSeeBetaGames, navigate])

  const liveStats = useGameStats(slug)
  const stats = game === undefined ? emptyGameStats() : liveStats

  useEffect(() => {
    if (isBetaGame && !canSeeBetaGames) return
    setCurrentlyPlaying(slug)
    return () => {
      setCurrentlyPlaying(null)
    }
  }, [slug, isBetaGame, canSeeBetaGames])

  useEffect(() => {
    if (!challengeId) return
    let active = true
    getChallenge(challengeId).then((ch) => {
      if (active && ch) setChallenge(ch)
    })
    return () => {
      active = false
    }
  }, [challengeId])

  useEffect(() => {
    if (!challenge || challenge.status !== 'pending' || !challengeId) return
    const currentBest = stats.personalBest ?? 0
    if (currentBest >= challenge.targetScore && !challengeWon) {
      resolveChallenge(challengeId, currentBest).then((res) => {
        if (res.won) {
          setChallengeWon(true)
          setChallenge((prev: any) => (prev ? { ...prev, status: 'completed' } : null))
        }
      })
    }
  }, [stats.personalBest, challenge, challengeId, challengeWon])

  if (game === undefined) {
    return <NotFoundPage path={`/games/${slug}`} />
  }

  // Block rendering of beta game if user does not have STAFF flag
  if (isBetaGame && !canSeeBetaGames) {
    return null
  }

  const { manifest } = game
  const highscore = stats.personalBest ?? stats.globalRecord

  return (
    <article className="nx-game" data-slug={slug} data-layout={manifest.layout ?? 'standard'}>
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
        <img
          className="nx-game-banner"
          src={manifest.banner}
          alt=""
          aria-hidden="true"
          draggable={false}
          data-protected-image="true"
          style={manifest.bannerAspectRatio ? { aspectRatio: manifest.bannerAspectRatio } : undefined}
        />
      )}

      {challenge && (
        <div
          className="nx-challenge-banner"
          style={{
            background: challengeWon ? 'rgba(31, 157, 91, 0.12)' : 'var(--nx-card)',
            border: `1px solid ${challengeWon ? 'var(--nx-green)' : 'var(--nx-orange)'}`,
            borderRadius: 'var(--nx-radius, 8px)',
            padding: '12px 18px',
            margin: '0 auto 16px',
            maxWidth: '520px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{challengeWon ? '🏆' : '⚔️'}</span>
            <div>
              <strong style={{ display: 'block', color: 'var(--nx-ink)', fontSize: '13.5px' }}>
                {challengeWon
                  ? 'Challenge Defeated!'
                  : `Challenge from @${challenge.challengerUsername}`}
              </strong>
              <span style={{ color: 'var(--nx-slate)', fontSize: '12px' }}>
                Target to beat:{' '}
                <strong style={{ color: 'var(--nx-ink)' }}>
                  {manifest.formatScore ? manifest.formatScore(challenge.targetScore) : challenge.targetScore}
                </strong>
              </span>
            </div>
          </div>
          {challenge.bountyCandy > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'rgba(251, 173, 65, 0.15)',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid rgba(251, 173, 65, 0.3)',
              }}
            >
              <span>🍬</span>
              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--nx-ink)' }}>
                {challenge.bountyCandy} Candy
              </span>
            </div>
          )}
        </div>
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
