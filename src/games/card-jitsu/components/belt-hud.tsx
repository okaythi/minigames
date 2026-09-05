import type { NinjaBelt } from '../types'
import {
  BELT_PROGRESSION,
  BELT_TO_RANK,
  getTierProgress,
} from '../../../../shared/progression'

interface BeltHudProps {
  readonly currentBelt: NinjaBelt
  readonly rank?: number | undefined
  readonly progress?: number | undefined
  readonly totalWins?: number | undefined
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

  return (
    <dl className="nx-horizontal-hud-bar">
      <div className="nx-horizontal-hud-cell">
        <dt>Belt</dt>
        <dd>{beltName}</dd>
      </div>
      <div className="nx-horizontal-hud-cell">
        <dt>Progress to next</dt>
        <dd>{progressText}</dd>
      </div>
    </dl>
  )
}
