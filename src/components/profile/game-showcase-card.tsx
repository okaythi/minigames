import type { UserPublicProfileResponse } from '../../../shared/auth-protocol'
import type { GameManifest } from '../../../shared/game-manifest'
import { getGamePlugin } from '../../games/registry'
import { Link } from '../../app/link'
import { ROUTES } from '../../app/parse-route'

export interface GameShowcaseCardProps {
  readonly manifest: GameManifest
  readonly profile: UserPublicProfileResponse
  readonly isOwner: boolean
}

export function GameShowcaseCard({ manifest, profile, isOwner }: GameShowcaseCardProps) {
  const plugin = getGamePlugin(manifest.slug)
  const gameStat = profile.games[manifest.slug]

  const cardProps = {
    profile,
    stat: gameStat,
    isOwner,
    manifest,
  }

  // If plugin provides a full custom card component, delegate entirely
  if (plugin?.profileCard?.CustomCard) {
    const CustomCard = plugin.profileCard.CustomCard
    return <CustomCard {...cardProps} />
  }

  const userBest = gameStat?.highscore ?? null
  const globalRecord = gameStat?.globalHighscore ?? null
  const plays = gameStat?.plays ?? 0
  const isRecord = gameStat?.isRecordHolder ?? false
  const percentile = gameStat?.percentile ?? 'Top 50%'

  // Scoring formatters
  const formatScore = plugin?.scoring?.formatScore ?? manifest.formatScore
  const formattedBest =
    userBest !== null
      ? formatScore
        ? formatScore(userBest)
        : userBest.toLocaleString()
      : '—'

  const formattedGlobal =
    globalRecord !== null && (plugin?.scoring?.hasValidScore ? plugin.scoring.hasValidScore(globalRecord) : true)
      ? formatScore
        ? formatScore(globalRecord)
        : globalRecord.toLocaleString()
      : '—'

  // Metric blocks: pluggable or default (PB + WR)
  const metrics = plugin?.profileCard?.getMetrics?.(cardProps) ?? [
    { label: 'Personal Best', value: formattedBest },
    { label: 'World Record', value: formattedGlobal },
  ]

  // Runs label: pluggable or default
  const runsCountLabel = plugin?.profileCard?.runsLabel
    ? `${plays} ${plugin.profileCard.runsLabel}`
    : `${plays} ${plays === 1 ? 'Run Played' : 'Runs Played'}`

  // Action button labels: pluggable or default
  const actionText = isOwner
    ? plugin?.profileCard?.actionLabel?.owner ?? 'Play Again'
    : plugin?.profileCard?.actionLabel?.other ?? 'Challenge PB'

  return (
    <div className="nx-game-showcase-card">
      <div className="nx-game-card-cover">
        {plugin?.profileCard?.renderCover ? (
          plugin.profileCard.renderCover(cardProps)
        ) : (
          <img src={manifest.cover} alt={manifest.title} />
        )}
      </div>

      <div className="nx-game-card-content">
        <div className="nx-game-card-header">
          <div className="nx-game-card-title-group">
            <h3 className="nx-game-card-title">{manifest.title}</h3>
            <p className="nx-game-card-tagline">{manifest.tagline}</p>
          </div>

          {isRecord && !plugin?.profileCard?.runsLabel && (
            <div className="nx-record-holder-badge">
              <span>🏆</span>
              <span>WORLD RECORD</span>
            </div>
          )}
        </div>

        <div className="nx-game-metrics-row">
          {metrics.map((m) => (
            <div key={m.label} className="nx-metric-block">
              <span className="nx-metric-label">{m.label}</span>
              <span className="nx-metric-value">{m.value}</span>
            </div>
          ))}

          <div className="nx-metric-percentile">{percentile}</div>
        </div>

        <div className="nx-game-card-footer">
          <span className="nx-game-runs-count">{runsCountLabel}</span>

          <Link to={ROUTES.game(manifest.slug)} className="nx-game-challenge-btn">
            <span>{actionText}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
