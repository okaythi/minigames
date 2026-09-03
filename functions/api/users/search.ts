import { drizzle } from 'drizzle-orm/d1'
import { like, or } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { jsonResponse } from '../stats/respond'
import type { StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()

  if (!q) {
    return jsonResponse(200, { ok: true, users: [] })
  }

  const db = drizzle(env.NIXLABS_DB)
  const userRows = await db
    .select({
      username: users.username,
      nickname: users.nickname,
      pfpR2Key: users.pfpR2Key,
      flags: users.flags,
      developer: users.developer,
      legacyUser: users.legacyUser,
    })
    .from(users)
    .where(
      or(
        like(users.username, `${q}%`),
        like(users.username, `%${q}%`),
        like(users.nickname, `%${q}%`),
      ),
    )
    .limit(10)
    .all()

  const result = userRows.map((u) => ({
    username: u.username,
    nickname: u.nickname ?? undefined,
    pfpUrl: u.pfpR2Key ? `/api/assets/pfp/${u.pfpR2Key}` : null,
    flags: u.flags,
    developer: u.developer === 1,
    legacyUser: u.legacyUser === 1,
  }))

  return jsonResponse(200, { ok: true, users: result })
}
