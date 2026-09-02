import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)

  if (playerId) {
    const db = drizzle(env.NIXLABS_DB)
    const now = Math.floor(Date.now() / 1000)
    await db.update(users).set({
      lastLoggedOut: now,
    }).where(eq(users.playerId, playerId))
  }

  // Clear cookie by setting expiry to past
  const cookie = 'player_id=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
  
  return jsonResponse(200, { ok: true }, { cookie })
}
