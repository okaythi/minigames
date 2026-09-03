import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, userPresence } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  const body = (await readJsonBody(request)) as {
    slug?: string | null
    state?: 'online' | 'idle'
    startedAt?: number | null
  } | null

  const nowSeconds = Math.floor(Date.now() / 1000)
  const currentState = body?.state === 'idle' ? 'idle' : 'online'
  const slug = typeof body?.slug === 'string' && body.slug.length > 0 ? body.slug : null
  const startedAt = typeof body?.startedAt === 'number' ? Math.floor(body.startedAt) : (slug ? nowSeconds : null)

  const existing = await db.select().from(userPresence).where(eq(userPresence.playerId, playerId)).get()
  if (existing) {
    await db
      .update(userPresence)
      .set({
        lastActiveAt: nowSeconds,
        state: currentState,
        gameSlug: slug,
        gameStartedAt: slug ? (existing.gameSlug === slug ? existing.gameStartedAt : startedAt) : null,
      })
      .where(eq(userPresence.playerId, playerId))
      .run()
  } else {
    await db
      .insert(userPresence)
      .values({
        playerId,
        lastActiveAt: nowSeconds,
        state: currentState,
        gameSlug: slug,
        gameStartedAt: startedAt,
      })
      .run()
  }

  return jsonResponse(200, { ok: true })
}
