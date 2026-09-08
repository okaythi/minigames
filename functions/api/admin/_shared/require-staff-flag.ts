import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../../src/db/schema'
import { parseFlags, hasFlag, UserFlags, type UserFlagsBit } from '../../../../shared/flags'
import { identifySession } from '../../../../shared/session'
import { jsonResponse } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'

export interface StaffAuthSuccess {
  readonly ok: true
  readonly user: typeof users.$inferSelect
  readonly flags: number
}

export interface StaffAuthFailure {
  readonly ok: false
  readonly response: Response
}

export type StaffAuthResult = StaffAuthSuccess | StaffAuthFailure

/**
 * Enforces staff capability bitmask checks across all admin endpoints.
 * Requires both `STAFF` and the feature-specific flag bit (`requiredFlag`).
 */
export async function requireStaffFlag(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
  requiredFlag: UserFlagsBit,
): Promise<StaffAuthResult> {
  const db = drizzle(env.NIXLABS_DB)
  const playerId = await identifySession(request, db)

  if (!playerId) {
    return {
      ok: false,
      response: jsonResponse(401, { ok: false, error: 'Unauthorized: active session required' }),
    }
  }

  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user || user.accountLocked === 1) {
    return {
      ok: false,
      response: jsonResponse(401, { ok: false, error: 'Unauthorized: user account invalid or locked' }),
    }
  }

  const flags = parseFlags(user.flags)
  if (!hasFlag(flags, UserFlags.STAFF) || !hasFlag(flags, requiredFlag)) {
    return {
      ok: false,
      response: jsonResponse(403, {
        ok: false,
        error: `Forbidden: STAFF and capability flag (${requiredFlag}) required`,
      }),
    }
  }

  return { ok: true, user, flags }
}
