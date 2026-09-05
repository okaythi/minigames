import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { users, cjNinja, cjNinjaColors } from '../../../../src/db/schema'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'
import { DOJO_STORE_CONFIG } from '../../../../shared/card-jitsu-store-config'
import type { EquipColorPayload, EquipColorResponse } from '../../../../shared/card-jitsu-shop-protocol'

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

  let body: EquipColorPayload
  try {
    body = (await request.json()) as EquipColorPayload
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

  // Verify ownership
  const isDefault = colorId === 1 || colorConfig.defaultUnlocked === true
  if (!isDefault) {
    const ownedRow = await db
      .select()
      .from(cjNinjaColors)
      .where(and(eq(cjNinjaColors.userId, playerId), eq(cjNinjaColors.colorId, colorId)))
      .get()

    if (!ownedRow) {
      return jsonResponse(403, { ok: false, error: 'color-not-owned' })
    }
  }

  const nowIso = new Date().toISOString()
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

  const response: EquipColorResponse = {
    ok: true,
    colorId,
  }

  return jsonResponse(200, response)
}
