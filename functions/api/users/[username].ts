import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { badRequest, jsonResponse } from '../stats/respond'
import type { StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { username: string }
}

export const onRequestGet = async ({ env, params }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const username = params.username.toLowerCase()

  const user = await db.select().from(users).where(eq(users.username, username)).get()
  
  if (!user) {
    return badRequest('user not found')
  }

  return jsonResponse(200, {
    ok: true,
    profile: {
      username: user.username,
      nickname: user.nickname,
      pfpUrl: user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null,
    },
  })
}
