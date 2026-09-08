import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users, moderationActions } from '../../../../../src/db/schema'
import { parseFlags, enableFlag, UserFlags } from '../../../../../shared/flags'
import { revokeAllUserSessions } from '../../../../../shared/session'
import { writeAudit } from '../../_shared/audit'
import { dispatchUserNotification } from '../../_shared/notify'
import { readJsonBody } from '../../../stats/body'
import { jsonResponse, badRequest } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const idParam = params.id
  const user = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.playerId, idParam),
        eq(users.username, idParam.toLowerCase()),
        eq(users.snowflakeId, idParam),
      ),
    )
    .get()

  if (!user) {
    return badRequest('Target user not found')
  }

  const json = await readJsonBody(request)
  const { actionType, reason, durationSeconds } = (json || {}) as {
    actionType?: string
    reason?: string
    durationSeconds?: number | null
  }

  if (!actionType || !['ban', 'mute', 'friends_block', 'warn'].includes(actionType)) {
    return badRequest('Invalid actionType (expected ban, mute, friends_block, or warn)')
  }
  if (!reason || reason.trim().length === 0) {
    return badRequest('A reason is required for moderation actions')
  }

  const now = Date.now()
  const expiresAt = durationSeconds && durationSeconds > 0 ? now + durationSeconds * 1000 : null
  let currentFlags = parseFlags(user.flags)

  // Apply action primitives
  if (actionType === 'ban') {
    await db.update(users).set({ accountLocked: 1 }).where(eq(users.playerId, user.playerId))
    await revokeAllUserSessions(db, user.playerId)
  } else if (actionType === 'mute') {
    currentFlags = enableFlag(currentFlags, UserFlags.USER_MESSAGES_BLOCKED)
    await db.update(users).set({ flags: currentFlags }).where(eq(users.playerId, user.playerId))
  } else if (actionType === 'friends_block') {
    currentFlags = enableFlag(currentFlags, UserFlags.USER_FRIENDS_BLOCKED)
    await db.update(users).set({ flags: currentFlags }).where(eq(users.playerId, user.playerId))
  }

  // Insert moderation action record
  const inserted = await db
    .insert(moderationActions)
    .values({
      targetPlayerId: user.playerId,
      actorPlayerId: auth.user.playerId,
      actionType,
      reason: reason.trim(),
      expiresAt,
      createdAt: now,
    })
    .returning({ id: moderationActions.id })

  const actionId = inserted[0]?.id

  // Write immutable audit entry
  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: `user.action.${actionType}`,
    targetType: 'user',
    targetId: user.playerId,
    reason: reason.trim(),
    metadata: {
      actionId,
      actionType,
      targetUsername: user.username,
      durationSeconds: durationSeconds ?? null,
      expiresAt,
    },
  })

  // Dispatch notification to user (except ban actions)
  if (actionType !== 'ban') {
    const title =
      actionType === 'warn'
        ? 'Official Account Warning'
        : actionType === 'mute'
          ? 'Account Mute Imposed'
          : 'Friend Interactions Blocked'
    const expiryStr = expiresAt ? ` (Expires ${new Date(expiresAt).toLocaleDateString()})` : ' (Permanent)'
    await dispatchUserNotification(db, {
      playerId: user.playerId,
      type: actionType === 'warn' ? 'warning' : 'moderation',
      title,
      body: `Staff action applied: ${reason.trim()}${expiryStr}`,
    })
  }

  return jsonResponse(200, {
    ok: true,
    actionId,
    actionType,
    targetPlayerId: user.playerId,
  })
}
