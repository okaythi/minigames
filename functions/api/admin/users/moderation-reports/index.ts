import { drizzle } from 'drizzle-orm/d1'
import { desc } from 'drizzle-orm'
import { moderationReports, users } from '../../../../../src/db/schema'
import { jsonResponse } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const url = new URL(request.url)
  const statusFilter = url.searchParams.get('status') || 'open' // 'open' | 'resolved' | 'all'
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 50))
  const offset = Math.max(0, Number(url.searchParams.get('offset')) || 0)

  const db = drizzle(env.NIXLABS_DB)

  let query = db
    .select({
      id: moderationReports.id,
      reporterId: moderationReports.reporterId,
      reportedUserId: moderationReports.reportedUserId,
      messageId: moderationReports.messageId,
      reason: moderationReports.reason,
      details: moderationReports.details,
      snapshotContext: moderationReports.snapshotContext,
      status: moderationReports.status,
      reviewedByStaffId: moderationReports.reviewedByStaffId,
      resolutionAction: moderationReports.resolutionAction,
      createdAt: moderationReports.createdAt,
      resolvedAt: moderationReports.resolvedAt,
    })
    .from(moderationReports)
    .orderBy(desc(moderationReports.createdAt))

  const allReports = await query.all()

  const filtered =
    statusFilter === 'all'
      ? allReports
      : allReports.filter((r) => r.status === statusFilter)

  const paginated = filtered.slice(offset, offset + limit)

  // Fetch usernames for reporters and reported users for human-readable display
  const userIds = new Set<string>()
  for (const r of paginated) {
    userIds.add(r.reporterId)
    userIds.add(r.reportedUserId)
  }

  const allUsers = userIds.size > 0
    ? await db.select({ playerId: users.playerId, username: users.username }).from(users).all()
    : []
  const usernameMap = new Map<string, string>(allUsers.map((u) => [u.playerId, u.username]))

  const enriched = paginated.map((r) => ({
    ...r,
    reporterUsername: usernameMap.get(r.reporterId) || r.reporterId,
    reportedUsername: usernameMap.get(r.reportedUserId) || r.reportedUserId,
  }))

  return jsonResponse(200, {
    ok: true,
    reports: enriched,
    total: filtered.length,
    limit,
    offset,
  })
}
