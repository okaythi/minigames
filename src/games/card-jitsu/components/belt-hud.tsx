import type { NinjaBelt } from '../types'
import {
  BELT_PROGRESSION,
  BELT_TO_RANK,
  getNextRank,
  getRankBelt,
} from '../engine/progression'
import './belt-hud.css'

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
  const requiredWins = nextInfo ? nextInfo.requiredWins : 'MAX'

  return (
    <div className="nx-cj-belt-hud">
      <div className="nx-cj-belt-cell">
        <span className="nx-cj-hud-label">Current Belt</span>
        <span className="nx-cj-hud-value" style={{ color: currentInfo.colorHex }}>
          <span
            className="nx-cj-belt-swatch"
            style={{ backgroundColor: currentInfo.colorHex }}
          />
          {currentInfo.name} (Rank {currentRank})
        </span>
      </div>

      <div className="nx-cj-belt-cell">
        <span className="nx-cj-hud-label">Next Belt</span>
        <span className="nx-cj-hud-value">
          {nextInfo ? (
            <>
              <span
                className="nx-cj-belt-swatch"
                style={{ backgroundColor: nextInfo.colorHex }}
              />
              {nextInfo.name}
            </>
          ) : (
            '🥋 Sensei Challenge'
          )}
        </span>
      </div>

      <div className="nx-cj-belt-cell">
        <span className="nx-cj-hud-label">Matches Won</span>
        <span className="nx-cj-hud-value">{totalWins}</span>
      </div>

      <div className="nx-cj-belt-cell">
        <span className="nx-cj-hud-label">Wins Needed</span>
        <span className="nx-cj-hud-value">
          {nextInfo ? `${totalWins} / ${requiredWins}` : 'Ready for Sensei'}
        </span>
      </div>
    </div>
  )
}
