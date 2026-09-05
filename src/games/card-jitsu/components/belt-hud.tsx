import type { NinjaBelt } from '../types'
import {
  BELT_PROGRESSION,
  BELT_TO_RANK,
  getNextRank,
  getRankBelt,
} from '../engine/progression'

interface BeltHudProps {
  readonly currentBelt: NinjaBelt
  readonly totalWins: number
}

export function BeltHud({ currentBelt, totalWins }: BeltHudProps) {
  const currentRank = BELT_TO_RANK[currentBelt] ?? 1
  const currentInfo = BELT_PROGRESSION.find((b) => b.belt === currentBelt) ?? BELT_PROGRESSION[0]!
  const nextRank = getNextRank(currentRank)
  const nextBelt = nextRank !== null ? getRankBelt(nextRank) : null
  const nextInfo = nextBelt ? BELT_PROGRESSION.find((b) => b.belt === nextBelt) : null
  const progressText = nextInfo ? `${totalWins} / ${nextInfo.requiredWins}` : 'Max'

  return (
    <dl className="nx-horizontal-hud-bar">
      <div className="nx-horizontal-hud-cell">
        <dt>Belt</dt>
        <dd>{currentInfo.name}</dd>
      </div>
      <div className="nx-horizontal-hud-cell">
        <dt>Progress to next</dt>
        <dd>{progressText}</dd>
      </div>
    </dl>
  )
}
