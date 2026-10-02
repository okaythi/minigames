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
  /** Immutable account id; absent on tokens minted before accounts added it. */
  uid?: string
  role: string
  auth: boolean
  exp: number
}

export async function verifyNixlabsToken(token: string, secret: string): Promise<NixlabsSessionPayload | null> {
  if (!secret || !secret.trim()) return null

  const parts = token.split('.')
  if (parts.length !== 2) return null

  const [b64Data, b64Sig] = parts
  if (!b64Data || !b64Sig) return null

  try {
    const rawData = atob(b64Data)
    const sigBytes = Uint8Array.from(atob(b64Sig), (c) => c.charCodeAt(0))
    const key = await crypto.subtle.importKey(
      'raw',
      ENCODER.encode(secret.trim()), // accounts.nixlabs.tech signs with the trimmed secret
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
  // Without the shared secret, ecosystem sessions cannot be verified: SSO is off.
  if (!secret || !secret.trim()) return null

  const cookieHeader = request.headers.get('cookie')
  const nixlabsToken = readCookie(cookieHeader, '_nixlabs_session')
  if (!nixlabsToken) return null

  const payload = await verifyNixlabsToken(nixlabsToken, secret)
  if (!payload || !payload.sub) return null

  const username = payload.sub.toLowerCase()
  const uid = typeof payload.uid === 'string' && payload.uid ? payload.uid : null

  // 1. Players already linked to the account survive username changes.
  if (uid) {
    const linked = await db.select().from(users).where(eq(users.nixlabsUid, uid)).get()
    if (linked) return linked.playerId
  }

  const user = await db.select().from(users).where(eq(users.username, username)).get()

  if (user) {
    // Never sign an ecosystem account into a local minigames account (one with
    // its own password) or an SSO player linked to a different account.
    if (user.passwordHash !== 'sso_managed') return null
    if (user.nixlabsUid && user.nixlabsUid !== uid) return null
    // 2. Link a pre-uid SSO player on first sight.
    if (uid && !user.nixlabsUid) {
      await db.update(users).set({ nixlabsUid: uid }).where(eq(users.playerId, user.playerId))
    }
    return user.playerId
  }

  // 3. First visit: create an SSO player linked to the account.
  const newPlayerId = crypto.randomUUID()
  const now = Math.floor(Date.now() / 1000)

  await db.insert(players).values({
    id: newPlayerId,
    firstSeen: now,
    lastSeen: now,
    candy: 500,
  })

  const isAdmin = payload.role === 'ADMIN'

  const assignedFlags = isAdmin
    ? UserFlags.USER_DEVELOPER |
      UserFlags.USER_PIONEER |
      UserFlags.STAFF |
      UserFlags.USERS_ADMIN |
      UserFlags.GAMES_ADMIN |
      UserFlags.PLATFORM_ADMIN
    : UserFlags.USER_PIONEER

  await db.insert(users).values({
    playerId: newPlayerId,
    username,
    nickname: payload.sub,
    passwordHash: 'sso_managed',
    passwordSalt: 'sso_salt',
    nixlabsUid: uid,
    createdOn: now,
    lastLoggedIn: now,
    developer: isAdmin ? 1 : 0,
    flags: assignedFlags,
  })

  return newPlayerId
}
