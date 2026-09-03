import { useState, useRef, useEffect } from 'react'
import { MANIFESTS } from '../../games/registry'

interface CustomChallengePanelProps {
  readonly selectedGame: string
  readonly onSelectGame: (slug: string) => void
  readonly targetScore: number
  readonly onChangeTargetScore: (score: number) => void
  readonly bountyCandy: number
  readonly onChangeBountyCandy: (candy: number) => void
  readonly onSendChallenge: () => void
  readonly onClose: () => void
}

export function CustomChallengePanel({
  selectedGame,
  onSelectGame,
  targetScore,
  onChangeTargetScore,
  bountyCandy,
  onChangeBountyCandy,
  onSendChallenge,
  onClose,
}: CustomChallengePanelProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const activeManifest = MANIFESTS.find((m) => m.slug === selectedGame) ?? MANIFESTS[0]

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [dropdownOpen])

  const handleScoreChange = (val: number) => {
    const clamped = Math.max(1, Math.min(999999, Math.floor(val) || 1))
    onChangeTargetScore(clamped)
  }

  const handleBountyChange = (val: number) => {
    const clamped = Math.max(0, Math.min(10000, Math.floor(val) || 0))
    onChangeBountyCandy(clamped)
  }

  return (
    <div className="nx-challenge-panel" role="region" aria-label="Game challenge configuration">
      <div className="nx-challenge-panel-header">
        <span className="nx-challenge-panel-title">Send Game Challenge</span>
        <button
          type="button"
          className="nx-chat-close-btn"
          onClick={onClose}
          aria-label="Close challenge panel"
        >
          ✕
        </button>
      </div>

      <div className="nx-challenge-field">
        <label className="nx-challenge-label" id="game-select-label">
          Game
        </label>
        <div className="nx-custom-select" ref={dropdownRef}>
          <button
            type="button"
            className="nx-custom-select-trigger"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            aria-expanded={dropdownOpen}
            aria-haspopup="listbox"
            aria-labelledby="game-select-label"
          >
            <span className="nx-custom-select-value">{activeManifest?.title ?? selectedGame}</span>
            <span className={`nx-custom-select-arrow ${dropdownOpen ? 'nx-open' : ''}`}>▾</span>
          </button>

          {dropdownOpen && (
            <ul className="nx-custom-select-options" role="listbox" tabIndex={-1}>
              {MANIFESTS.map((m) => {
                const isSelected = m.slug === selectedGame
                return (
                  <li
                    key={m.slug}
                    role="option"
                    aria-selected={isSelected}
                    className={`nx-custom-select-option ${isSelected ? 'nx-selected' : ''}`}
                    onClick={() => {
                      onSelectGame(m.slug)
                      setDropdownOpen(false)
                    }}
                  >
                    <span>{m.title}</span>
                    {isSelected && <span className="nx-custom-select-check">✓</span>}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="nx-challenge-grid">
        <div className="nx-challenge-field">
          <label className="nx-challenge-label" htmlFor="nx-target-score-input">
            Target Score
          </label>
          <div className="nx-custom-stepper">
            <button
              type="button"
              className="nx-custom-stepper-btn"
              onClick={() => handleScoreChange(targetScore - 10)}
              aria-label="Decrease target score"
            >
              −
            </button>
            <input
              id="nx-target-score-input"
              type="text"
              inputMode="numeric"
              className="nx-custom-stepper-input"
              value={targetScore}
              onChange={(e) => {
                const num = parseInt(e.target.value.replace(/\D/g, ''), 10)
                handleScoreChange(isNaN(num) ? 0 : num)
              }}
            />
            <button
              type="button"
              className="nx-custom-stepper-btn"
              onClick={() => handleScoreChange(targetScore + 10)}
              aria-label="Increase target score"
            >
              +
            </button>
          </div>
        </div>

        <div className="nx-challenge-field">
          <label className="nx-challenge-label" htmlFor="nx-bounty-candy-input">
            Candy Bounty
          </label>
          <div className="nx-custom-stepper">
            <button
              type="button"
              className="nx-custom-stepper-btn"
              onClick={() => handleBountyChange(bountyCandy - 5)}
              aria-label="Decrease candy bounty"
            >
              −
            </button>
            <input
              id="nx-bounty-candy-input"
              type="text"
              inputMode="numeric"
              className="nx-custom-stepper-input"
              value={bountyCandy}
              onChange={(e) => {
                const num = parseInt(e.target.value.replace(/\D/g, ''), 10)
                handleBountyChange(isNaN(num) ? 0 : num)
              }}
            />
            <button
              type="button"
              className="nx-custom-stepper-btn"
              onClick={() => handleBountyChange(bountyCandy + 5)}
              aria-label="Increase candy bounty"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="nx-challenge-submit-btn"
        onClick={onSendChallenge}
      >
        Issue Challenge ⚔️
      </button>
    </div>
  )
}
