import { drizzle } from 'drizzle-orm/d1'
import { eq, or, and, inArray } from 'drizzle-orm'
import { users, friendships, userPresence, userPrivacySettings } from '../../../src/db/schema'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import type { FriendSummary } from '../../../shared/auth-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

function resolvePresence(
  row: { lastActiveAt: number; state: string; gameSlug: string | null; gameStartedAt: number | null } | undefined,
  showOnline: boolean,
  nowSeconds: number,
) {
  if (!row || !showOnline) {
    return {
      state: 'offline' as const,
      gameSlug: null,
      gameStartedAt: null,
      lastActiveAt: row ? row.lastActiveAt : 0,
    }
  }

  const diff = nowSeconds - row.lastActiveAt
  let state: 'online' | 'idle' | 'offline' = 'offline'

  if (diff < 45) {
    state = row.state === 'idle' ? 'idle' : 'online'
  } else if (diff < 165) {
    state = 'idle'
  }

  return {
    state,
    gameSlug: state !== 'offline' ? row.gameSlug : null,
    gameStartedAt: state !== 'offline' ? row.gameStartedAt : null,
    lastActiveAt: row.lastActiveAt,
  }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const url = new URL(request.url)
  const usernameParam = url.searchParams.get('username')?.toLowerCase()
  const db = drizzle(env.NIXLABS_DB)
  const store = storeFor(env)
  const { playerId: viewerPlayerId } = await identifyPlayer(request, store)
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (usernameParam) {
    const targetUser = await db.select().from(users).where(eq(users.username, usernameParam)).get()
    if (!targetUser) {
      return badRequest('user not found')
    }

    const isOwner = viewerPlayerId === targetUser.playerId

    const privacy = await db
      .select()
      .from(userPrivacySettings)
      .where(eq(userPrivacySettings.playerId, targetUser.playerId))
      .get()

    if (privacy?.hideFriends === 1 && !isOwner) {
      return jsonResponse(200, {
        ok: true,
        hidden: true,
        friends: [],
        friendsCount: 0,
      })
    }

    const acceptedRows = await db
      .select()
      .from(friendships)
      .where(
        and(
          eq(friendships.status, 'accepted'),
          or(eq(friendships.requesterId, targetUser.playerId), eq(friendships.addresseeId, targetUser.playerId)),
        ),
      )
      .all()

    const friendPlayerIds = acceptedRows.map((r) =>
      r.requesterId === targetUser.playerId ? r.addresseeId : r.requesterId,
    )

    if (friendPlayerIds.length === 0) {
      return jsonResponse(200, {
        ok: true,
        hidden: false,
        friends: [],
        friendsCount: 0,
      })
    }

    const [friendUsers, friendPresences, friendPrivacies] = await Promise.all([
      db.select().from(users).where(inArray(users.playerId, friendPlayerIds)).all(),
      db.select().from(userPresence).where(inArray(userPresence.playerId, friendPlayerIds)).all(),
      db.select().from(userPrivacySettings).where(inArray(userPrivacySettings.playerId, friendPlayerIds)).all(),
    ])

    const presenceMap = new Map<string, typeof friendPresences[number]>()
    for (const p of friendPresences) {
      presenceMap.set(p.playerId, p)
    }

    const privacyMap = new Map<string, typeof friendPrivacies[number]>()
    for (const pr of friendPrivacies) {
      privacyMap.set(pr.playerId, pr)
    }

    const friends: FriendSummary[] = friendUsers.map((u) => {
      const userPrivacy = privacyMap.get(u.playerId)
      const showOnline = userPrivacy ? userPrivacy.showOnline === 1 : true
      const p = presenceMap.get(u.playerId)

      return {
        username: u.username,
        nickname: u.nickname,
        pfpUrl: u.pfpR2Key ? `/api/assets/pfp/${u.pfpR2Key}` : null,
        flags: u.flags,
        presence: resolvePresence(p, showOnline, nowSeconds),
      }
    })

    return jsonResponse(200, {
      ok: true,
      hidden: false,
      friends,
      friendsCount: friends.length,
    })
  }

  if (!viewerPlayerId) {
    return badRequest('unauthorized')
  }

  const currentUser = await db.select().from(users).where(eq(users.playerId, viewerPlayerId)).get()
  if (!currentUser) {
    return badRequest('unauthorized')
  }

  const allRelationships = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, viewerPlayerId), eq(friendships.addresseeId, viewerPlayerId)))
    .all()

  const accepted = allRelationships.filter((r) => r.status === 'accepted')
  const pendingIncoming = allRelationships.filter((r) => r.status === 'pending' && r.addresseeId === viewerPlayerId)
  const pendingOutgoing = allRelationships.filter((r) => r.status === 'pending' && r.requesterId === viewerPlayerId)

  const relevantIds = [
    ...new Set([
      ...accepted.map((r) => (r.requesterId === viewerPlayerId ? r.addresseeId : r.requesterId)),
      ...pendingIncoming.map((r) => r.requesterId),
      ...pendingOutgoing.map((r) => r.addresseeId),
    ]),
  ]

  let userMap = new Map<string, typeof currentUser>()
  let presenceMap = new Map<string, any>()
  let privacyMap = new Map<string, any>()

  if (relevantIds.length > 0) {
    const [uRows, pRows, prRows] = await Promise.all([
      db.select().from(users).where(inArray(users.playerId, relevantIds)).all(),
      db.select().from(userPresence).where(inArray(userPresence.playerId, relevantIds)).all(),
      db.select().from(userPrivacySettings).where(inArray(userPrivacySettings.playerId, relevantIds)).all(),
    ])
    for (const u of uRows) userMap.set(u.playerId, u)
    for (const p of pRows) presenceMap.set(p.playerId, p)
    for (const pr of prRows) privacyMap.set(pr.playerId, pr)
  }

  const buildSummary = (pId: string): FriendSummary | null => {
    const u = userMap.get(pId)
    if (!u) return null
    const pr = privacyMap.get(pId)
    const showOnline = pr ? pr.showOnline === 1 : true
    const p = presenceMap.get(pId)
    return {
      username: u.username,
      nickname: u.nickname,
      pfpUrl: u.pfpR2Key ? `/api/assets/pfp/${u.pfpR2Key}` : null,
      flags: u.flags,
      presence: resolvePresence(p, showOnline, nowSeconds),
    }
  }

  return jsonResponse(200, {
    ok: true,
    friends: accepted.map((r) => buildSummary(r.requesterId === viewerPlayerId ? r.addresseeId : r.requesterId)).filter(Boolean),
    pendingIncoming: pendingIncoming.map((r) => buildSummary(r.requesterId)).filter(Boolean),
    pendingOutgoing: pendingOutgoing.map((r) => buildSummary(r.addresseeId)).filter(Boolean),
  })
}
