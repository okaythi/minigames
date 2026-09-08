import { drizzle } from 'drizzle-orm/d1'
import { desc } from 'drizzle-orm'
import { auditLog, users } from '../../../../src/db/schema'
import { jsonResponse } from '../../stats/respond'
import type { StatsEnv } from '../../stats/store-for'
import { requirePlatformAdmin } from './_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requirePlatformAdmin(request, env)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const actor = url.searchParams.get('actor')
  const targetType = url.searchParams.get('targetType') // 'user' | 'game' | 'platform'
  const targetId = url.searchParams.get('targetId')
  const action = url.searchParams.get('action')
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const db = drizzle(env.NIXLABS_DB)

  // Fetch audit log entries ordered by newest first
  const allEntries = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .all()

  // Apply filters in memory
  let filtered = allEntries
  if (actor) {
    filtered = filtered.filter((e) => e.actorPlayerId === actor)
  }
  if (targetType) {
    filtered = filtered.filter((e) => e.targetType === targetType)
  }
  if (targetId) {
    filtered = filtered.filter((e) => e.targetId === targetId)
  }
  if (action) {
    filtered = filtered.filter((e) => e.action.includes(action))
  }

  const total = filtered.length
  const paginated = filtered.slice(offset, offset + limit)

  // Enrich entries with actor usernames
  const actorIds = Array.from(new Set(paginated.map((e) => e.actorPlayerId)))
  const actorUsers =
    actorIds.length > 0
      ? await db.select({ playerId: users.playerId, username: users.username }).from(users).all()
      : []
  const usernameMap = new Map(actorUsers.map((u) => [u.playerId, u.username]))

  const mapped = paginated.map((e) => {
    let parsedMeta: unknown = null
    if (e.metadata) {
      try {
        parsedMeta = JSON.parse(e.metadata)
      } catch {
        parsedMeta = e.metadata
      }
    }

    return {
      id: e.id,
      actorPlayerId: e.actorPlayerId,
      actorUsername: usernameMap.get(e.actorPlayerId) || e.actorPlayerId,
      action: e.action,
      targetType: e.targetType,
      targetId: e.targetId,
      reason: e.reason,
      metadata: parsedMeta,
      createdAt: e.createdAt,
    }
  })

  return jsonResponse(200, {
    ok: true,
    entries: mapped,
    total,
    limit,
    offset,
  })
}
