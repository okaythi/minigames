import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { moderationReports, users } from '../../../src/db/schema'
import { identifySession } from '../../../shared/session'
import { identifyPlayer } from '../stats/identity'
import { readJsonBody } from '../stats/body'
import { jsonResponse, badRequest } from '../stats/respond'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)

  // Identify reporter (must be logged in user)
  let reporterId = await identifySession(request, db)
  if (!reporterId) {
    const store = storeFor(env)
    const identified = await identifyPlayer(request, store)
    reporterId = identified.playerId
  }

  if (!reporterId) {
    return badRequest('You must be logged in to submit a report')
  }

  const reporter = await db.select().from(users).where(eq(users.playerId, reporterId)).get()
  if (!reporter) {
    return badRequest('Reporter account not found')
  }

  const json = await readJsonBody(request)
  const { reportedUserId, messageId, reason, details, snapshotContext } = (json || {}) as {
    reportedUserId?: string
    messageId?: string
    reason?: string
    details?: string
    snapshotContext?: string
  }

  if (!reportedUserId) {
    return badRequest('reportedUserId is required')
  }
  if (!reason || reason.trim().length === 0) {
    return badRequest('Report reason is required')
  }

  // Ensure reported user exists
  const targetUser = await db.select().from(users).where(eq(users.playerId, reportedUserId)).get()
  if (!targetUser) {
    return badRequest('Reported user does not exist')
  }

  const reportId = crypto.randomUUID()
  const now = Date.now()

  await db.insert(moderationReports).values({
    id: reportId,
    reporterId: reporter.playerId,
    reportedUserId: targetUser.playerId,
    messageId: messageId ?? null,
    reason: reason.trim(),
    details: details?.trim() ?? null,
    snapshotContext: snapshotContext?.trim() ?? null,
    status: 'open',
    createdAt: now,
  })

  return jsonResponse(201, {
    ok: true,
    reportId,
  })
}
