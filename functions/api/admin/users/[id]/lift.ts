import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users, moderationActions } from '../../../../../src/db/schema'
import { parseFlags, disableFlag, UserFlags } from '../../../../../shared/flags'
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
  const { actionId, actionType, reason } = (json || {}) as {
    actionId?: number
    actionType?: string
    reason?: string
  }

  if (!reason || reason.trim().length === 0) {
    return badRequest('A reason is required to lift a restriction')
  }

  const now = Date.now()

  // If specific actionId provided, mark it revoked
  if (actionId) {
    await db
      .update(moderationActions)
      .set({ revokedAt: now, revokedBy: auth.user.playerId })
      .where(eq(moderationActions.id, actionId))
  }

  let currentFlags = parseFlags(user.flags)

  // Lift restrictions based on actionType
  if (actionType === 'ban' || user.accountLocked === 1) {
    await db.update(users).set({ accountLocked: 0 }).where(eq(users.playerId, user.playerId))
  }
  if (actionType === 'mute') {
    currentFlags = disableFlag(currentFlags, UserFlags.USER_MESSAGES_BLOCKED)
    await db.update(users).set({ flags: currentFlags }).where(eq(users.playerId, user.playerId))
  } else if (actionType === 'friends_block') {
    currentFlags = disableFlag(currentFlags, UserFlags.USER_FRIENDS_BLOCKED)
    await db.update(users).set({ flags: currentFlags }).where(eq(users.playerId, user.playerId))
  }

  // Write audit
  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: `user.lift.${actionType || 'general'}`,
    targetType: 'user',
    targetId: user.playerId,
    reason: reason.trim(),
    metadata: {
      actionId,
      actionType,
      targetUsername: user.username,
    },
  })

  // Dispatch notification to user
  await dispatchUserNotification(db, {
    playerId: user.playerId,
    type: 'moderation',
    title: 'Account Restriction Lifted',
    body: `Your restriction (${actionType || 'account standing'}) has been lifted: ${reason.trim()}`,
  })

  return jsonResponse(200, { ok: true, targetPlayerId: user.playerId })
}
