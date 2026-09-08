import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { readCookie } from '../../../shared/player-cookie'
import { revokeSession, serializeClearSessionCookie, SESSION_COOKIE_NAME } from '../../../shared/session'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const token = readCookie(request.headers.get('cookie'), SESSION_COOKIE_NAME)

  if (token) {
    await revokeSession(db, token)
  }

  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)

  if (playerId) {
    const now = Math.floor(Date.now() / 1000)
    await db.update(users).set({
      lastLoggedOut: now,
    }).where(eq(users.playerId, playerId))
  }

  // Clear session cookie and legacy player_id cookie
  const response = jsonResponse(
    200,
    { ok: true },
    { cookie: serializeClearSessionCookie() },
  )
  response.headers.append('set-cookie', 'player_id=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict')

  return response
}
