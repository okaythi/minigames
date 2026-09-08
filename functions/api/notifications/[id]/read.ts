import { drizzle } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { userNotifications } from '../../../../src/db/schema'
import { identifySession } from '../../../../shared/session'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse, badRequest } from '../../stats/respond'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const sessionPlayerId = await identifySession(request, db)
  let playerId = sessionPlayerId

  if (!playerId) {
    const store = storeFor(env)
    const identified = await identifyPlayer(request, store)
    playerId = identified.playerId
  }

  if (!playerId) {
    return badRequest('Unauthorized')
  }

  const notifId = Number(params.id)
  if (isNaN(notifId)) {
    return badRequest('Invalid notification ID')
  }

  await db
    .update(userNotifications)
    .set({ readAt: Date.now() })
    .where(and(eq(userNotifications.id, notifId), eq(userNotifications.playerId, playerId)))

  return jsonResponse(200, { ok: true, readId: notifId })
}
