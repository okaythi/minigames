import type {
  UserLoginPayload,
  UserRegisterPayload,
  UserProfileUpdatePayload,
  UserProfileResponse,
  UserPublicProfileResponse,
} from '../../shared/auth-protocol'

let cachedCurrentUser: UserProfileResponse | null = null
const authListeners = new Set<() => void>()

function setCachedUser(user: UserProfileResponse | null) {
  cachedCurrentUser = user
  for (const listener of authListeners) {
    listener()
  }
}

export function getCurrentUser(): UserProfileResponse | null {
  return cachedCurrentUser
}

export function isCurrentDeveloper(): boolean {
  return cachedCurrentUser?.developer === true
}

export function subscribeAuth(listener: () => void): () => void {
  authListeners.add(listener)
  return () => {
    authListeners.delete(listener)
  }
}

export async function login(payload: UserLoginPayload) {
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
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.reload()
}

export async function getMe(): Promise<UserProfileResponse | null> {
  const res = await fetch('/api/users/me')
  if (!res.ok) {
    setCachedUser(null)
    return null
  }
  const data = await res.json()
  const profile = data.profile ?? null
  setCachedUser(profile)
  return profile
}

// Preload user in browser context
if (typeof window !== 'undefined') {
  void getMe()
}

export async function updateNickname(payload: UserProfileUpdatePayload) {
  const res = await fetch('/api/users/me', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
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
  return res.json()
}

export async function getPublicProfile(username: string): Promise<UserPublicProfileResponse | null> {
  const res = await fetch(`/api/users/${username}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.profile
}

