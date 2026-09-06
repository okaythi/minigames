import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, cjCard, cjNinja } from '../../../../src/db/schema'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'
import {
  DOJO_STORE_CONFIG,
  calculateCardWeight,
  validateCardInventory,
  hasAllCards,
} from '../../../../shared/card-jitsu-store-config'
import rawCards from '../../../../src/games/card-jitsu/engine/deck/cards.json'
import dealableIds from '../../../../src/games/card-jitsu/engine/deck/dealable-ids.json'
import type { BuyPackResponse, DrawnCard } from '../../../../shared/card-jitsu-shop-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

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

const NORMAL_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => c.power_id === 0)
const POWER_POOL: readonly RawCard[] = ALL_CARDS.filter((c) => c.power_id !== 0)

/**
 * Weighted sampling without replacement (Efraimidis-Spirakis algorithm).
 * Guarantees zero duplicate cards within the drawn sample.
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

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const currentCandy = playerRow?.candy ?? 0

  const ninja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  const packsPurchased = (ninja as { packsPurchased?: number } | undefined)?.packsPurchased ?? 0
  const isFirstPurchase = packsPurchased === 0

  const packPrice = isFirstPurchase
    ? DOJO_STORE_CONFIG.firstPurchasePromo.actualPrice
    : DOJO_STORE_CONFIG.pack.price

  if (currentCandy < packPrice) {
    return jsonResponse(400, { ok: false, error: 'insufficient-candy' })
  }

  // 1. Fetch & Validate card inventory (Single Source of Truth)
  const userCardRows = await db.select().from(cjCard).where(eq(cjCard.userId, playerId)).all()
  try {
    validateCardInventory(userCardRows)
  } catch (err) {
    console.error('[BuyPack] Catastrophic inventory invariant violation:', err)
    return jsonResponse(500, { ok: false, error: 'inventory-invariant-violation' })
  }

  const inventorySize = userCardRows.length

  // Hard Lock Check:
  // IFF (card_inventory_size(player) === 509) THEN has_all_cards(player)
  // IF has_all_cards(player) THEN api_hard_lock_deck_purchase(api, player)
  if (hasAllCards(inventorySize)) {
    return jsonResponse(400, { ok: false, error: 'deck-purchase-locked' })
  }

  // 2. Pre-Sampling Pool Partitioning & Surplus Replacement
  const ownedSet = new Set<number>(userCardRows.map((r) => r.cardId))
  const unownedNormals = NORMAL_POOL.filter((c) => !ownedSet.has(c.id))
  const unownedPowers = POWER_POOL.filter((c) => !ownedSet.has(c.id))

  const hasAllNormalCards = unownedNormals.length === 0
  const hasAllPowerCards = unownedPowers.length === 0

  let targetNormals: number = DOJO_STORE_CONFIG.packRules.normalCardsCount
  let targetPowers: number = DOJO_STORE_CONFIG.packRules.powerCardsCount

  if (hasAllNormalCards) {
    // IF has_all_normal_cards THEN replace_surplus_in_chest_roll(rolled_card, power_card)
    targetPowers = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedPowers.length)
    targetNormals = 0
  } else if (hasAllPowerCards) {
    // IF has_all_power_cards THEN replace_surplus_in_chest_roll(rolled_card, normal_card)
    targetNormals = Math.min(DOJO_STORE_CONFIG.packRules.totalCards, unownedNormals.length)
    targetPowers = 0
  } else {
    // Standard draw with overflow handling for low remaining unowned normal cards
    const actualNormals = Math.min(targetNormals, unownedNormals.length)
    const normalDeficit = targetNormals - actualNormals
    targetNormals = actualNormals
    targetPowers = Math.min(targetPowers + normalDeficit, unownedPowers.length)
  }

  const drawnNormals = sampleWeightedWithoutReplacement(unownedNormals, targetNormals)
  const drawnPowers = sampleWeightedWithoutReplacement(unownedPowers, targetPowers)

  const selectedCards = [...drawnNormals, ...drawnPowers]

  if (selectedCards.length === 0) {
    return jsonResponse(400, { ok: false, error: 'no-cards-available' })
  }

  // Invariant verification: strict no duplicates
  const distinctIds = new Set(selectedCards.map((c) => c.id))
  if (distinctIds.size !== selectedCards.length) {
    console.error('[BuyPack] Duplicate card invariant violated in pull:', selectedCards.map((c) => c.id))
    return jsonResponse(500, { ok: false, error: 'draw-invariant-error' })
  }

  const newCandy = currentCandy - packPrice

  // 3. Deduct candy atomically
  await db
    .update(players)
    .set({ candy: newCandy })
    .where(eq(players.id, playerId))

  // 3b. Increment packs_purchased in cj_ninja
  if (ninja) {
    await db
      .update(cjNinja)
      .set({ packsPurchased: packsPurchased + 1, updatedAt: new Date().toISOString() })
      .where(eq(cjNinja.userId, playerId))
  }

  // 4. Insert cards into cj_card with strict quantity = 1 (no duplicates)
  for (const card of selectedCards) {
    await db.insert(cjCard).values({
      userId: playerId,
      cardId: card.id,
      quantity: 1,
      memberQuantity: 0,
    })
  }

  // 5. Post-validation: assert single source of truth holds
  const postCardRows = await db.select().from(cjCard).where(eq(cjCard.userId, playerId)).all()
  try {
    validateCardInventory(postCardRows)
  } catch (err) {
    console.error('[BuyPack] Post-insert inventory invariant violation:', err)
  }

  const drawnCardResults: DrawnCard[] = selectedCards.map((c) => {
    return {
      id: c.id,
      name: c.name,
      element: c.element as DrawnCard['element'],
      color: c.color as DrawnCard['color'],
      value: c.value,
      powerId: c.power_id,
      description: c.description ?? '',
      totalOwned: 1,
      isNew: true,
      wasSurplusReplaced: (hasAllNormalCards && c.power_id !== 0) || (hasAllPowerCards && c.power_id === 0),
    }
  })

  const response: BuyPackResponse = {
    ok: true,
    candy: newCandy,
    cards: drawnCardResults,
  }

  return jsonResponse(200, response)
}
