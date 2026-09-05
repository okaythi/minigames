import type { NinjaBelt } from '../types'
import {
  BELT_TO_RANK,
  getTierProgress,
} from '../../../../shared/progression'

interface BeltHudProps {
  readonly currentBelt: NinjaBelt
  readonly rank?: number
  readonly progress?: number
  readonly totalWins?: number
}

const BELT_NAMES = [
  'White',
  'Yellow',
  'Orange',
  'Green',
  'Blue',
  'Red',
  'Purple',
  'Brown',
  'Black',
  'Ninja Master',
] as const

export function BeltHud({ currentBelt, rank, progress = 0 }: BeltHudProps) {
  const currentRank = rank ?? BELT_TO_RANK[currentBelt] ?? 1

  // Current belt
  const currentName =
    currentRank >= 1 && currentRank <= 9
      ? BELT_NAMES[currentRank - 1] ?? 'White'
      : currentRank === 10
      ? 'Ninja Master'
      : 'White'

  const currentIconId =
    currentRank >= 1 && currentRank <= 9
      ? 4024 + currentRank
      : currentRank === 10
      ? 4033
      : 4025
  const currentIconUrl = `/games/card-jitsu/clothing/icons/${currentIconId}.png`

  // Next belt
  const nextRank = Math.min(10, currentRank + 1)
  const nextName =
    nextRank >= 1 && nextRank <= 9
      ? BELT_NAMES[nextRank - 1] ?? 'Yellow'
      : 'Ninja Master'

  const nextIconId =
    nextRank >= 1 && nextRank <= 9
      ? 4024 + nextRank
      : 4033
  const nextIconUrl = `/games/card-jitsu/clothing/icons/${nextIconId}.png`

  // Progress calculations
  const tier = getTierProgress(currentRank, progress)
  const pct = tier.isMax
    ? 100
    : tier.neededInTier > 0
    ? Math.max(0, Math.min(100, Math.round((tier.currentInTier / tier.neededInTier) * 100)))
    : 0

  return (
    <div
      className="nx-horizontal-hud-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '10px 20px',
        gap: '16px',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* Current Belt: [belt png] Name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <img
          src={currentIconUrl}
          alt={currentName}
          width={48}
          height={48}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <span style={{ fontSize: '16px', fontWeight: 650, color: 'var(--nx-ink, #232324)' }}>
          {currentName}
        </span>
      </div>

      {/* Progress Pill Filled Orange (readme.md has colours: #f6821f) */}
      <div
        style={{
          flex: 1,
          maxWidth: '480px',
          minWidth: '100px',
          height: '16px',
          backgroundColor: 'rgba(0, 0, 0, 0.08)',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.12)',
          border: '1px solid rgba(0, 0, 0, 0.05)',
          borderRadius: '9999px',
          overflow: 'hidden',
          padding: '2px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: 'var(--nx-orange, #f6821f)',
            borderRadius: '9999px',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      {/* Next Belt: [belt png][next belt name] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <img
          src={nextIconUrl}
          alt={nextName}
          width={48}
          height={48}
          style={{ objectFit: 'contain', flexShrink: 0 }}
        />
        <span style={{ fontSize: '16px', fontWeight: 650, color: 'var(--nx-ink, #232324)' }}>
          {nextName}
        </span>
      </div>
    </div>
  )
}
