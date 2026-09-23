/**
 * Nixlabs Ecosystem SSO Session Verifier.
 * Concern: Validates cross-subdomain _nixlabs_session HMAC tokens and maps to local player identity.
 */

import { eq } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { users, players } from '../src/db/schema'
import { readCookie } from './player-cookie'
import { UserFlags } from './flags/types'

const ENCODER = new TextEncoder()

export interface NixlabsSessionPayload {
  sid: string
  sub: string
  role: string
  auth: boolean
  exp: number
}

export async function verifyNixlabsToken(token: string, secret: string): Promise<NixlabsSessionPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [b64Data, b64Sig] = parts
  if (!b64Data || !b64Sig) return null

  try {
    const rawData = atob(b64Data)
    const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      ENCODER.encode(secret || 'default-nixlabs-dev-secret'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    )
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, ENCODER.encode(rawData))
    if (!valid) return null

    const payload = JSON.parse(rawData) as NixlabsSessionPayload
    if (!payload.auth || Date.now() > payload.exp) return null
    return payload
  } catch {
    return null
  }
}

export async function resolveEcosystemPlayer(
  request: Request,
  db: DrizzleD1Database,
  secret?: string
): Promise<string | null> {
  const cookieHeader = request.headers.get('cookie')
  const nixlabsToken = readCookie(cookieHeader, '_nixlabs_session')
  if (!nixlabsToken) return null

  const payload = await verifyNixlabsToken(nixlabsToken, secret || 'default-nixlabs-dev-secret')
  if (!payload || !payload.sub) return null

  const username = payload.sub.toLowerCase()
  let user = await db.select().from(users).where(eq(users.username, username)).get()

  if (!user) {
    const newPlayerId = crypto.randomUUID()
    const now = Math.floor(Date.now() / 1000)

    await db.insert(players).values({
      id: newPlayerId,
      firstSeen: now,
      lastSeen: now,
      candy: 500,
    })

    const allAdminFlags =
      UserFlags.USER_DEVELOPER |
      UserFlags.USER_PIONEER |
      UserFlags.STAFF |
      UserFlags.USERS_ADMIN |
      UserFlags.GAMES_ADMIN |
      UserFlags.PLATFORM_ADMIN

    await db.insert(users).values({
      playerId: newPlayerId,
      username,
      nickname: payload.sub,
      passwordHash: 'sso_managed',
      passwordSalt: 'sso_salt',
      createdOn: now,
      lastLoggedIn: now,
      developer: 1,
      flags: allAdminFlags,
    })

    return newPlayerId
  }

  return user.playerId
}
