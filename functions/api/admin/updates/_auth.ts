import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../../src/db/schema'
import { parseFlags, hasFlag, UserFlags } from '../../../../shared/flags'
import { identifyPlayer } from '../../stats/identity'
import { storeFor, type StatsEnv } from '../../stats/store-for'
import { jsonResponse } from '../../stats/respond'

export interface CmsAuthSuccess {
  readonly ok: true
  readonly user: typeof users.$inferSelect
  readonly flags: number
}

export interface CmsAuthFailure {
  readonly ok: false
  readonly response: Response
}

export type CmsAuthResult = CmsAuthSuccess | CmsAuthFailure

export async function requireCmsEditor(
  request: Request,
  env: StatsEnv & { NIXLABS_DB: D1Database },
): Promise<CmsAuthResult> {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)

  if (!playerId) {
    return {
      ok: false,
      response: jsonResponse(401, { ok: false, error: 'Unauthorized: login required' }),
    }
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()

  if (!user || user.accountLocked === 1) {
    return {
      ok: false,
      response: jsonResponse(401, { ok: false, error: 'Unauthorized: user account invalid or locked' }),
    }
  }

  const flags = parseFlags(user.flags)
  const isStaff = hasFlag(flags, UserFlags.STAFF)
  const isCmsEditor = hasFlag(flags, UserFlags.CMS_EDITOR)


  if (!isStaff || !isCmsEditor) {
    return {
      ok: false,
      response: jsonResponse(403, {
        ok: false,
        error: 'Forbidden: STAFF and CMS_EDITOR flags required to access the Update Notes CMS',
      }),
    }
  }

  return { ok: true, user, flags }
}
