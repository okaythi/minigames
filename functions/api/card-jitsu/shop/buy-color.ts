import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { users, players, cjNinja, cjNinjaColors } from '../../../../src/db/schema'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'
import { DOJO_STORE_CONFIG } from '../../../../shared/card-jitsu-store-config'
import type { BuyColorPayload, BuyColorResponse } from '../../../../shared/card-jitsu-shop-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
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

  let body: BuyColorPayload
  try {
    body = (await request.json()) as BuyColorPayload
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid-json' })
  }

  const colorId = Number(body.colorId)
  if (!Number.isInteger(colorId) || colorId === 14) {
    return jsonResponse(400, { ok: false, error: 'invalid-color-id' })
  }

  const colorConfig = DOJO_STORE_CONFIG.colors.find((c) => c.id === colorId)
  if (!colorConfig) {
    return jsonResponse(400, { ok: false, error: 'color-not-found' })
  }

  // Check if already owned
  if (colorId === 1 || colorConfig.defaultUnlocked) {
    return jsonResponse(400, { ok: false, error: 'already-owned' })
  }

  const existingColor = await db
    .select()
    .from(cjNinjaColors)
    .where(and(eq(cjNinjaColors.userId, playerId), eq(cjNinjaColors.colorId, colorId)))
    .get()

  if (existingColor) {
    return jsonResponse(400, { ok: false, error: 'already-owned' })
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const currentCandy = playerRow?.candy ?? 0
  const price = colorConfig.price

  if (currentCandy < price) {
    return jsonResponse(400, { ok: false, error: 'insufficient-candy' })
  }

  const newCandy = currentCandy - price
  const nowIso = new Date().toISOString()

  // Deduct candy
  await db
    .update(players)
    .set({ candy: newCandy })
    .where(eq(players.id, playerId))

  // Record unlocked color
  await db.insert(cjNinjaColors).values({
    userId: playerId,
    colorId,
    unlockedAt: nowIso,
  }).onConflictDoNothing()

  // Auto-equip the purchased color
  const existingNinja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  if (existingNinja) {
    await db
      .update(cjNinja)
      .set({
        colorId,
        updatedAt: nowIso,
      })
      .where(eq(cjNinja.userId, playerId))
  } else {
    await db.insert(cjNinja).values({
      userId: playerId,
      rank: 0,
      progress: 0,
      matchesWon: 0,
      colorId,
      introSeen: 0,
      updatedAt: nowIso,
    }).onConflictDoNothing()
  }

  const response: BuyColorResponse = {
    ok: true,
    candy: newCandy,
    colorId,
  }

  return jsonResponse(200, response)
}
