import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja, cjCard } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import { STARTER_DECK_CARDS } from '../../../shared/progression'

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

  const nowIso = new Date().toISOString()

  // Ensure cj_ninja exists and update intro_seen = 1
  const existingNinja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  if (!existingNinja) {
    await db.insert(cjNinja).values({
      userId: playerId,
      rank: 0,
      progress: 0,
      matchesWon: 0,
      colorId: 1,
      introSeen: 1,
      updatedAt: nowIso,
    }).onConflictDoNothing()
  } else {
    await db
      .update(cjNinja)
      .set({
        introSeen: 1,
        updatedAt: nowIso,
      })
      .where(eq(cjNinja.userId, playerId))
  }

  // Insert Houdini starter deck rows for item 821 into cj_card idempotently
  for (const cardId of STARTER_DECK_CARDS) {
    await db
      .insert(cjCard)
      .values({
        userId: playerId,
        cardId,
        quantity: 1,
        memberQuantity: 0,
      })
      .onConflictDoNothing()
  }

  return jsonResponse(200, { ok: true })
}
