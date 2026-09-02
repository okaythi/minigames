import type { UserLoginPayload, UserRegisterPayload, UserProfileUpdatePayload, UserProfileResponse } from '../../shared/auth-protocol'

export async function login(payload: UserLoginPayload) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function register(payload: UserRegisterPayload) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export async function logout() {
  await fetch('/api/auth/logout', { method: 'POST' })
  window.location.reload()
}

export async function getMe(): Promise<UserProfileResponse | null> {
  const res = await fetch('/api/users/me')
  if (!res.ok) return null
  const data = await res.json()
  return data.profile
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

export async function getPublicProfile(username: string): Promise<UserProfileResponse | null> {
  const res = await fetch(`/api/users/${username}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.profile
}
