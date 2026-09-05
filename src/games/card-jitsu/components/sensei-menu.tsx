import './sensei-menu.css'

interface SenseiMenuProps {
  readonly onEarnBelts: () => void
  readonly onChallengeSensei: () => void
  readonly onInstructions: () => void
}

/**
 * Authentic Disney Card-Jitsu Start Menu:
 * Sensei sits cross-legged on his green cushion in the Dojo
 * matching media_1788561640708.png with interactive wooden choices.
 */
export function SenseiMenu({
  onEarnBelts,
  onChallengeSensei,
  onInstructions,
}: SenseiMenuProps) {
  return (
    <div className="nx-sensei-dialogue-container">
      <div className="nx-sensei-dialogue-stage">
        <img
          src="/games/card-jitsu/sensei-dialogue.png"
          alt="Sensei Dialogue"
          className="nx-sensei-dialogue-image"
          draggable={false}
        />

        {/* Interactive Clickable Hotspots mapped directly over the wooden plaques */}
        <button
          type="button"
          className="nx-sensei-hotspot nx-sensei-hotspot-belts"
          onClick={onEarnBelts}
          title="Earn your belts"
          aria-label="Earn your belts"
        >
          <span className="nx-sensei-hotspot-hover" />
        </button>

        <button
          type="button"
          className="nx-sensei-hotspot nx-sensei-hotspot-sensei"
          onClick={onChallengeSensei}
          title="Challenge Sensei"
          aria-label="Challenge Sensei"
        >
          <span className="nx-sensei-hotspot-hover" />
        </button>

        <button
          type="button"
          className="nx-sensei-hotspot nx-sensei-hotspot-instructions"
          onClick={onInstructions}
          title="Instructions"
          aria-label="Instructions"
        >
          <span className="nx-sensei-hotspot-hover" />
        </button>
      </div>
    </div>
  )
}
