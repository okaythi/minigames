import type {
  UserLoginPayload,
  UserRegisterPayload,
  UserProfileUpdatePayload,
  UserProfileResponse,
  UserPublicProfileResponse,
} from '../../shared/auth-protocol'
import { UserFlags, hasFlag } from '../../shared/flags'
import { resetLocalCounters } from './stats/local-counters'

let cachedCurrentUser: UserProfileResponse | null = null
const authListeners = new Set<() => void>()

function setCachedUser(user: UserProfileResponse | null) {
  const prev = cachedCurrentUser
  cachedCurrentUser = user
  if (
    (prev === null && user === null) ||
    (prev !== null &&
      user !== null &&
      prev.username === user.username &&
      prev.nickname === user.nickname &&
      prev.pfpUrl === user.pfpUrl &&
      prev.flags === user.flags)
  ) {
    return
  }
  for (const listener of authListeners) {
    listener()
  }
}

export function getCurrentUser(): UserProfileResponse | null {
  return cachedCurrentUser
}

export function isCurrentDeveloper(): boolean {
  if (!cachedCurrentUser) return false
  return hasFlag(cachedCurrentUser.flags, UserFlags.USER_DEVELOPER) || cachedCurrentUser.developer === true
}

export function isStaff(): boolean {
  if (!cachedCurrentUser) return false
  return hasFlag(cachedCurrentUser.flags, UserFlags.STAFF)
}

export function isCmsEditor(): boolean {
  if (!cachedCurrentUser) return false
  return (
    hasFlag(cachedCurrentUser.flags, UserFlags.STAFF) &&
    hasFlag(cachedCurrentUser.flags, UserFlags.CMS_EDITOR)
  )
}



export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export async function login(payload: UserLoginPayload) {
  resetLocalCounters()
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  void getMe()
  return data
}

export async function register(payload: UserRegisterPayload) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  const data = await res.json()
  void getMe()
  return data
}

export async function logout() {
  setCachedUser(null)
  resetLocalCounters()
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.reload()
}

let getMePromise: Promise<UserProfileResponse | null> | null = null
let lastMeFetchTime = 0
const MIN_GET_ME_INTERVAL_MS = 2000

export async function getMe(force = false): Promise<UserProfileResponse | null> {
  const now = Date.now()
  if (!force && cachedCurrentUser && now - lastMeFetchTime < MIN_GET_ME_INTERVAL_MS) {
    return cachedCurrentUser
  }
  if (getMePromise) return getMePromise

  getMePromise = (async () => {
    try {
      lastMeFetchTime = Date.now()
      const res = await fetch('/api/users/me')
      if (!res.ok) {
        setCachedUser(null)
        return null
      }
      const data = await res.json()
      const profile = data.profile ?? null
      setCachedUser(profile)
      return profile
    } catch {
      setCachedUser(null)
      return null
    } finally {
      getMePromise = null
    }
  })()

  return getMePromise
}

// Preload user in browser context
if (typeof window !== 'undefined') {
  void getMe()
}

const publicProfileCache = new Map<string, {
  value: UserPublicProfileResponse | null
  at: number
  inflight?: Promise<UserPublicProfileResponse | null>
}>()
const PUBLIC_PROFILE_TTL_MS = 60_000

export function invalidatePublicProfileCache(username: string): void {
  publicProfileCache.delete(username.toLowerCase())
}

/**
 * Public profiles change rarely; every author byline on the updates page and
 * every profile visit would otherwise re-fetch the same user. Short TTL +
 * single-flight keeps the UI identical while collapsing duplicate requests.
 */
export async function getPublicProfile(username: string): Promise<UserPublicProfileResponse | null> {
  const key = username.toLowerCase()
  const hit = publicProfileCache.get(key)
  if (hit) {
    if (hit.inflight) return hit.inflight
    if (Date.now() - hit.at < PUBLIC_PROFILE_TTL_MS) return hit.value
  }

  const slot = { value: hit?.value ?? null, at: hit?.at ?? 0 }
  const inflight = (async (): Promise<UserPublicProfileResponse | null> => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`)
      if (!res.ok) return null
      const data = await res.json()
      const profile = (data.profile as UserPublicProfileResponse | null) ?? null
      publicProfileCache.set(key, { value: profile, at: Date.now() })
      return profile
    } finally {
      const current = publicProfileCache.get(key)
      if (current && current.inflight) delete current.inflight
    }
  })()
  publicProfileCache.set(key, { ...slot, inflight })
  return inflight
}

export async function updateNickname(payload: UserProfileUpdatePayload) {
  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  if (cachedCurrentUser) {
    invalidatePublicProfileCache(cachedCurrentUser.username)
  }
  return res.json()
}

export async function updatePfp(file: File) {
  const res = await fetch('/api/users/me', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'Content-Length': String(file.size),
    },
    body: file,
  })
  if (!res.ok) throw new Error(await res.text())
  if (cachedCurrentUser) {
    invalidatePublicProfileCache(cachedCurrentUser.username)
  }
  return res.json()
}

