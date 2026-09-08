import { drizzle } from 'drizzle-orm/d1'
import { eq, or, desc } from 'drizzle-orm'
import {
  users,
  staffNotes,
  moderationActions,
  sessions,
  moderationReports,
} from '../../../../../src/db/schema'
import { parseFlags } from '../../../../../shared/flags'
import { toDisplayId } from '../../../../../shared/snowflake'
import { jsonResponse, badRequest } from '../../../stats/respond'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { id: string }
}

export const onRequestGet = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const idParam = params.id
  const db = drizzle(env.NIXLABS_DB)

  // Resolve user by playerId, username, or snowflakeId
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
    return badRequest('User not found')
  }

  // Fetch related telemetry, notes, moderation history, active sessions, and reports
  const [notesList, actionsList, activeSessions, reportsList] = await Promise.all([
    db
      .select()
      .from(staffNotes)
      .where(eq(staffNotes.targetPlayerId, user.playerId))
      .orderBy(desc(staffNotes.createdAt))
      .all(),
    db
      .select()
      .from(moderationActions)
      .where(eq(moderationActions.targetPlayerId, user.playerId))
      .orderBy(desc(moderationActions.createdAt))
      .all(),
    db
      .select()
      .from(sessions)
      .where(eq(sessions.playerId, user.playerId))
      .orderBy(desc(sessions.createdAt))
      .all(),
    db
      .select()
      .from(moderationReports)
      .where(eq(moderationReports.reportedUserId, user.playerId))
      .all(),
  ])

  const flags = parseFlags(user.flags)

  return jsonResponse(200, {
    ok: true,
    user: {
      playerId: user.playerId,
      username: user.username,
      nickname: user.nickname,
      pfpUrl: user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null,
      snowflakeId: user.snowflakeId,
      displaySnowflakeId: user.snowflakeId ? toDisplayId(user.snowflakeId) : null,
      flags,
      accountLocked: user.accountLocked === 1,
      createdOn: user.createdOn,
      lastLoggedIn: user.lastLoggedIn,
      lastLoginIp: user.lastLoginIp,
      lastLoginIpIsVpn: user.lastLoginIpIsVpn === 1,
      registeredInCountry: user.registeredInCountry,
    },
    notes: notesList,
    moderationActions: actionsList,
    sessions: activeSessions.map((s) => ({
      token: s.token,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      revokedAt: s.revokedAt,
      userAgent: s.userAgent,
      ipHash: s.ipHash,
      isActive: s.revokedAt === null && s.expiresAt > Date.now(),
    })),
    reportsCount: reportsList.length,
    openReportsCount: reportsList.filter((r) => r.status === 'open').length,
  })
}
