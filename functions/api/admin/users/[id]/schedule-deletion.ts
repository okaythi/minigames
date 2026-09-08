import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users } from '../../../../../src/db/schema'
import { jsonResponse, badRequest } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'
import { writeAudit } from '../../_shared/audit'
import { dispatchUserNotification } from '../../_shared/notify'

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

  if (!user) return badRequest('User not found')

  const body = (await readJsonBody(request)) as any
  const { action, scheduledAt, reason } = body || {}

  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return badRequest('An audit reason is strictly required')
  }

  if (action === 'schedule') {
    const timestamp = typeof scheduledAt === 'number' && scheduledAt > Date.now() ? scheduledAt : Date.now() + 14 * 86400 * 1000 // default 14d
    await db.update(users).set({
      scheduledDeletionAt: timestamp,
      scheduledDeletionReason: reason.trim(),
    }).where(eq(users.playerId, user.playerId))

    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.schedule_deletion',
      targetType: 'user',
      targetId: user.playerId,
      reason: reason.trim(),
      metadata: { scheduledAt: timestamp },
    })

    await dispatchUserNotification(db, {
      playerId: user.playerId,
      type: 'account',
      title: 'Account Scheduled for Deletion',
      body: `Your account has been scheduled for permanent deletion on ${new Date(timestamp).toLocaleDateString()}. Reason: ${reason.trim()}`,
    })

    return jsonResponse(200, { ok: true, scheduledAt: timestamp })
  }

  if (action === 'cancel') {
    await db.update(users).set({
      scheduledDeletionAt: null,
      scheduledDeletionReason: null,
    }).where(eq(users.playerId, user.playerId))

    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.cancel_deletion',
      targetType: 'user',
      targetId: user.playerId,
      reason: reason.trim(),
    })

    await dispatchUserNotification(db, {
      playerId: user.playerId,
      type: 'account',
      title: 'Scheduled Deletion Cancelled',
      body: `The scheduled deletion for your account was cancelled: ${reason.trim()}`,
    })

    return jsonResponse(200, { ok: true, cancelled: true })
  }

  return badRequest("Invalid action: must be 'schedule' or 'cancel'")
}
