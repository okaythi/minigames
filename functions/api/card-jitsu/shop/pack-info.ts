import {
  DOJO_STORE_CONFIG,
  calculateDiscountPercent,
} from '../../../../shared/card-jitsu-store-config'
import type { ShopPackInfo } from '../../../../shared/card-jitsu-shop-protocol'

/**
 * Single source of truth for the pack price the store UI displays.
 *
 * The first pack a ninja ever buys is discounted via `firstPurchasePromo`;
 * every later pack costs the regular `pack.price`. Both the shop-state and
 * buy-pack endpoints derive their response from here so the client can never
 * show a stale promo after a purchase.
 */
export function buildPackInfo(isFirstPurchase: boolean): ShopPackInfo {
  const price = isFirstPurchase
    ? DOJO_STORE_CONFIG.firstPurchasePromo.actualPrice
    : DOJO_STORE_CONFIG.pack.price

  const originalPrice = isFirstPurchase
    ? DOJO_STORE_CONFIG.firstPurchasePromo.fullPrice
    : DOJO_STORE_CONFIG.pack.originalPrice

  const promoTagline = isFirstPurchase
    ? DOJO_STORE_CONFIG.firstPurchasePromo.promoTagline
    : DOJO_STORE_CONFIG.pack.promoTagline

  const discountPercent = calculateDiscountPercent(originalPrice ?? 0, price)
  const promoBadge = discountPercent > 0 ? `${discountPercent}% OFF` : undefined

  return {
    price,
    ...(originalPrice !== undefined ? { originalPrice } : {}),
    isPromoActive: isFirstPurchase || DOJO_STORE_CONFIG.pack.isPromoActive,
    ...(promoBadge !== undefined ? { promoBadge } : {}),
    ...(promoTagline !== undefined ? { promoTagline } : {}),
    isFirstPurchasePromo: isFirstPurchase,
    name: DOJO_STORE_CONFIG.pack.name,
    description: DOJO_STORE_CONFIG.pack.description,
    iconUrl: DOJO_STORE_CONFIG.pack.iconUrl,
    normalCardsCount: DOJO_STORE_CONFIG.packRules.normalCardsCount,
    powerCardsCount: DOJO_STORE_CONFIG.packRules.powerCardsCount,
  }
}
