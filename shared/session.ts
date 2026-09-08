import { eq, and, isNull } from 'drizzle-orm'
import type { DrizzleD1Database } from 'drizzle-orm/d1'
import { sessions, users } from '../src/db/schema'
import { readCookie, PLAYER_COOKIE_NAME } from './player-cookie'

export const SESSION_COOKIE_NAME = 'session_token' as const
export const SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export interface SessionMeta {
  readonly userAgent?: string | undefined
  readonly ipHash?: string | undefined
}

/**
 * Creates an opaque SHA-256 hash of a client IP address for privacy-conscious session audit.
 */
export async function hashIp(ip: string | null | undefined): Promise<string | undefined> {
  if (!ip) return undefined
  try {
    const encoder = new TextEncoder()
    const data = encoder.encode(ip)
    const hashBuffer = await crypto.subtle.digest('SHA-256', data)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return undefined
  }
}

/**
 * Extracts metadata from a request for session logging.
 */
export async function extractSessionMeta(request: Request): Promise<SessionMeta> {
  const userAgent = request.headers.get('user-agent') || undefined
  const rawIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || undefined
  const ipHash = await hashIp(rawIp)
  return { userAgent, ipHash }
}

/**
 * Serializes a session token into an HttpOnly, SameSite=Strict cookie header string.
 */
export function serializeSessionCookie(token: string, maxAge = SESSION_COOKIE_MAX_AGE_SECONDS): string {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Max-Age=${maxAge}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ')
}

/**
 * Returns a Set-Cookie value that immediately expires the session cookie.
 */
export function serializeClearSessionCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Strict`
}

/**
 * Creates a new active session record in the D1 database.
 */
export async function createSession(
  db: DrizzleD1Database,
  playerId: string,
  meta: SessionMeta = {},
): Promise<string> {
  const token = crypto.randomUUID()
  const now = Date.now()
  await db.insert(sessions).values({
    token,
    playerId,
    createdAt: now,
    expiresAt: now + SESSION_COOKIE_MAX_AGE_SECONDS * 1000,
    userAgent: meta.userAgent,
    ipHash: meta.ipHash,
  })
  return token
}

export type SessionStatus = 'valid' | 'revoked' | 'expired' | 'missing' | 'locked'

export interface DetailedSessionResult {
  readonly status: SessionStatus
  readonly playerId: string | null
  readonly token: string | null
}

/**
 * Detailed session evaluation: differentiates between valid, revoked, expired, locked, and missing.
 */
export async function identifySessionDetailed(
  request: Request,
  db: DrizzleD1Database,
): Promise<DetailedSessionResult> {
  try {
    const cookieHeader = request.headers.get('cookie')
    const token = readCookie(cookieHeader, SESSION_COOKIE_NAME)

    if (token) {
      const session = await db.select().from(sessions).where(eq(sessions.token, token)).get()
      if (!session) {
        return { status: 'missing', playerId: null, token }
      }
      if (session.revokedAt !== null) {
        return { status: 'revoked', playerId: session.playerId, token }
      }
      if (session.expiresAt < Date.now()) {
        return { status: 'expired', playerId: session.playerId, token }
      }

      const user = await db.select().from(users).where(eq(users.playerId, session.playerId)).get()
      if (!user || user.accountLocked === 1) {
        return { status: 'locked', playerId: session.playerId, token }
      }

      return { status: 'valid', playerId: session.playerId, token }
    }

    // Grace fallback for legacy logged-in users
    const legacyPlayerId = readCookie(cookieHeader, PLAYER_COOKIE_NAME)
    if (legacyPlayerId) {
      const user = await db.select().from(users).where(eq(users.playerId, legacyPlayerId)).get()
      if (user && user.accountLocked !== 1) {
        return { status: 'valid', playerId: user.playerId, token: null }
      }
      if (user && user.accountLocked === 1) {
        return { status: 'locked', playerId: user.playerId, token: null }
      }
    }

    return { status: 'missing', playerId: null, token: null }
  } catch (err) {
    console.error('[identifySessionDetailed] database error:', err)
    return { status: 'missing', playerId: null, token: null }
  }
}

/**
 * Identifies the current player from session cookies.
 */
export async function identifySession(
  request: Request,
  db: DrizzleD1Database,
): Promise<string | null> {
  const res = await identifySessionDetailed(request, db)
  return res.status === 'valid' ? res.playerId : null
}

/**
 * Revokes a specific session by token.
 */
export async function revokeSession(db: DrizzleD1Database, token: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: Date.now() })
    .where(eq(sessions.token, token))
}

/**
 * Force-logouts all active sessions for a target user.
 */
export async function revokeAllUserSessions(
  db: DrizzleD1Database,
  playerId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: Date.now() })
    .where(and(eq(sessions.playerId, playerId), isNull(sessions.revokedAt)))
}
