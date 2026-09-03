import { drizzle } from 'drizzle-orm/d1'
import { eq, or, and } from 'drizzle-orm'
import { users, friendships } from '../../../src/db/schema'
import { hasFlag, UserFlags, enableFlag } from '../../../shared/flags'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

const MAX_FRIENDS = 500

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId: senderPlayerId } = await identifyPlayer(request, store)
  if (!senderPlayerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const sender = await db.select().from(users).where(eq(users.playerId, senderPlayerId)).get()
  if (!sender) {
    return badRequest('unauthorized')
  }

  const body = (await readJsonBody(request)) as {
    targetUsername?: string
    action?: 'send' | 'accept' | 'decline' | 'remove' | 'block'
  } | null

  if (!body?.targetUsername || !body.action) {
    return badRequest('targetUsername and action are required')
  }

  const targetUsername = body.targetUsername.toLowerCase()
  if (targetUsername === sender.username.toLowerCase()) {
    return badRequest('cannot friend yourself')
  }

  const target = await db.select().from(users).where(eq(users.username, targetUsername)).get()
  if (!target) {
    return badRequest('user not found')
  }

  // T&S Flags checks
  if (hasFlag(target.flags, UserFlags.TEST_ACCOUNT)) {
    return badRequest('cannot interact with a test account')
  }

  if (body.action === 'send' || body.action === 'accept') {
    if (hasFlag(sender.flags, UserFlags.USER_FRIENDS_BLOCKED)) {
      return jsonResponse(403, { ok: false, error: 'Your account is restricted from managing friends.' })
    }
    if (hasFlag(sender.flags, UserFlags.USER_FRIENDS_MAX)) {
      return jsonResponse(400, { ok: false, error: 'You have reached the maximum friends limit (500).' })
    }
    if (hasFlag(target.flags, UserFlags.USER_FRIENDS_BLOCKED)) {
      return jsonResponse(400, { ok: false, error: 'This user cannot receive friend requests.' })
    }
    if (hasFlag(target.flags, UserFlags.USER_FRIENDS_MAX)) {
      return jsonResponse(400, { ok: false, error: 'This user has reached the maximum friends limit.' })
    }
  }

  // Find existing relationship between sender and target
  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, target.playerId)),
        and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)),
      ),
    )
    .get()

  if (existing?.status === 'blocked' && body.action !== 'block') {
    return jsonResponse(403, { ok: false, error: 'Action not allowed' })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  if (body.action === 'send') {
    if (existing) {
      if (existing.status === 'accepted') return jsonResponse(200, { ok: true, status: 'accepted' })
      if (existing.status === 'pending') {
        if (existing.requesterId === target.playerId) {
          // Both wanted to be friends -> auto accept
          await db
            .update(friendships)
            .set({ status: 'accepted', updatedAt: nowSeconds })
            .where(
              and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)),
            )
            .run()
          return jsonResponse(200, { ok: true, status: 'accepted' })
        }
        return jsonResponse(200, { ok: true, status: 'pending' })
      }
    }

    // Check sender friends count
    const senderFriends = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, senderPlayerId)),
        ),
      )
      .all()

    if (senderFriends.length >= MAX_FRIENDS) {
      await db
        .update(users)
        .set({ flags: enableFlag(sender.flags, UserFlags.USER_FRIENDS_MAX) })
        .where(eq(users.playerId, senderPlayerId))
        .run()
      return jsonResponse(400, { ok: false, error: 'Maximum 500 friends reached' })
    }

    if (existing) {
      await db
        .update(friendships)
        .set({
          requesterId: senderPlayerId,
          addresseeId: target.playerId,
          status: 'pending',
          updatedAt: nowSeconds,
        })
        .where(
          or(
            and(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, target.playerId)),
            and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)),
          ),
        )
        .run()
    } else {
      await db
        .insert(friendships)
        .values({
          requesterId: senderPlayerId,
          addresseeId: target.playerId,
          status: 'pending',
          createdAt: nowSeconds,
          updatedAt: nowSeconds,
        })
        .run()
    }

    return jsonResponse(200, { ok: true, status: 'pending' })
  }

  if (body.action === 'accept') {
    if (!existing || existing.status !== 'pending' || existing.addresseeId !== senderPlayerId) {
      return badRequest('no pending request to accept')
    }

    await db
      .update(friendships)
      .set({ status: 'accepted', updatedAt: nowSeconds })
      .where(and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)))
      .run()

    return jsonResponse(200, { ok: true, status: 'accepted' })
  }

  if (body.action === 'decline' || body.action === 'remove') {
    if (existing) {
      await db
        .delete(friendships)
        .where(
          or(
            and(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, target.playerId)),
            and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)),
          ),
        )
        .run()
    }
    return jsonResponse(200, { ok: true, status: 'none' })
  }

  if (body.action === 'block') {
    if (existing) {
      await db
        .update(friendships)
        .set({
          requesterId: senderPlayerId,
          addresseeId: target.playerId,
          status: 'blocked',
          updatedAt: nowSeconds,
        })
        .where(
          or(
            and(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, target.playerId)),
            and(eq(friendships.requesterId, target.playerId), eq(friendships.addresseeId, senderPlayerId)),
          ),
        )
        .run()
    } else {
      await db
        .insert(friendships)
        .values({
          requesterId: senderPlayerId,
          addresseeId: target.playerId,
          status: 'blocked',
          createdAt: nowSeconds,
          updatedAt: nowSeconds,
        })
        .run()
    }
    return jsonResponse(200, { ok: true, status: 'blocked' })
  }

  return badRequest('invalid action')
}
