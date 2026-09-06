/**
 * Card-Jitsu Inventory & Collection Specification
 *
 * Formal specification:
 * IN card-jitsu:
 * IF system THEN (player AND shop AND card_inventory AND (card == normal_card XOR card == power_card))
 *
 * IF (has_all_normal_cards(player) AND buys_from_shop(player, shop) AND (rolled_card == normal_card) AND (card_inventory_count(player, rolled_card) >= 2)) THEN replace_surplus_in_chest_roll(rolled_card, power_card)
 *
 * IF (has_all_power_cards(player) AND buys_from_shop(player, shop) AND (rolled_card == power_card) AND (card_inventory_count(player, rolled_card) >= 2)) THEN replace_surplus_in_chest_roll(rolled_card, normal_card)
 *
 * IFF (card_inventory_size(player) === 509) THEN has_all_cards(player)
 *
 * IF has_all_cards(player) THEN ((NOT shop_deck_purchase_section_visible(shop, player)) AND api_hard_lock_deck_purchase(api, player))
 *
 * IFF (NOT has_all_cards(player)) THEN (shop_deck_purchase_section_visible(shop, player) AND (NOT api_hard_lock_deck_purchase(api, player)))
 *
 * IF specification THEN (documented_in(specification, docs) AND documented_in(specification, code))
 */

export const TOTAL_DEALABLE_CARDS = 509
export const TOTAL_NORMAL_CARDS = 405
export const TOTAL_POWER_CARDS = 104

export interface CardInventoryItem {
  readonly cardId: number
  readonly quantity: number
  readonly memberQuantity?: number
}

/**
 * Single source of truth for player card inventory validation.
 * In Card-Jitsu, cards are unique collection items:
 * IF card.amount > 1 THEN error (catastrophic failure).
 * Must be verified by any party handling or mutating card inventory.
 */
export function validateCardInventory(cards: readonly CardInventoryItem[]): void {
  const seen = new Set<number>()
  for (const card of cards) {
    const totalAmount = card.quantity + (card.memberQuantity ?? 0)
    if (totalAmount > 1) {
      throw new Error(
        `[Card-Jitsu Inventory Invariant Violation] Card ${card.cardId} has quantity ${totalAmount} > 1. Duplicate cards in inventory are forbidden (catastrophic failure).`,
      )
    }
    if (totalAmount < 0) {
      throw new Error(
        `[Card-Jitsu Inventory Invariant Violation] Card ${card.cardId} has negative quantity ${totalAmount}.`,
      )
    }
    if (seen.has(card.cardId)) {
      throw new Error(
        `[Card-Jitsu Inventory Invariant Violation] Duplicate record for card ${card.cardId} found in inventory.`,
      )
    }
    seen.add(card.cardId)
  }
}

/**
 * Returns the validated unique size of the player's card inventory.
 * Enforces the single source of truth validator.
 */
export function getCardInventorySize(cards: readonly CardInventoryItem[]): number {
  validateCardInventory(cards)
  return cards.filter((c) => (c.quantity + (c.memberQuantity ?? 0)) > 0).length
}

/**
 * IFF (card_inventory_size(player) === 509) THEN has_all_cards(player)
 */
export function hasAllCards(cardInventorySize: number): boolean {
  return cardInventorySize === TOTAL_DEALABLE_CARDS
}

/**
 * IF has_all_cards(player) THEN api_hard_lock_deck_purchase(api, player)
 * IFF (NOT has_all_cards(player)) THEN (NOT api_hard_lock_deck_purchase(api, player))
 */
export function isDeckPurchaseLocked(cardInventorySize: number): boolean {
  return hasAllCards(cardInventorySize)
}

/**
 * IF has_all_cards(player) THEN (NOT shop_deck_purchase_section_visible(shop, player))
 * IFF (NOT has_all_cards(player)) THEN shop_deck_purchase_section_visible(shop, player)
 */
export function isShopDeckPurchaseSectionVisible(cardInventorySize: number): boolean {
  return !hasAllCards(cardInventorySize)
}

/**
 * Card classification helper: card == normal_card XOR card == power_card
 */
export function isNormalCard(powerId: number): boolean {
  return powerId === 0
}

export function isPowerCard(powerId: number): boolean {
  return powerId !== 0
}
