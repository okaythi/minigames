import { drizzle } from 'drizzle-orm/d1'
import { eq, or, desc } from 'drizzle-orm'
import { users, sessions } from '../../../../../../src/db/schema'
import { jsonResponse, badRequest } from '../../../../stats/respond'
import type { StatsEnv } from '../../../../stats/store-for'
import { requireUsersAdmin } from '../../_auth'
import { readCookie } from '../../../../../../shared/player-cookie'
import { SESSION_COOKIE_NAME } from '../../../../../../shared/session'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestGet = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const idParam = params.id
  const callerToken = readCookie(request.headers.get('cookie'), SESSION_COOKIE_NAME)
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

  const userSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.playerId, user.playerId))
    .orderBy(desc(sessions.createdAt))
    .all()

  const now = Date.now()
  const mapped = userSessions.map((s) => ({
    token: s.token,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt,
    revokedAt: s.revokedAt,
    userAgent: s.userAgent,
    ipHash: s.ipHash,
    isActive: s.revokedAt === null && s.expiresAt > now,
    isCurrent: Boolean(callerToken && s.token === callerToken),
  }))

  return jsonResponse(200, {
    ok: true,
    sessions: mapped,
  })
}
