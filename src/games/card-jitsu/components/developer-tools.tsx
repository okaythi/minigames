import type { CardData } from '../types'
import './developer-tools.css'

interface DeveloperToolsProps {
  readonly senseiHand: readonly CardData[]
  readonly onForceWin: () => void
  readonly onForceLoss: () => void
}

export function DeveloperTools({
  senseiHand,
  onForceWin,
  onForceLoss,
}: DeveloperToolsProps) {
  const getElementEmoji = (elem: string) =>
    elem === 'fire' ? '🔥' : elem === 'water' ? '💧' : '❄️'

  return (
    <aside className="nx-thy-debug-drawer" aria-label="Thy Developer Suite">
      <div className="nx-thy-debug-head">
        <div className="nx-thy-debug-title">
          <span>⚡</span>
          <span>Thy Control Suite (isThy)</span>
        </div>
        <span style={{ fontSize: '10px', color: '#ffb74d' }}>Live Simulation Hook</span>
      </div>

      <div>
        <span style={{ color: '#ffb74d' }}>Sensei Hand X-Ray ({senseiHand.length} cards):</span>
        <div className="nx-sensei-xray-cards">
          {senseiHand.map((card) => (
            <div key={card.id} className="nx-xray-card">
              <span>{getElementEmoji(card.element)}</span>
              <span>
                {card.element.toUpperCase()} {card.value}
              </span>
              <span style={{ color: card.color }}>({card.color})</span>
              {card.powerId > 0 && <span style={{ color: '#ffeb3b' }}>★P{card.powerId}</span>}
            </div>
          ))}
          {senseiHand.length === 0 && (
            <span style={{ color: '#888', fontStyle: 'italic' }}>Waiting for deal...</span>
          )}
        </div>
      </div>

      <div className="nx-thy-actions">
        <button type="button" className="nx-thy-btn" onClick={onForceWin}>
          🏆 Force Match Win
        </button>
        <button type="button" className="nx-thy-btn" onClick={onForceLoss}>
          💀 Force Match Loss
        </button>
      </div>
    </aside>
  )
}
