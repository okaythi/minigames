import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users, staffNotes } from '../../../../../src/db/schema'
import { writeAudit } from '../../_shared/audit'
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
  const { body } = (json || {}) as { body?: string }

  if (!body || body.trim().length === 0) {
    return badRequest('Note content cannot be empty')
  }

  const now = Date.now()
  const inserted = await db
    .insert(staffNotes)
    .values({
      targetPlayerId: user.playerId,
      authorPlayerId: auth.user.playerId,
      body: body.trim(),
      createdAt: now,
    })
    .returning()

  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'user.note_add',
    targetType: 'user',
    targetId: user.playerId,
    reason: 'Staff note created',
    metadata: {
      noteId: inserted[0]?.id,
      targetUsername: user.username,
    },
  })

  return jsonResponse(201, {
    ok: true,
    note: inserted[0],
  })
}
