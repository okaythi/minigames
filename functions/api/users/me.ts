import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { UserProfileUpdateSchema } from '../../../shared/auth-protocol'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database; ASSETS_BUCKET: R2Bucket }
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

  return jsonResponse(200, {
    ok: true,
    profile: {
      username: user.username,
      nickname: user.nickname,
      pfpUrl: user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null,
      legacyUser: user.legacyUser === 1,
      developer: user.developer === 1,
      nicknameChangedCount: user.nicknameChangedCount,
      createdOn: user.createdOn,
    },
  })
}

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const json = await readJsonBody(request)
  const result = UserProfileUpdateSchema.safeParse(json)
  if (!result.success) {
    return badRequest('invalid payload')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  if (user.nicknameChangedCount >= 1) {
    return badRequest('nickname can only be changed once')
  }

  await db.update(users).set({
    nickname: result.data.nickname,
    nicknameChangedCount: user.nicknameChangedCount + 1,
  }).where(eq(users.playerId, playerId))

  return jsonResponse(200, { ok: true })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const contentType = request.headers.get('content-type') || ''
  if (!contentType.includes('image/')) {
    return badRequest('must be an image')
  }
  if (!['image/jpeg', 'image/png', 'image/gif'].includes(contentType)) {
    return badRequest('unsupported image format (jpeg, png, gif allowed)')
  }

  const contentLength = Number(request.headers.get('content-length') || 0)
  if (contentLength > 6 * 1024 * 1024) {
    return badRequest('image too large (6MB max)')
  }

  const body = await request.arrayBuffer()
  if (body.byteLength > 6 * 1024 * 1024) {
    return badRequest('image too large (6MB max)')
  }

  const key = crypto.randomUUID()
  await env.ASSETS_BUCKET.put(key, body as any, {
    httpMetadata: { contentType },
  })

  const db = drizzle(env.NIXLABS_DB)
  await db.update(users).set({ pfpR2Key: key }).where(eq(users.playerId, playerId))

  return jsonResponse(200, { ok: true, pfpUrl: `/api/assets/pfp/${key}` })
}
