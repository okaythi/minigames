import { drizzle } from 'drizzle-orm/d1'
import { eq, inArray, and } from 'drizzle-orm'
import { users, players, cjCard } from '../../../../src/db/schema'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'
import { DOJO_STORE_CONFIG, calculateCardWeight } from '../../../../shared/card-jitsu-store-config'
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
  const packPrice = DOJO_STORE_CONFIG.pack.price

  if (currentCandy < packPrice) {
    return jsonResponse(400, { ok: false, error: 'insufficient-candy' })
  }

  // 1. Draw exactly 9 normal cards and 1 power card with zero repeats
  const drawnNormals = sampleWeightedWithoutReplacement(
    NORMAL_POOL,
    DOJO_STORE_CONFIG.packRules.normalCardsCount,
  )
  const drawnPowers = sampleWeightedWithoutReplacement(
    POWER_POOL,
    DOJO_STORE_CONFIG.packRules.powerCardsCount,
  )

  const selectedCards = [...drawnNormals, ...drawnPowers]

  // Invariant verification: strict no duplicates
  const distinctIds = new Set(selectedCards.map((c) => c.id))
  if (distinctIds.size !== DOJO_STORE_CONFIG.packRules.totalCards) {
    console.error('[BuyPack] Duplicate card invariant violated in pull:', selectedCards.map((c) => c.id))
    return jsonResponse(500, { ok: false, error: 'draw-invariant-error' })
  }

  const newCandy = currentCandy - packPrice

  // 2. Deduct candy atomically
  await db
    .update(players)
    .set({ candy: newCandy })
    .where(eq(players.id, playerId))

  // 3. Upsert cards into cj_card
  for (const card of selectedCards) {
    const existing = await db
      .select()
      .from(cjCard)
      .where(and(eq(cjCard.userId, playerId), eq(cjCard.cardId, card.id)))
      .get()

    if (existing) {
      await db
        .update(cjCard)
        .set({ quantity: existing.quantity + 1 })
        .where(and(eq(cjCard.userId, playerId), eq(cjCard.cardId, card.id)))
    } else {
      await db.insert(cjCard).values({
        userId: playerId,
        cardId: card.id,
        quantity: 1,
        memberQuantity: 0,
      }).onConflictDoNothing()
    }
  }

  // 4. Fetch updated quantities for the drawn cards
  const updatedRows = await db
    .select({ cardId: cjCard.cardId, quantity: cjCard.quantity })
    .from(cjCard)
    .where(
      and(
        eq(cjCard.userId, playerId),
        inArray(
          cjCard.cardId,
          selectedCards.map((c) => c.id),
        ),
      ),
    )
    .all()

  const quantityMap = new Map(updatedRows.map((r) => [r.cardId, r.quantity]))

  const drawnCardResults: DrawnCard[] = selectedCards.map((c) => {
    const totalOwned = quantityMap.get(c.id) ?? 1
    return {
      id: c.id,
      name: c.name,
      element: c.element as DrawnCard['element'],
      color: c.color as DrawnCard['color'],
      value: c.value,
      powerId: c.power_id,
      description: c.description ?? '',
      totalOwned,
      isNew: totalOwned <= 1,
    }
  })

  const response: BuyPackResponse = {
    ok: true,
    candy: newCandy,
    cards: drawnCardResults,
  }

  return jsonResponse(200, response)
}
