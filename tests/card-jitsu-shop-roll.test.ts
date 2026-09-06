import { describe, it, expect } from 'vitest'
import {
  TOTAL_DEALABLE_CARDS,
  TOTAL_NORMAL_CARDS,
  TOTAL_POWER_CARDS,
  validateCardInventory,
  getCardInventorySize,
  hasAllCards,
  isDeckPurchaseLocked,
  isShopDeckPurchaseSectionVisible,
  isNormalCard,
  isPowerCard,
  calculateCardWeight,
  DOJO_STORE_CONFIG,
} from '../shared/card-jitsu-store-config'
import rawCards from '../src/games/card-jitsu/engine/deck/cards.json'
import dealableIds from '../src/games/card-jitsu/engine/deck/dealable-ids.json'

interface RawCard {
  readonly id: number
  readonly name: string
  readonly set_id: number
  readonly power_id: number
  readonly element: string
  readonly color: string
  readonly value: number
  readonly description: string
}

const DEALABLE_SET = new Set<number>(dealableIds as readonly number[])
const ALL_CARDS: readonly RawCard[] = (rawCards as readonly RawCard[]).filter((c) =>
  DEALABLE_SET.has(c.id),
)
const NORMAL_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => isNormalCard(c.power_id))
const POWER_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => isPowerCard(c.power_id))

/**
 * Sampling helper using Efraimidis-Spirakis algorithm with card rarity weights.
 */
function sampleWeightedWithoutReplacement<T extends { readonly id: number }>(
  pool: readonly T[],
  count: number,
): T[] {
  if (count <= 0 || pool.length === 0) return []
  const k = Math.min(count, pool.length)

  const scored = pool.map((item) => {
    const weight = calculateCardWeight(item.id)
    const u = Math.max(1e-15, Math.random())
    const key = weight > 0 ? Math.pow(u, 1 / weight) : -Infinity
    return { item, key }
  })

  scored.sort((a, b) => b.key - a.key)
  return scored.slice(0, k).map((s) => s.item)
}

function simulateDraw(userOwnedCardIds: Set<number>) {
  const unownedNormals = NORMAL_POOL.filter((c) => !userOwnedCardIds.has(c.id))
  const unownedPowers = POWER_POOL.filter((c) => !userOwnedCardIds.has(c.id))

  const hasAllNormalCards = unownedNormals.length === 0
  const hasAllPowerCards = unownedPowers.length === 0

  let targetNormals: number = DOJO_STORE_CONFIG.packRules.normalCardsCount
  let targetPowers: number = DOJO_STORE_CONFIG.packRules.powerCardsCount

  if (hasAllNormalCards) {
    targetPowers = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedPowers.length)
    targetNormals = 0
  } else if (hasAllPowerCards) {
    targetNormals = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedNormals.length)
    targetPowers = 0
  } else {
    const actualNormals = Math.min(targetNormals, unownedNormals.length)
    const normalDeficit = targetNormals - actualNormals
    targetNormals = actualNormals
    targetPowers = Math.min(targetPowers + normalDeficit, unownedPowers.length)
  }

  const drawnNormals = sampleWeightedWithoutReplacement(unownedNormals, targetNormals)
  const drawnPowers = sampleWeightedWithoutReplacement(unownedPowers, targetPowers)

  return [...drawnNormals, ...drawnPowers]
}

