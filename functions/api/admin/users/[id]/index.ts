import { drizzle } from 'drizzle-orm/d1'
import { eq, or, desc } from 'drizzle-orm'
import {
  users,
  players,
  staffNotes,
  moderationActions,
  sessions,
  moderationReports,
  userNotifications,
  userDismissables,
} from '../../../../../src/db/schema'
import { parseFlags } from '../../../../../shared/flags'
import { toDisplayId } from '../../../../../shared/snowflake'
import { jsonResponse, badRequest } from '../../../stats/respond'
import { readJsonBody } from '../../../stats/body'
import type { StatsEnv } from '../../../stats/store-for'
import { requireUsersAdmin } from '../_auth'
import { writeAudit } from '../../_shared/audit'
import { dispatchUserNotification } from '../../_shared/notify'
import { buildUserPatch } from './patch-user-helper'

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

  const [notesList, actionsList, activeSessions, reportsList, playerRow, dismissablesList] = await Promise.all([
    db.select().from(staffNotes).where(eq(staffNotes.targetPlayerId, user.playerId)).orderBy(desc(staffNotes.createdAt)).all(),
    db.select().from(moderationActions).where(eq(moderationActions.targetPlayerId, user.playerId)).orderBy(desc(moderationActions.createdAt)).all(),
    db.select().from(sessions).where(eq(sessions.playerId, user.playerId)).orderBy(desc(sessions.createdAt)).all(),
    db.select().from(moderationReports).where(eq(moderationReports.reportedUserId, user.playerId)).all(),
    db.select().from(players).where(eq(players.id, user.playerId)).get(),
    db.select().from(userDismissables).where(eq(userDismissables.playerId, user.playerId)).all(),
  ])

  const flags = parseFlags(user.flags)

  return jsonResponse(200, {
    ok: true,
    user: {
      playerId: user.playerId,
      username: user.username,
      nickname: user.nickname,
      nicknameChangedCount: user.nicknameChangedCount,
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
      registeredIp: user.registeredIp,
      legacyUser: user.legacyUser === 1,
      developer: user.developer === 1,
      candy: playerRow?.candy ?? 0,
      scheduledDeletionAt: user.scheduledDeletionAt ?? null,
      scheduledDeletionReason: user.scheduledDeletionReason ?? null,
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
    dismissables: dismissablesList,
    reportsCount: reportsList.length,
    openReportsCount: reportsList.filter((r) => r.status === 'open').length,
  })
}

export const onRequestPatch = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const idParam = params.id
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

  if (!user) return badRequest('User not found')

  const body = (await readJsonBody(request)) as any
  const { auditReason } = body || {}

  if (!auditReason || typeof auditReason !== 'string' || auditReason.trim().length === 0) {
    return badRequest('An auditReason is strictly required for administrative user modifications')
  }

  const patchResult = await buildUserPatch({ db, user, body })
  if (patchResult.error) {
    return badRequest(patchResult.error)
  }

  const { beforeDiff, afterDiff, userUpdates, candyUpdate } = patchResult

  if (Object.keys(userUpdates).length > 0) {
    await db.update(users).set(userUpdates).where(eq(users.playerId, user.playerId))
  }

  if (candyUpdate !== undefined) {
    await db.update(players).set({ candy: candyUpdate }).where(eq(players.id, user.playerId))
  }

  // Audit log
  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'user.update_profile',
    targetType: 'user',
    targetId: user.playerId,
    reason: auditReason.trim(),
    metadata: { before: beforeDiff, after: afterDiff },
  })

  // In-app notification
  await dispatchUserNotification(db, {
    playerId: user.playerId,
    type: 'account',
    title: 'Account Details Updated',
    body: `An administrator updated your account: ${auditReason.trim()}`,
  })

  return jsonResponse(200, { ok: true, targetPlayerId: user.playerId, updated: afterDiff })
}

export const onRequestDelete = async ({ request, env, params }: PagesContext): Promise<Response> => {
  const auth = await requireUsersAdmin(request, env)
  if (!auth.ok) return auth.response

  const db = drizzle(env.NIXLABS_DB)
  const idParam = params.id
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

  if (!user) return badRequest('User not found')

  const body = (await readJsonBody(request)) as any
  const { confirmationUsername, reason } = body || {}

  if (!confirmationUsername || confirmationUsername.toLowerCase() !== user.username.toLowerCase()) {
    return badRequest(`Confirmation failed. You must provide the exact username '${user.username}' to proceed with immediate deletion.`)
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
    return badRequest('An audit reason is strictly required for account deletion')
  }

  // Log audit FIRST before purging
  await writeAudit(db, {
    actorPlayerId: auth.user.playerId,
    action: 'user.delete_immediate',
    targetType: 'user',
    targetId: user.playerId,
    reason: reason.trim(),
    metadata: {
      deletedUsername: user.username,
      snowflakeId: user.snowflakeId,
      registeredOn: user.createdOn,
    },
  })

  // Cascade cleanup
  await Promise.all([
    db.delete(sessions).where(eq(sessions.playerId, user.playerId)),
    db.delete(userNotifications).where(eq(userNotifications.playerId, user.playerId)),
    db.delete(userDismissables).where(eq(userDismissables.playerId, user.playerId)),
    db.delete(staffNotes).where(eq(staffNotes.targetPlayerId, user.playerId)),
    db.delete(moderationActions).where(eq(moderationActions.targetPlayerId, user.playerId)),
  ])

  // Delete user record
  await db.delete(users).where(eq(users.playerId, user.playerId))

  return jsonResponse(200, { ok: true, deletedPlayerId: user.playerId, username: user.username })
}
