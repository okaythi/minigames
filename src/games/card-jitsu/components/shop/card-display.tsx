import type { CSSProperties } from 'react'

interface CardDisplayProps {
  readonly card: {
    readonly id: number
    readonly name?: string | undefined
    readonly element: 'f' | 'w' | 's'
    readonly color: 'r' | 'b' | 'g' | 'y' | 'o' | 'p'
    readonly value: number
    readonly powerId?: number | undefined
    readonly description?: string | undefined
  }
  readonly quantity?: number | undefined
  readonly isNew?: boolean | undefined
  readonly isFlipped?: boolean | undefined
  readonly size?: 'sm' | 'md' | 'lg' | undefined
  readonly showDetails?: boolean | undefined
  readonly onClick?: (() => void) | undefined
}


export const ELEMENT_DATA = {
  f: { name: 'Fire', pin: '/games/card-jitsu/assets/elements/fire.png', color: '#e53e3e', bg: '#fff5f5' },
  w: { name: 'Water', pin: '/games/card-jitsu/assets/elements/water.png', color: '#3182ce', bg: '#ebf8ff' },
  s: { name: 'Snow', pin: '/games/card-jitsu/assets/elements/snow.png', color: '#00a3c4', bg: '#e6fffa' },
} as const

const CARD_COLOR_HEX = {
  r: '#c53030',
  b: '#2b6cb0',
  g: '#2f855a',
  y: '#d69e2e',
  o: '#dd6b20',
  p: '#6b46c1',
} as const

export function CardDisplay({
  card,
  quantity,
  isNew,
  isFlipped = true,
  size = 'md',
  showDetails = false,
  onClick,
}: CardDisplayProps) {
  const isPower = (card.powerId ?? 0) > 0
  const elem = ELEMENT_DATA[card.element] ?? ELEMENT_DATA.f
  const borderColor = CARD_COLOR_HEX[card.color] ?? '#4a5568'

  const sizeClass = size === 'sm' ? 'card-sm' : size === 'lg' ? 'card-lg' : 'card-md'

  return (
    <div
      className={`dojo-card-container ${sizeClass} ${isFlipped ? 'flipped' : 'face-down'} ${isPower ? 'is-power-card' : ''}`}
      onClick={onClick}
      data-protected-image="true"
      style={{ '--card-color': borderColor, '--elem-color': elem.color } as CSSProperties}
      title={isPower ? `Power Card: ${card.description || 'Special Effect'}` : `${card.name} (${elem.name} ${card.value})`}
    >
      <div className="dojo-card-inner">
        {/* Back of Card (Shown before flip) */}
        <div className="dojo-card-back" data-protected-image="true">
          <div className="dojo-card-back-pattern">
            <div className="dojo-card-back-emblem">
              <svg className="dojo-card-back-amulet-svg" viewBox="0 0 32 32" width="28" height="28" fill="none">
                <circle cx="16" cy="16" r="14" stroke="#d4af37" strokeWidth="2" />
                <circle cx="16" cy="9" r="3.5" fill="#e53e3e" />
                <circle cx="10" cy="20" r="3.5" fill="#3182ce" />
                <circle cx="22" cy="20" r="3.5" fill="#00a3c4" />
                <circle cx="16" cy="15" r="2" fill="#ffd700" />
              </svg>
            </div>
            <div className="dojo-card-back-label">CARD-JITSU</div>
          </div>
        </div>

        {/* Front of Card (Revealed) */}
        <div className="dojo-card-front" data-protected-image="true">
          {/* Header Strip: Element + Value */}
          <div className="dojo-card-header">
            <span className="dojo-card-elem-badge" style={{ backgroundColor: elem.color }}>
              <img
                src={elem.pin}
                alt={elem.name}
                className="dojo-card-elem-pin"
                draggable={false}
                data-protected-image="true"
              />
            </span>
            <span className="dojo-card-value-badge">{card.value}</span>
          </div>

          {/* Center Illustration Frame */}
          <div className="dojo-card-art-frame">
            <img
              src={`/games/card-jitsu/card/icons_png/${card.id}.png`}
              alt={card.name || `Card #${card.id}`}
              className="dojo-card-art-img"
              draggable={false}
              data-protected-image="true"
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement
                const fb = parent?.querySelector('.dojo-card-art-fallback') as HTMLElement | null
                if (fb) fb.style.display = 'flex'
              }}
            />
            <div className="dojo-card-art-center dojo-card-art-fallback" style={{ display: 'none' }}>
              <img
                src={elem.pin}
                alt={elem.name}
                className="dojo-card-art-pin"
                draggable={false}
                data-protected-image="true"
              />
              <span className="dojo-card-art-number">{card.value}</span>
            </div>
          </div>

          {/* Card Name Footer */}
          <div className="dojo-card-footer">
            <span className="dojo-card-name" title={card.name || `Card #${card.id}`}>
              {card.name || `Card #${card.id}`}
            </span>
            {isPower && showDetails && card.description && (
              <span className="dojo-card-effect-desc">{card.description}</span>
            )}
          </div>


          {/* Badges: Quantity & New */}
          {quantity !== undefined && quantity > 1 && (
            <span className="dojo-card-qty-badge">x{quantity}</span>
          )}
          {isNew && <span className="dojo-card-new-badge">NEW!</span>}
        </div>
      </div>
    </div>
  )
}
