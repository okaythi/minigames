import { drizzle } from 'drizzle-orm/d1'
import { like, or, eq, sql } from 'drizzle-orm'
import { users } from '../../../../src/db/schema'
import { parseFlags, hasFlag } from '../../../../shared/flags'
import { toDisplayId } from '../../../../shared/snowflake'
import { jsonResponse } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'
import { requireUsersAdmin } from './_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') || '').trim().toLowerCase()
  const statusFilter = url.searchParams.get('status') // 'banned' | 'active' | null
  const flagFilter = url.searchParams.get('flag') // numeric string or null
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 25))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const db = drizzle(env.NIXLABS_DB)

  // Base conditions
  const conditions = []
  if (q.length > 0) {
    conditions.push(
      or(
        like(users.username, `%${q}%`),
        like(users.playerId, `%${q}%`),
        like(users.snowflakeId, `%${q}%`),
      ),
    )
  }
  if (statusFilter === 'banned') {
    conditions.push(eq(users.accountLocked, 1))
  } else if (statusFilter === 'active') {
    conditions.push(eq(users.accountLocked, 0))
  }

  let query = db.select().from(users)
  if (conditions.length > 0) {
    query = query.where(conditions[0]!) as any
  }

  const [allMatched, totalAll, activeAll, bannedAll] = await Promise.all([
    query.all(),
    db.select({ count: sql<number>`count(*)` }).from(users).get(),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountLocked, 0)).get(),
    db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.accountLocked, 1)).get(),
  ])

  // Apply flag filter in memory if provided
  let filtered = allMatched
  if (flagFilter) {
    const requiredBit = Number(flagFilter)
    if (!isNaN(requiredBit) && requiredBit > 0) {
      filtered = filtered.filter((u) => hasFlag(parseFlags(u.flags), requiredBit))
    }
  }

  const total = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  // Map user rows for response
  const mappedUsers = paginated.map((u) => {
    const flags = parseFlags(u.flags)
    return {
      playerId: u.playerId,
      username: u.username,
      nickname: u.nickname,
      snowflakeId: u.snowflakeId,
      displaySnowflakeId: u.snowflakeId ? toDisplayId(u.snowflakeId) : null,
      flags,
      accountLocked: u.accountLocked === 1,
      createdOn: u.createdOn,
      lastLoggedIn: u.lastLoggedIn,
      lastLoginIp: u.lastLoginIp,
      lastLoginIpIsVpn: u.lastLoginIpIsVpn === 1,
      registeredInCountry: u.registeredInCountry,
    }
  })

  return jsonResponse(200, {
    ok: true,
    users: mappedUsers,
    total,
    metrics: {
      total: totalAll?.count ?? total,
      active: activeAll?.count ?? 0,
      banned: bannedAll?.count ?? 0,
    },
    limit,
    offset,
  })
}
