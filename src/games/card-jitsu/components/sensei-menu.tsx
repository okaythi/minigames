import './sensei-menu.css'

interface SenseiMenuProps {
  readonly onEarnBelts: () => void
  readonly onChallengeSensei: () => void
  readonly onInstructions: () => void
}

/**
 * Authentic Disney Card-Jitsu Start Menu:
 * Sensei sits cross-legged on his green meditation cushion in the Dojo
 * with the speech bubble and wooden choice plaques.
 */
export function SenseiMenu({
  onEarnBelts,
  onChallengeSensei,
  onInstructions,
}: SenseiMenuProps) {
  return (
    <div className="nx-sensei-dialogue-container">
      <div className="nx-dojo-background-layer" />

      <div className="nx-sensei-scene">
        {/* Speech Bubble */}
        <div className="nx-sensei-speech-bubble">
          <p className="nx-sensei-speech-text">
            Do you wish to play and compete with another student, grasshopper?
          </p>
        </div>

        {/* Sensei on Green Mat */}
        <div className="nx-sensei-figure">
          <div className="nx-sensei-mat" />
          <svg
            className="nx-sensei-character-svg"
            viewBox="0 0 100 100"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Body */}
            <ellipse cx="50" cy="58" rx="34" ry="30" fill="#757575" />
            {/* White belly */}
            <ellipse cx="50" cy="62" rx="20" ry="22" fill="#ECEFF1" />
            {/* Robe */}
            <path
              d="M20 54 Q50 68 80 54 L75 84 Q50 90 25 84 Z"
              fill="#5D4037"
              stroke="#3E2723"
              strokeWidth="2"
            />
            {/* Belt */}
            <rect x="30" y="70" width="40" height="8" rx="2" fill="#212121" />
            {/* Head */}
            <circle cx="50" cy="34" r="22" fill="#757575" />
            {/* Eyes */}
            <ellipse cx="43" cy="30" rx="3.5" ry="4.5" fill="#212121" />
            <circle cx="44" cy="29" r="1.5" fill="#ffffff" />
            <ellipse cx="57" cy="30" rx="3.5" ry="4.5" fill="#212121" />
            <circle cx="58" cy="29" r="1.5" fill="#ffffff" />
            {/* Beak */}
            <polygon points="46,33 54,33 50,42" fill="#FFA000" stroke="#E65100" strokeWidth="1" />
            {/* Bushy white eyebrows */}
            <path
              d="M34 24 Q44 22 48 26 Q44 26 34 24 Z"
              fill="#ECEFF1"
              stroke="#B0BEC5"
              strokeWidth="0.8"
            />
            <path
              d="M66 24 Q56 22 52 26 Q56 26 66 24 Z"
              fill="#ECEFF1"
              stroke="#B0BEC5"
              strokeWidth="0.8"
            />
            {/* Long white beard */}
            <path
              d="M44 42 Q50 43 56 42 Q53 66 50 72 Q47 66 44 42 Z"
              fill="#ECEFF1"
              stroke="#CFD8DC"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* 3 Wooden Options */}
        <div className="nx-sensei-options">
          <button
            type="button"
            className="nx-wood-button"
            onClick={onEarnBelts}
          >
            <span>🥋</span>
            <span>Earn your belts</span>
          </button>

          <button
            type="button"
            className="nx-wood-button nx-wood-primary"
            onClick={onChallengeSensei}
          >
            <span>⚔️</span>
            <span>Challenge Sensei</span>
          </button>

          <button
            type="button"
            className="nx-wood-button"
            onClick={onInstructions}
          >
            <span>📜</span>
            <span>Instructions</span>
          </button>
        </div>
      </div>
    </div>
  )
}
