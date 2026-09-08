import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { and, eq, isNull } from 'drizzle-orm'
import { users, userPresence, messages, friendships, userNotifications } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { jsonResponse } from '../stats/respond'
import { identifySessionDetailed, serializeClearSessionCookie } from '../../../shared/session'
import type { StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

interface NotificationCounts {
  readonly friendRequests: number
  readonly newMessages: number
  readonly systemNotifications: number
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
    const [pending, unread, sysNotifs] = await Promise.all([
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
      db
        .select({ id: userNotifications.id })
        .from(userNotifications)
        .where(and(eq(userNotifications.playerId, playerId), isNull(userNotifications.readAt)))
        .all(),
    ])
    return {
      friendRequests: pending.length,
      newMessages: new Set(unread.map((u) => u.conversationId)).size,
      systemNotifications: sysNotifs.length,
    }
  } catch {
    // A broken count must never fail the heartbeat itself.
    return { friendRequests: 0, newMessages: 0, systemNotifications: 0 }
  }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const sessionDetail = await identifySessionDetailed(request, db)

  if (sessionDetail.status === 'revoked' || sessionDetail.status === 'expired') {
    return jsonResponse(
      401,
      { ok: false, error: 'Session revoked', sessionRevoked: true },
      { cookie: serializeClearSessionCookie() },
    )
  }

  if (sessionDetail.status !== 'valid' || !sessionDetail.playerId) {
    return jsonResponse(
      401,
      { ok: false, error: 'Unauthorized: active session required', sessionRevoked: true },
      { cookie: serializeClearSessionCookie() },
    )
  }

  const playerId = sessionDetail.playerId
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user || user.accountLocked === 1) {
    return jsonResponse(
      401,
      { ok: false, error: 'Unauthorized: user account invalid or locked', sessionRevoked: true },
      { cookie: serializeClearSessionCookie() },
    )
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
