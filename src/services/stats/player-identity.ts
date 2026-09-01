import { localStore } from '../storage/local-store'

/**
 * Anonymous visitor identity. One uuid, minted once per browser, kept in
 * localStorage: it is what makes "unique players" a count of people rather
 * than a count of page views. Nothing personal is stored, and the id never
 * leaves the site.
 */

const KEY = 'player.id'

const createId = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid !== undefined) {
    return uuid
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

let cached: string | null = null

export function playerId(): string {
  if (cached !== null) {
    return cached
  }
  const stored = localStore.read<string>(KEY, '')
  if (typeof stored === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(stored)) {
    cached = stored
    return cached
  }
  const fresh = createId()
  localStore.write(KEY, fresh)
  cached = fresh
  return cached
}

let visitAnnounced = false

/** True at most once per page load, so a re-render cannot spam the endpoint. */
export function claimVisitAnnouncement(): boolean {
  if (visitAnnounced) {
    return false
  }
  visitAnnounced = true
  return true
}
