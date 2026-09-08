import { drizzle } from 'drizzle-orm/d1'
import { eq, desc, and, isNull } from 'drizzle-orm'
import { userNotifications } from '../../../src/db/schema'
import { identifySession } from '../../../shared/session'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const sessionPlayerId = await identifySession(request, db)
  let playerId = sessionPlayerId

  if (!playerId) {
    const store = storeFor(env)
    const identified = await identifyPlayer(request, store)
    playerId = identified.playerId
  }

  if (!playerId) {
    return jsonResponse(200, { ok: true, notifications: [] })
  }

  const items = await db
    .select()
    .from(userNotifications)
    .where(and(eq(userNotifications.playerId, playerId), isNull(userNotifications.readAt)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(20)
    .all()

  return jsonResponse(200, { ok: true, notifications: items })
}
