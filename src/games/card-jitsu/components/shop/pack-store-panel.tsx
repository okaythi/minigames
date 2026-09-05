import { useState } from 'react'
import type { ShopPackInfo } from '../../../../../shared/card-jitsu-shop-protocol'
import { calculateDiscountPercent } from '../../../../../shared/card-jitsu-store-config'

interface PackStorePanelProps {
  readonly packInfo: ShopPackInfo
  readonly userCandy: number
  readonly isOpening: boolean
  readonly onBuyPack: () => Promise<boolean>
}

export function PackStorePanel({
  packInfo,
  userCandy,
  isOpening,
  onBuyPack,
}: PackStorePanelProps) {
  const [loading, setLoading] = useState(false)
  const canAfford = userCandy >= packInfo.price

  const discountPercent =
    packInfo.originalPrice && packInfo.originalPrice > packInfo.price
      ? calculateDiscountPercent(packInfo.originalPrice, packInfo.price)
      : 0
  const promoRibbonText = discountPercent > 0 ? `${discountPercent}% OFF` : packInfo.promoBadge

  const handleBuyClick = async () => {
    if (loading || isOpening || !canAfford) return
    setLoading(true)
    try {
      await onBuyPack()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dojo-pack-panel" data-protected-image="true">
      <div className="dojo-pack-hero-card">
        {/* Promo Ribbon */}
        {promoRibbonText && (
          <div className="dojo-pack-ribbon">
            <span>{promoRibbonText}</span>
          </div>
        )}

        {/* Left / Top Graphic: Official CP Card Pack Icon */}
        <div className="dojo-pack-art-wrapper">
          <div className="dojo-pack-glow-ring" />
          <img
            src={packInfo.iconUrl}
            alt={packInfo.name}
            className="dojo-pack-official-img"
            draggable={false}
            data-protected-image="true"
          />
        </div>

        {/* Right / Center Details */}
        <div className="dojo-pack-details">
          <div className="dojo-pack-tag">
            {packInfo.promoTagline || 'OFFICIAL CLUB PENGUIN BOOSTER'}
          </div>
          <h3 className="dojo-pack-title">{packInfo.name}</h3>
          <p className="dojo-pack-desc">{packInfo.description}</p>

          {/* Guarantee Highlights */}
          <div className="dojo-pack-perks-grid">
            <div className="dojo-perk-item">
              <span className="dojo-perk-icon">
                <svg className="dojo-perk-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M4 4h10v16H4V4zm2 2v12h6V6H6zm6-4h8v16h-2V4h-6V2z"/>
                </svg>
              </span>
              <div className="dojo-perk-text">
                <strong>9 Combat Cards</strong>
                <small>Values 2–12 (Fire, Water, Snow)</small>
              </div>
            </div>
            <div className="dojo-perk-item dojo-perk-power">
              <span className="dojo-perk-icon">
                <svg className="dojo-perk-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 2l2.4 7.2h7.6l-6.1 4.5 2.3 7.3-6.2-4.6-6.2 4.6 2.3-7.3-6.1-4.5h7.6z"/>
                </svg>
              </span>
              <div className="dojo-perk-text">
                <strong>1 Guaranteed Power Card</strong>
                <small>Epic clash rules & reversal effects</small>
              </div>
            </div>
            <div className="dojo-perk-item">
              <span className="dojo-perk-icon">
                <svg className="dojo-perk-svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                  <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                </svg>
              </span>
              <div className="dojo-perk-text">
                <strong>Strict No Repeats</strong>
                <small>Every card drawn in this pack is unique</small>
              </div>
            </div>
          </div>

          {/* Pricing & Purchase Action */}
          <div className="dojo-pack-buy-row">
            <div className="dojo-pack-price-box">
              <div className="dojo-pack-price-label">Price:</div>
              <div className="dojo-pack-price-val">
                {packInfo.originalPrice && packInfo.originalPrice > packInfo.price && (
                  <s className="dojo-pack-orig-price">{packInfo.originalPrice} Candy</s>
                )}
                <span className="dojo-pack-final-price">{packInfo.price} Candy</span>
              </div>
            </div>

            <button
              type="button"
              className={`nx-btn nx-btn-primary dojo-pack-buy-btn ${!canAfford ? 'disabled-afford' : ''}`}
              onClick={handleBuyClick}
              disabled={loading || isOpening || !canAfford}
            >
              {loading ? (
                <span>Opening Dojo Vault...</span>
              ) : canAfford ? (
                <span>Buy & Open Pack ({packInfo.price} Candy)</span>
              ) : (
                <span>Need {packInfo.price - userCandy} More Candy</span>
              )}
            </button>
          </div>

          {!canAfford && (
            <div className="dojo-candy-shortage-hint">
              Play minigames across Nixlabs to earn more candy for your Dojo deck!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
