import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users } from '../../../src/db/schema'
import { UserProfileUpdateSchema } from '../../../shared/auth-protocol'
import { parseFlags, hasFlag, UserFlags } from '../../../shared/flags'
import { toDisplayId } from '../../../shared/snowflake'
import { identifySessionDetailed, serializeClearSessionCookie } from '../../../shared/session'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import type { StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database; ASSETS_BUCKET: R2Bucket }
}

type AuthResolveResult =
  | { readonly ok: true; readonly playerId: string }
  | { readonly ok: false; readonly response: Response }

async function resolveSessionUser(
  request: Request,
  env: PagesContext['env'],
): Promise<AuthResolveResult> {
  try {
    const db = drizzle(env.NIXLABS_DB)
    const sessionDetail = await identifySessionDetailed(request, db)

    if (sessionDetail.status === 'revoked') {
      return {
        ok: false,
        response: jsonResponse(
          401,
          { ok: false, error: 'Session revoked', sessionRevoked: true },
          { cookie: serializeClearSessionCookie() },
        ),
      }
    }

    if (sessionDetail.status === 'expired') {
      return {
        ok: false,
        response: jsonResponse(
          401,
          { ok: false, error: 'Session expired', sessionRevoked: true },
          { cookie: serializeClearSessionCookie() },
        ),
      }
    }

    if (sessionDetail.status === 'locked') {
      return {
        ok: false,
        response: jsonResponse(
          403,
          { ok: false, error: 'Account suspended or locked', sessionRevoked: true },
          { cookie: serializeClearSessionCookie() },
        ),
      }
    }

    if (sessionDetail.status !== 'valid' || !sessionDetail.playerId) {
      return {
        ok: false,
        response: jsonResponse(
          401,
          { ok: false, error: 'Unauthorized: active session required' },
          { cookie: serializeClearSessionCookie() },
        ),
      }
    }

    return { ok: true, playerId: sessionDetail.playerId }
  } catch (err) {
    console.error('[users/me resolveSessionUser] error:', err)
    return {
      ok: false,
      response: jsonResponse(500, { ok: false, error: 'Failed to verify session' }),
    }
  }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  try {
    const auth = await resolveSessionUser(request, env)
    if (!auth.ok) return auth.response
    const playerId = auth.playerId

    const db = drizzle(env.NIXLABS_DB)
    const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()

    if (!user || user.accountLocked === 1) {
      return jsonResponse(
        401,
        { ok: false, error: 'Unauthorized: user account invalid or locked', sessionRevoked: true },
        { cookie: serializeClearSessionCookie() },
      )
    }

    const flags = parseFlags(user.flags)

    return jsonResponse(200, {
      ok: true,
      profile: {
        username: user.username,
        nickname: user.nickname,
        pfpUrl: user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null,
        legacyUser: hasFlag(flags, UserFlags.USER_PIONEER) || user.legacyUser === 1,
        developer: hasFlag(flags, UserFlags.USER_DEVELOPER) || user.developer === 1,
        flags,
        nicknameChangedCount: user.nicknameChangedCount,
        createdOn: user.createdOn,
        snowflakeId: user.snowflakeId ?? null,
        displaySnowflakeId: user.snowflakeId ? toDisplayId(user.snowflakeId) : null,
      },
    })
  } catch (err: any) {
    console.error('[users/me onRequestGet] error:', err)
    return jsonResponse(500, { ok: false, error: err?.message || 'Failed to fetch user profile' })
  }
}

export const onRequestPut = async ({ request, env }: PagesContext): Promise<Response> => {
  const auth = await resolveSessionUser(request, env)
  if (!auth.ok) return auth.response
  const playerId = auth.playerId

  const json = await readJsonBody(request)
  const result = UserProfileUpdateSchema.safeParse(json)
  if (!result.success) {
    return badRequest('invalid payload')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user || user.accountLocked === 1) {
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
  const auth = await resolveSessionUser(request, env)
  if (!auth.ok) return auth.response
  const playerId = auth.playerId

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
