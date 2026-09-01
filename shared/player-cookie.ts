/**
 * Identity plumbing shared by the Pages Function, the Vite dev stand-in and the
 * browser: the cookie that anchors an anonymous player, the headers that carry
 * the fallbacks, and the sync code that stitches two devices together.
 *
 * No storage primitives live here - this file only knows how the signals look
 * on the wire, so every implementation reads and writes them the same way.
 */

/** The primary anchor. httpOnly, so client JS cannot read or lose it. */
export const PLAYER_COOKIE_NAME = 'player_id' as const
export const PLAYER_COOKIE_MAX_AGE_SECONDS = 31_536_000

/** Fallback 1: the id this browser kept in localStorage from a previous visit. */
export const PLAYER_ID_HEADER = 'x-player-id' as const
/** Fallback 2: a hash of the device, for when storage is gone entirely. */
export const PLAYER_FINGERPRINT_HEADER = 'x-player-fingerprint' as const

/** 8-64 url-safe characters: what `crypto.randomUUID()` produces, at minimum. */
const PLAYER_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/

export const isPlayerId = (value: unknown): value is string =>
  typeof value === 'string' && PLAYER_ID_PATTERN.test(value)

/**
 * A device hash is a client-computed string, so it gets the same shape check as
 * an id before it is ever used as a lookup key: bounded, and nothing that could
 * break out of a header or a log line.
 */
export const isFingerprint = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9._:-]{6,128}$/.test(value)

/** One cookie out of a `Cookie:` header, without a parser dependency. */
export function readCookie(headerValue: string | null, name: string): string | null {
  if (headerValue === null) {
    return null
  }
  for (const part of headerValue.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) {
      continue
    }
    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim()
      return value.length > 0 ? value : null
    }
  }
  return null
}

/**
 * One year, path-wide, same-site only, unreadable from JS. `Strict` costs
 * nothing here because every request that needs it is same-origin.
 */
export function serializePlayerCookie(id: string): string {
  return [
    `${PLAYER_COOKIE_NAME}=${id}`,
    `Max-Age=${PLAYER_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ].join('; ')
}

/**
 * A sync code is typed by a human, on a phone, from memory. So: 8 characters,
 * a dash in the middle, and no glyph that reads like another one - no O/0,
 * no I/1. `random` is injected so the generator is testable and dependency
 * free in every runtime.
 */
export const SYNC_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' as const
const SYNC_CODE_GROUPS = [4, 4] as const

export function mintSyncCode(random: () => number): string {
  const groups = SYNC_CODE_GROUPS.map((length) => {
    let group = ''
    for (let index = 0; index < length; index += 1) {
      const pick = Math.min(SYNC_CODE_ALPHABET.length - 1, Math.floor(random() * SYNC_CODE_ALPHABET.length))
      group += SYNC_CODE_ALPHABET.charAt(pick)
    }
    return group
  })
  return groups.join('-')
}

/** Uppercases, accepts a missing dash, rejects anything that is not a code. */
export function parseSyncCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const cleaned = value.toUpperCase().replace(/[\s_-]/g, '')
  if (cleaned.length !== SYNC_CODE_GROUPS.reduce((total, length) => total + length, 0)) {
    return null
  }
  for (const character of cleaned) {
    if (!SYNC_CODE_ALPHABET.includes(character)) {
      return null
    }
  }
  return `${cleaned.slice(0, SYNC_CODE_GROUPS[0])}-${cleaned.slice(SYNC_CODE_GROUPS[0])}`
}

/**
 * `crypto.randomUUID()` where it exists, a monotone-enough fallback where not.
 * Typed through a local shape because `shared/` is compiled for the browser,
 * the Worker and Vite's Node process, and only two of those declare `crypto`.
 */
interface UuidSource {
  readonly randomUUID?: () => string
}

export function randomUuid(): string {
  const source: UuidSource | undefined = (globalThis as { readonly crypto?: UuidSource }).crypto
  const uuid = source?.randomUUID?.()
  if (typeof uuid === 'string') {
    return uuid
  }
  const random = () => Math.random()
  return [randomSegment(random, 8), randomSegment(random, 4), randomSegment(random, 12)].join('-')
}

const randomSegment = (random: () => number, length: number): string => {
  let out = ''
  for (let index = 0; index < length; index += 1) {
    out += Math.floor(random() * 16).toString(16)
  }
  return out
}
