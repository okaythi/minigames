import type { NinjaBelt } from '../types'
import {
  BELT_PROGRESSION,
  BELT_TO_RANK,
  getTierProgress,
} from '../../../../shared/progression'

interface BeltHudProps {
  readonly currentBelt: NinjaBelt
  readonly rank?: number
  readonly progress?: number
  readonly totalWins?: number
}

export function BeltHud({ currentBelt, rank, progress = 0 }: BeltHudProps) {
  const currentRank = rank ?? BELT_TO_RANK[currentBelt] ?? 1
  const beltName =
    currentRank >= 1 && currentRank <= 9
      ? BELT_PROGRESSION[currentRank - 1]?.name ?? 'White Belt'
      : currentRank === 10
      ? 'Ninja Master'
      : 'White Belt'

  const tier = getTierProgress(currentRank, progress)
  const progressText = tier.isMax ? 'Max' : `${tier.currentInTier} / ${tier.neededInTier}`

  const iconId =
    currentRank >= 1 && currentRank <= 9
      ? 4024 + currentRank
      : currentRank === 10
      ? 4033
      : 4025
  const iconUrl = `/games/card-jitsu/clothing/icons/${iconId}.png`

  return (
    <dl className="nx-horizontal-hud-bar">
      <div className="nx-horizontal-hud-cell">
        <dt>Belt</dt>
        <dd>
          <img
            src={iconUrl}
            alt={beltName}
            width={24}
            height={24}
            style={{ objectFit: 'contain', verticalAlign: 'middle', flexShrink: 0 }}
          />
          <span>{beltName}</span>
        </dd>
      </div>
      <div className="nx-horizontal-hud-cell">
        <dt>Progress to next</dt>
        <dd>{progressText}</dd>
      </div>
    </dl>
  )
}
