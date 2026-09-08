import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users } from '../../../../../../../src/db/schema'
import { revokeSession, revokeAllUserSessions } from '../../../../../../../shared/session'
import { writeAudit } from '../../../../_shared/audit'
import { jsonResponse, badRequest } from '../../../../../stats/respond'
import type { StatsEnv } from '../../../../../stats/store-for'
import { requireUsersAdmin } from '../../../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string; token: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const idParam = params.id
  const tokenParam = params.token

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

  if (tokenParam === 'all') {
    await revokeAllUserSessions(db, user.playerId)
    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.sessions_revoke_all',
      targetType: 'user',
      targetId: user.playerId,
      reason: 'Force logged out all sessions',
      metadata: { targetUsername: user.username },
    })
  } else {
    await revokeSession(db, tokenParam)
    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.session_revoke',
      targetType: 'user',
      targetId: user.playerId,
      reason: 'Revoked single session',
      metadata: { token: tokenParam, targetUsername: user.username },
    })
  }

  return jsonResponse(200, { ok: true, targetPlayerId: user.playerId })
}