describe('Card-Jitsu Shop Roll & Collection Completion Specification', () => {
  describe('1. Card Classification: card == normal_card XOR card == power_card', () => {
    it('verifies dealable cards count matches 509', () => {
      expect(ALL_CARDS.length).toBe(TOTAL_DEALABLE_CARDS)
      expect(ALL_CARDS.length).toBe(509)
    })

    it('verifies strict partition into 405 normal cards and 104 power cards', () => {
      expect(NORMAL_POOL.length).toBe(TOTAL_NORMAL_CARDS)
      expect(NORMAL_POOL.length).toBe(405)

      expect(POWER_POOL.length).toBe(TOTAL_POWER_CARDS)
      expect(POWER_POOL.length).toBe(104)

      expect(NORMAL_POOL.length + POWER_POOL.length).toBe(TOTAL_DEALABLE_CARDS)
    })

    it('asserts XOR property for every single dealable card', () => {
      for (const card of ALL_CARDS) {
        const isNormal = isNormalCard(card.power_id)
        const isPower = isPowerCard(card.power_id)
        // Strict XOR: (isNormal || isPower) && !(isNormal && isPower)
        expect(Boolean(Number(isNormal) ^ Number(isPower))).toBe(true)
      }
    })
  })

  describe('2. Single Source of Truth & Inventory Invariants (amount > 1 THEN error)', () => {
    it('passes for valid inventory where all cards have quantity === 1', () => {
      const validInventory = [
        { cardId: 1, quantity: 1, memberQuantity: 0 },
        { cardId: 6, quantity: 1, memberQuantity: 0 },
        { cardId: 73, quantity: 1, memberQuantity: 0 },
      ]
      expect(() => validateCardInventory(validInventory)).not.toThrow()
      expect(getCardInventorySize(validInventory)).toBe(3)
    })

    it('throws catastrophic error if any card has quantity > 1', () => {
      const corruptedInventory = [
        { cardId: 1, quantity: 2, memberQuantity: 0 },
      ]
      expect(() => validateCardInventory(corruptedInventory)).toThrow(
        /Catastrophic/i,
      )
    })

    it('throws catastrophic error if quantity + memberQuantity > 1', () => {
      const corruptedInventory = [
        { cardId: 1, quantity: 1, memberQuantity: 1 },
      ]
      expect(() => validateCardInventory(corruptedInventory)).toThrow(
        /Catastrophic/i,
      )
    })

    it('throws error if duplicate card rows exist', () => {
      const duplicateRowInventory = [
        { cardId: 1, quantity: 1, memberQuantity: 0 },
        { cardId: 1, quantity: 1, memberQuantity: 0 },
      ]
      expect(() => validateCardInventory(duplicateRowInventory)).toThrow(
        /Duplicate record/i,
      )
    })
  })

  describe('3. Surplus Replacement in Chest Roll', () => {
    it('draws standard 9 normal + 1 power when player has plenty of unowned cards', () => {
      const starterDeckIds = new Set<number>([1, 6, 9, 14, 17, 20, 22, 23, 26, 73, 81, 89])
      const drawn = simulateDraw(starterDeckIds)

      expect(drawn.length).toBe(10)
      const distinctIds = new Set(drawn.map((c) => c.id))
      expect(distinctIds.size).toBe(10)

      // Zero intersection with already owned cards
      for (const card of drawn) {
        expect(starterDeckIds.has(card.id)).toBe(false)
      }

      const normals = drawn.filter((c) => c.power_id === 0)
      const powers = drawn.filter((c) => c.power_id !== 0)
      expect(normals.length).toBe(9)
      expect(powers.length).toBe(1)
    })

    it('replaces surplus normal cards with power cards when player has all normal cards', () => {
      // Player owns all 405 normal cards and 10 power cards
      const owned = new Set<number>([
        ...NORMAL_POOL.map((c) => c.id),
        ...POWER_POOL.slice(0, 10).map((c) => c.id),
      ])

      const drawn = simulateDraw(owned)

      // Since has_all_normal_cards is true, normal slots are replaced with power cards
      expect(drawn.length).toBe(10)
      const distinctIds = new Set(drawn.map((c) => c.id))
      expect(distinctIds.size).toBe(10)

      for (const card of drawn) {
        expect(owned.has(card.id)).toBe(false)
        expect(isPowerCard(card.power_id)).toBe(true)
      }
    })

    it('replaces surplus power cards with normal cards when player has all power cards', () => {
      // Player owns all 104 power cards and 50 normal cards
      const owned = new Set<number>([
        ...POWER_POOL.map((c) => c.id),
        ...NORMAL_POOL.slice(0, 50).map((c) => c.id),
      ])

      const drawn = simulateDraw(owned)

      // Since has_all_power_cards is true, power slot is replaced with normal cards
      expect(drawn.length).toBe(10)
      const distinctIds = new Set(drawn.map((c) => c.id))
      expect(distinctIds.size).toBe(10)

      for (const card of drawn) {
        expect(owned.has(card.id)).toBe(false)
        expect(isNormalCard(card.power_id)).toBe(true)
      }
    })

    it('handles deficit in normal cards by converting remaining slots to power cards', () => {
      // Player has 402 normal cards (only 3 normal unowned) and 50 power cards unowned
      const ownedNormals = NORMAL_POOL.slice(0, 402).map((c) => c.id)
      const owned = new Set<number>(ownedNormals)

      const drawn = simulateDraw(owned)

      expect(drawn.length).toBe(10)
      const distinctIds = new Set(drawn.map((c) => c.id))
      expect(distinctIds.size).toBe(10)

      const normals = drawn.filter((c) => c.power_id === 0)
      const powers = drawn.filter((c) => c.power_id !== 0)
      expect(normals.length).toBe(3) // all 3 remaining unowned normal cards
      expect(powers.length).toBe(7)  // 1 standard power + 6 deficit replacement powers
    })

    it('gracefully delivers remaining cards when total unowned < 10', () => {
      // Player has 505 cards (all 405 normal cards + 100 power cards, only 4 power cards left)
      const owned = new Set<number>([
        ...NORMAL_POOL.map((c) => c.id),
        ...POWER_POOL.slice(0, 100).map((c) => c.id),
      ])

      const drawn = simulateDraw(owned)

      expect(drawn.length).toBe(4) // delivers the 4 remaining unowned cards
      const distinctIds = new Set(drawn.map((c) => c.id))
      expect(distinctIds.size).toBe(4)

      for (const card of drawn) {
        expect(owned.has(card.id)).toBe(false)
      }
    })
  })

  describe('4. Collection Completion: IFF (card_inventory_size === 509) THEN has_all_cards', () => {
    it('verifies 508 cards does not trigger hasAllCards', () => {
      expect(hasAllCards(508)).toBe(false)
      expect(isDeckPurchaseLocked(508)).toBe(false)
      expect(isShopDeckPurchaseSectionVisible(508)).toBe(true)
    })

    it('verifies 509 cards strictly triggers hasAllCards, hard-lock, and section hidden', () => {
      expect(hasAllCards(509)).toBe(true)
      expect(isDeckPurchaseLocked(509)).toBe(true)
      expect(isShopDeckPurchaseSectionVisible(509)).toBe(false)
    })

    it('verifies equivalence (IFF) between NOT hasAllCards and visibility/non-lock', () => {
      for (let size = 0; size <= 509; size++) {
        const complete = hasAllCards(size)
        const locked = isDeckPurchaseLocked(size)
        const visible = isShopDeckPurchaseSectionVisible(size)

        if (size === 509) {
          expect(complete).toBe(true)
          expect(locked).toBe(true)
          expect(visible).toBe(false)
        } else {
          expect(complete).toBe(false)
          expect(locked).toBe(false)
          expect(visible).toBe(true)
        }
      }
    })
  })
})
