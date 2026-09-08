import { drizzle } from 'drizzle-orm/d1'
import { eq, or, and } from 'drizzle-orm'
import { users, userDismissables } from '../../../../../src/db/schema'
import { jsonResponse, badRequest } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'
import { writeAudit } from '../../_shared/audit'

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

  const items = await db.select().from(userDismissables).where(eq(userDismissables.playerId, user.playerId)).all()
  return jsonResponse(200, { ok: true, dismissables: items })
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
  const { key, action, reason } = body || {}

  if (action === 'reset') {
    if (key === 'all') {
      await db.delete(userDismissables).where(eq(userDismissables.playerId, user.playerId))
    } else if (typeof key === 'string') {
      await db.delete(userDismissables).where(and(eq(userDismissables.playerId, user.playerId), eq(userDismissables.key, key)))
    } else {
      return badRequest('Key required')
    }

    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.reset_dismissables',
      targetType: 'user',
      targetId: user.playerId,
      reason: reason || 'Staff reset dismissables',
      metadata: { key },
    })

    return jsonResponse(200, { ok: true, resetKey: key })
  }

  return badRequest("Invalid action: must be 'reset'")
}
