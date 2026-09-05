import { useState, useMemo } from 'react'
import type { OwnedCard } from '../../../../../shared/card-jitsu-protocol'
import { ALL_CARDS } from '../../engine/deck/cards'
import type { CardData } from '../../types'
import { CardDisplay } from './card-display'

interface OwnedCardsBrowserProps {
  readonly ownedCards: readonly OwnedCard[]
}

type FilterElement = 'all' | 'f' | 'w' | 's' | 'power'

export function OwnedCardsBrowser({ ownedCards }: OwnedCardsBrowserProps) {
  const [filter, setFilter] = useState<FilterElement>('all')
  const [inspectedCard, setInspectedCard] = useState<{ card: CardData; quantity: number } | null>(null)

  // Map card catalog by ID
  const cardMap = useMemo(() => {
    return new Map<number, CardData>(ALL_CARDS.map((c) => [c.id, c]))
  }, [])

  // Merge owned quantities with catalog CardData
  const ownedWithDetails = useMemo(() => {
    return ownedCards
      .map((oc) => {
        const details = cardMap.get(oc.cardId)
        if (!details) return null
        return {
          card: details,
          quantity: oc.quantity + oc.memberQuantity,
        }
      })
      .filter((item): item is { card: CardData; quantity: number } => item !== null)
      .sort((a, b) => {
        // Sort: Power cards first, then value descending
        const aPower = a.card.powerId > 0 ? 1 : 0
        const bPower = b.card.powerId > 0 ? 1 : 0
        if (aPower !== bPower) return bPower - aPower
        return b.card.value - a.card.value
      })
  }, [ownedCards, cardMap])

  // Filter cards
  const filteredCards = useMemo(() => {
    return ownedWithDetails.filter(({ card }) => {
      if (filter === 'all') return true
      if (filter === 'power') return card.powerId > 0
      return card.element === filter
    })
  }, [ownedWithDetails, filter])

  const totalCardsCount = ownedWithDetails.reduce((sum, item) => sum + item.quantity, 0)
  const uniqueCardsCount = ownedWithDetails.length
  const powerCount = ownedWithDetails.filter((item) => item.card.powerId > 0).length

  return (
    <div className="dojo-cards-browser" data-protected-image="true">
      <div className="dojo-panel-header">
        <div className="dojo-panel-title-row">
          <span className="dojo-panel-icon">
            <svg className="dojo-panel-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M4 4h10v16H4V4zm2 2v12h6V6H6zm6-4h8v16h-2V4h-6V2z"/>
            </svg>
          </span>
          <h4 className="dojo-panel-title">Your Card Deck</h4>
        </div>
        <span className="dojo-panel-count-stat">
          {uniqueCardsCount} unique ({totalCardsCount} cards total)
        </span>
      </div>

      {/* Filter Tabs */}
      <div className="dojo-browser-filters">
        <button
          type="button"
          className={`dojo-filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({uniqueCardsCount})
        </button>
        <button
          type="button"
          className={`dojo-filter-btn dojo-filter-fire ${filter === 'f' ? 'active' : ''}`}
          onClick={() => setFilter('f')}
        >
          <img
            src="/games/card-jitsu/assets/elements/fire.png"
            alt="Fire"
            className="dojo-filter-pin"
            draggable={false}
            data-protected-image="true"
          />
          Fire
        </button>
        <button
          type="button"
          className={`dojo-filter-btn dojo-filter-water ${filter === 'w' ? 'active' : ''}`}
          onClick={() => setFilter('w')}
        >
          <img
            src="/games/card-jitsu/assets/elements/water.png"
            alt="Water"
            className="dojo-filter-pin"
            draggable={false}
            data-protected-image="true"
          />
          Water
        </button>
        <button
          type="button"
          className={`dojo-filter-btn dojo-filter-snow ${filter === 's' ? 'active' : ''}`}
          onClick={() => setFilter('s')}
        >
          <img
            src="/games/card-jitsu/assets/elements/snow.png"
            alt="Snow"
            className="dojo-filter-pin"
            draggable={false}
            data-protected-image="true"
          />
          Snow
        </button>
        <button
          type="button"
          className={`dojo-filter-btn dojo-filter-power ${filter === 'power' ? 'active' : ''}`}
          onClick={() => setFilter('power')}
        >
          Power ({powerCount})
        </button>
      </div>

      {/* Scrollable Cards Grid */}
      <div className="dojo-cards-scroll-container">
        {filteredCards.length === 0 ? (
          <div className="dojo-cards-empty">
            <span>No cards in this element yet. Open booster packs to find more!</span>
          </div>
        ) : (
          <div className="dojo-cards-scroll-grid">
            {filteredCards.map(({ card, quantity }) => (
              <div
                key={card.id}
                className="dojo-browser-card-slot"
                onClick={() => setInspectedCard({ card, quantity })}
              >
                <CardDisplay
                  card={card}
                  quantity={quantity}
                  size="sm"
                  isFlipped={true}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Card Inspection Modal */}
      {inspectedCard && (
        <div className="dojo-inspect-overlay" onClick={() => setInspectedCard(null)}>
          <div className="dojo-inspect-box" onClick={(e) => e.stopPropagation()}>
            <CardDisplay
              card={inspectedCard.card}
              quantity={inspectedCard.quantity}
              size="lg"
              showDetails={true}
            />
            <div className="dojo-inspect-details">
              <h5>{inspectedCard.card.name}</h5>
              <div className="dojo-inspect-meta">
                <span>Value: <strong>{inspectedCard.card.value}</strong></span>
                <span>Element: <strong>{inspectedCard.card.element.toUpperCase()}</strong></span>
                <span>Copies: <strong>x{inspectedCard.quantity}</strong></span>
              </div>
              {inspectedCard.card.powerId > 0 && inspectedCard.card.description && (
                <div className="dojo-inspect-power-desc">
                  <strong>Power Effect:</strong> {inspectedCard.card.description}
                </div>
              )}
              <button
                type="button"
                className="nx-btn nx-btn-secondary"
                onClick={() => setInspectedCard(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
