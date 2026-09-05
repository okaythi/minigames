import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import type { CardJitsuColorPayload, CardJitsuColorResponse } from '../../../shared/card-jitsu-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
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

  let body: CardJitsuColorPayload
  try {
    body = (await request.json()) as CardJitsuColorPayload
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid-json' })
  }

  const colorId = Number(body.colorId)
  // Validates 1–15, ≠14 (14 is Sensei only)
  if (!Number.isInteger(colorId) || colorId < 1 || colorId > 15 || colorId === 14) {
    return jsonResponse(400, { ok: false, error: 'invalid-color-id' })
  }

  const nowIso = new Date().toISOString()
  const existingNinja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()

  if (!existingNinja) {
    await db.insert(cjNinja).values({
      userId: playerId,
      rank: 0,
      progress: 0,
      matchesWon: 0,
      colorId,
      introSeen: 0,
      updatedAt: nowIso,
    }).onConflictDoNothing()
  } else {
    await db
      .update(cjNinja)
      .set({
        colorId,
        updatedAt: nowIso,
      })
      .where(eq(cjNinja.userId, playerId))
  }

  const response: CardJitsuColorResponse = {
    ok: true,
    colorId,
  }

  return jsonResponse(200, response)
}
