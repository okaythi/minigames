import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { moderationReports } from '../../../../../../src/db/schema'
import { writeAudit } from '../../../_shared/audit'
import { readJsonBody } from '../../../../stats/body'
import { jsonResponse, badRequest } from '../../../../stats/respond'
import type { StatsEnv } from '../../../../stats/store-for'
import { requireUsersAdmin } from '../../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { reportId: string }
}

export const onRequestPost = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const reportId = params.reportId
  const db = drizzle(env.NIXLABS_DB)

  const report = await db
    .select()
    .from(moderationReports)
    .where(eq(moderationReports.id, reportId))
    .get()

  if (!report) {
    return badRequest('Report not found')
  }

  const json = await readJsonBody(request)
  const { resolutionAction, details } = (json || {}) as {
    resolutionAction?: string
    details?: string
  }

  if (!resolutionAction || resolutionAction.trim().length === 0) {
    return badRequest('Resolution action is required')
  }

  const now = Date.now()

  await db
    .update(moderationReports)
    .set({
      status: 'resolved',
      reviewedByStaffId: auth.user.playerId,
      resolutionAction: resolutionAction.trim(),
      resolvedAt: now,
    })
    .where(eq(moderationReports.id, reportId))

  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'report.resolve',
    targetType: 'user',
    targetId: report.reportedUserId,
    reason: `Report resolved: ${resolutionAction.trim()}`,
    metadata: {
      reportId,
      reporterId: report.reporterId,
      resolutionAction: resolutionAction.trim(),
      details: details || null,
    },
  })

  return jsonResponse(200, { ok: true, reportId })
}
