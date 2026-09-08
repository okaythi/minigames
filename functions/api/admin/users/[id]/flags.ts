import { drizzle } from 'drizzle-orm/d1'
import { eq, or } from 'drizzle-orm'
import { users } from '../../../../../src/db/schema'
import { parseFlags, hasFlag, UserFlags } from '../../../../../shared/flags'
import { writeAudit } from '../../_shared/audit'
import { readJsonBody } from '../../../stats/body'
import { jsonResponse, badRequest } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requirePlatformAdmin } from '../../platform/_auth'
import { requireUsersAdmin } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  try {
    // Either PLATFORM_ADMIN or USERS_ADMIN is permitted to manage account flags
    let auth = await requirePlatformAdmin(request, env)
    if (!auth.ok) {
      auth = await requireUsersAdmin(request, env)
    }
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
    const { flags: newFlagsRaw, reason } = (json || {}) as {
      flags?: unknown
      reason?: string
    }

    if (newFlagsRaw === undefined || typeof newFlagsRaw !== 'number' || isNaN(newFlagsRaw)) {
      return badRequest('flags must be a valid integer bitmask')
    }

    const oldFlags = parseFlags(user.flags)
    const newFlags = parseFlags(newFlagsRaw)

    // Privilege escalation prevention:
    // Only PLATFORM_ADMIN can grant or revoke PLATFORM_ADMIN privilege
    const operatorFlags = auth.flags
    if (!hasFlag(operatorFlags, UserFlags.PLATFORM_ADMIN)) {
      const wasPlatformAdmin = hasFlag(oldFlags, UserFlags.PLATFORM_ADMIN)
      const willBePlatformAdmin = hasFlag(newFlags, UserFlags.PLATFORM_ADMIN)
      if (wasPlatformAdmin !== willBePlatformAdmin) {
        return badRequest('Only PLATFORM_ADMIN can grant or revoke PLATFORM_ADMIN privilege')
      }
    }

    await db.update(users).set({ flags: newFlags }).where(eq(users.playerId, user.playerId))

    const effectiveReason = reason?.trim() || 'Updated account flags via Admin Console'

    await writeAudit(db, {
      actorPlayerId: auth.user.playerId,
      action: 'user.flags_update',
      targetType: 'user',
      targetId: user.playerId,
      reason: effectiveReason,
      metadata: {
        targetUsername: user.username,
        before: oldFlags,
        after: newFlags,
      },
    })

    return jsonResponse(200, {
      ok: true,
      targetPlayerId: user.playerId,
      flags: newFlags,
    })
  } catch (err: any) {
    console.error('[admin/users/flags onRequestPost] error:', err)
    return jsonResponse(500, { ok: false, error: err?.message || 'Failed to update user flags' })
  }
}

