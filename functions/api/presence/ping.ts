import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { and, eq, isNull } from 'drizzle-orm'
import { users, userPresence, messages, friendships } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

interface NotificationCounts {
  readonly friendRequests: number
  readonly newMessages: number
}

/**
 * Cheap badge counts (indexed selects on the player's own rows). Piggybacking
 * them on the presence heartbeat saves the client two separate polling
 * requests per cycle — every Functions route request counts against the
 * Pages quota, 304s and cache hits included.
 */
async function getNotificationCounts(
  db: DrizzleD1Database,
  playerId: string,
): Promise<NotificationCounts> {
  try {
    const [pending, unread] = await Promise.all([
      db
        .select({ id: friendships.requesterId })
        .from(friendships)
        .where(and(eq(friendships.addresseeId, playerId), eq(friendships.status, 'pending')))
        .all(),
      db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(
          and(
            eq(messages.recipientId, playerId),
            isNull(messages.readAt),
            eq(messages.deletedByRecipient, 0),
          ),
        )
        .all(),
    ])
    return {
      friendRequests: pending.length,
      newMessages: new Set(unread.map((u) => u.conversationId)).size,
    }
  } catch {
    // A broken count must never fail the heartbeat itself.
    return { friendRequests: 0, newMessages: 0 }
  }
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

  const notifications = await getNotificationCounts(db, playerId)

  return jsonResponse(200, { ok: true, notifications })
}
