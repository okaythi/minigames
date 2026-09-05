import { useState } from 'react'
import type { ShopColorItem } from '../../../../../shared/card-jitsu-shop-protocol'
import { calculateDiscountPercent } from '../../../../../shared/card-jitsu-store-config'
import { playCandySpend } from './shop-audio'

interface ColorSelectPanelProps {
  readonly colors: readonly ShopColorItem[]
  readonly equippedColorId: number
  readonly userCandy: number
  readonly onEquipColor: (colorId: number) => Promise<void>
  readonly onBuyColor: (colorId: number) => Promise<boolean>
}

export function ColorSelectPanel({
  colors,
  equippedColorId,
  userCandy,
  onEquipColor,
  onBuyColor,
}: ColorSelectPanelProps) {
  const [busyColorId, setBusyColorId] = useState<number | null>(null)
  const [confirmBuyColor, setConfirmBuyColor] = useState<ShopColorItem | null>(null)

  const handleTileClick = async (color: ShopColorItem) => {
    if (busyColorId !== null) return

    if (color.equipped) {
      // Already active
      return
    }

    if (color.owned) {
      // Equip directly
      setBusyColorId(color.id)
      try {
        await onEquipColor(color.id)
      } finally {
        setBusyColorId(null)
      }
      return
    }

    // Locked color -> Prompt purchase confirmation
    setConfirmBuyColor(color)
  }

  const handleConfirmPurchase = async () => {
    if (!confirmBuyColor || busyColorId !== null) return
    setBusyColorId(confirmBuyColor.id)
    try {
      const ok = await onBuyColor(confirmBuyColor.id)
      if (ok) {
        playCandySpend()
        setConfirmBuyColor(null)
      }
    } finally {
      setBusyColorId(null)
    }
  }

  return (
    <div className="dojo-color-panel" data-protected-image="true">
      <div className="dojo-panel-header">
        <div className="dojo-panel-title-row">
          <span className="dojo-panel-icon">
            <svg className="dojo-panel-svg-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M12 3c-4.97 0-9 4.03-9 9 0 2.12.74 4.07 1.97 5.61.42.53.53 1.25.29 1.89-.37 1-.16 2.15.54 2.94.8.91 2.01 1.34 3.2 1.13 3.65-.63 6.36-3.79 6.36-7.57V15c0-1.66 1.34-3 3-3h1c1.66 0 3-1.34 3-3 0-4.97-4.03-9-9-9zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
            </svg>
          </span>
          <h4 className="dojo-panel-title">Penguin Colors</h4>
        </div>
        <span className="dojo-panel-hint">Click to equip or unlock</span>
      </div>

      {/* Color Items Grid (No dropdowns!) */}
      <div className="dojo-color-grid">
        {colors.map((c) => {
          const isEquipped = c.id === equippedColorId || c.equipped
          const isBusy = busyColorId === c.id
          const canAfford = userCandy >= c.price

          return (
            <button
              key={c.id}
              type="button"
              className={`dojo-color-tile ${isEquipped ? 'is-equipped' : c.owned ? 'is-owned' : 'is-locked'} ${isBusy ? 'is-busy' : ''}`}
              onClick={() => handleTileClick(c)}
              disabled={isBusy}
              title={
                isEquipped
                  ? `${c.name} (Currently Equipped)`
                  : c.owned
                    ? `Click to equip ${c.name}`
                    : `Unlock ${c.name} for ${c.price} Candy`
              }
            >
              {/* Promo Badge */}
              {!c.owned && (c.originalPrice && c.originalPrice > c.price ? (
                <span className="dojo-color-promo-badge">
                  {calculateDiscountPercent(c.originalPrice, c.price)}% OFF
                </span>
              ) : c.promoBadge ? (
                <span className="dojo-color-promo-badge">{c.promoBadge}</span>
              ) : null)}

              {/* Authentic Color Blob PNG */}
              <div className="dojo-color-blob-wrapper">
                <img
                  src={c.iconUrl}
                  alt={c.name}
                  className="dojo-color-blob-img"
                  draggable={false}
                  data-protected-image="true"
                />
                {isEquipped && (
                  <span className="dojo-color-check">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                )}
              </div>

              <div className="dojo-color-label">{c.name}</div>

              {/* Status / Price Tag */}
              <div className="dojo-color-status">
                {isEquipped ? (
                  <span className="dojo-status-equipped">Equipped</span>
                ) : c.owned ? (
                  <span className="dojo-status-owned">Equip</span>
                ) : (
                  <span className={`dojo-status-price ${canAfford ? 'can-afford' : 'cannot-afford'}`}>
                    {c.originalPrice !== undefined && c.originalPrice > c.price && (
                      <s className="dojo-orig-price">{c.originalPrice}</s>
                    )}
                    {c.price} Candy
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Purchase Confirmation Modal */}
      {confirmBuyColor && (
        <div className="dojo-confirm-overlay" onClick={() => setConfirmBuyColor(null)}>
          <div className="dojo-confirm-box" onClick={(e) => e.stopPropagation()}>
            <div className="dojo-confirm-blob-preview">
              <img
                src={confirmBuyColor.iconUrl}
                alt={confirmBuyColor.name}
                draggable={false}
                data-protected-image="true"
              />
            </div>
            <h5>Unlock {confirmBuyColor.name}?</h5>
            <p className="dojo-confirm-desc">
              Permanently adds <strong>{confirmBuyColor.name}</strong> to your penguin wardrobe and
              equips it in Card-Jitsu!
            </p>
            <div className="dojo-confirm-price-row">
              Price:
              {confirmBuyColor.originalPrice && confirmBuyColor.originalPrice > confirmBuyColor.price && (
                <s className="dojo-orig-price">{confirmBuyColor.originalPrice} Candy</s>
              )}
              <span className="dojo-final-price">{confirmBuyColor.price} Candy</span>
            </div>
            {userCandy < confirmBuyColor.price ? (
              <div className="dojo-confirm-error">
                You have {userCandy} Candy. Need {confirmBuyColor.price - userCandy} more candy!
              </div>
            ) : (
              <div className="dojo-confirm-buttons">
                <button
                  type="button"
                  className="nx-btn nx-btn-primary"
                  onClick={handleConfirmPurchase}
                  disabled={busyColorId !== null}
                >
                  {busyColorId !== null ? 'Unlocking...' : `Unlock for ${confirmBuyColor.price} Candy`}
                </button>
                <button
                  type="button"
                  className="nx-btn nx-btn-secondary"
                  onClick={() => setConfirmBuyColor(null)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
