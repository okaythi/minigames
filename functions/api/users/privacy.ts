import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, userPrivacySettings } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  const settings = await db
    .select()
    .from(userPrivacySettings)
    .where(eq(userPrivacySettings.playerId, playerId))
    .get()

  return jsonResponse(200, {
    ok: true,
    privacy: {
      hideFriends: settings ? settings.hideFriends === 1 : false,
      showOnline: settings ? settings.showOnline === 1 : true,
    },
  })
}

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  const body = (await readJsonBody(request)) as { hideFriends?: boolean; showOnline?: boolean } | null
  if (!body || typeof body !== 'object') {
    return badRequest('invalid payload')
  }

  const hideFriendsInt = body.hideFriends ? 1 : 0
  const showOnlineInt = body.showOnline !== false ? 1 : 0

  const existing = await db
    .select()
    .from(userPrivacySettings)
    .where(eq(userPrivacySettings.playerId, playerId))
    .get()

  if (existing) {
    await db
      .update(userPrivacySettings)
      .set({ hideFriends: hideFriendsInt, showOnline: showOnlineInt })
      .where(eq(userPrivacySettings.playerId, playerId))
      .run()
  } else {
    await db
      .insert(userPrivacySettings)
      .values({
        playerId,
        hideFriends: hideFriendsInt,
        showOnline: showOnlineInt,
      })
      .run()
  }

  return jsonResponse(200, {
    ok: true,
    privacy: {
      hideFriends: hideFriendsInt === 1,
      showOnline: showOnlineInt === 1,
    },
  })
}
