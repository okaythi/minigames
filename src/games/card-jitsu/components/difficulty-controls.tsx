import type { NinjaBelt, SenseiDifficulty } from '../types'
import { BELT_PROGRESSION } from '../types'
import './difficulty-controls.css'

interface DifficultyControlsProps {
  readonly currentBelt: NinjaBelt
  readonly difficulty: SenseiDifficulty
  readonly onSelectDifficulty: (mode: SenseiDifficulty) => void
  readonly onSelectBelt?: (belt: NinjaBelt) => void
}

const DIFFICULTIES: readonly {
  readonly id: SenseiDifficulty
  readonly label: string
  readonly desc: string
  readonly badge?: string
}[] = [
  {
    id: 'easy',
    label: 'Easy',
    desc: 'Novice',
  },
  {
    id: 'medium',
    label: 'Medium',
    desc: 'Balanced',
  },
  {
    id: 'hard',
    label: 'Hard',
    desc: 'Grandmaster',
  },
  {
    id: 'ninja',
    label: 'Ninja 🥷',
    desc: 'Can only be unlocked by defeating Sensei on Hard mode',
    badge: 'Requires Black Belt',
  },
]

export function DifficultyControls({
  currentBelt,
  difficulty,
  onSelectDifficulty,
  onSelectBelt,
}: DifficultyControlsProps) {
  const currentBeltInfo =
    BELT_PROGRESSION.find((b) => b.belt === currentBelt) ?? BELT_PROGRESSION[0]!

  return (
    <div className="nx-difficulty-strip">
      <div
        className="nx-belt-display"
        style={{ cursor: onSelectBelt ? 'pointer' : 'default' }}
        onClick={() => {
          if (!onSelectBelt) return
          const currentIndex = BELT_PROGRESSION.findIndex((b) => b.belt === currentBelt)
          const nextIndex = (currentIndex + 1) % BELT_PROGRESSION.length
          const nextBelt = BELT_PROGRESSION[nextIndex]?.belt
          if (nextBelt) onSelectBelt(nextBelt)
        }}
        title="Click to cycle ninja belt rank"
      >
        <div
          className="nx-belt-swatch"
          style={{ backgroundColor: currentBeltInfo.colorHex }}
        />
        <div>
          <div className="nx-belt-title">
            {currentBeltInfo.name} <span style={{ opacity: 0.6, fontSize: '11px' }}>🔄</span>
          </div>
          <div className="nx-belt-sub">
            {currentBelt === 'black'
              ? 'Ninja Master Rank (Eligible to defeat Ninja Sensei)'
              : `Next rank: ${currentBeltInfo.requiredWins} total wins`}
          </div>
        </div>
      </div>

      <div className="nx-difficulty-pills">
        {DIFFICULTIES.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`nx-diff-pill ${difficulty === d.id ? 'active' : ''}`}
            onClick={() => onSelectDifficulty(d.id)}
            title={d.desc}
          >
            {d.label}
            {d.badge && difficulty !== d.id && (
              <span
                style={{
                  fontSize: '10px',
                  marginLeft: '6px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                {d.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
