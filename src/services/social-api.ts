import type { FriendSummary, DirectMessage, PrivacySettings, ConversationSummary } from '../../shared/auth-protocol'

export async function getFriends(username?: string): Promise<{
  ok: boolean
  hidden: boolean
  friends: FriendSummary[]
  friendsCount: number
}> {
  const url = username ? `/api/friends?username=${encodeURIComponent(username)}` : '/api/friends'
  const res = await fetch(url)
  if (!res.ok) {
    return { ok: false, hidden: false, friends: [], friendsCount: 0 }
  }
  return res.json()
}

export async function getMyFriends(): Promise<{
  ok: boolean
  friends: FriendSummary[]
  pendingIncoming: FriendSummary[]
  pendingOutgoing: FriendSummary[]
}> {
  const res = await fetch('/api/friends')
  if (!res.ok) {
    return { ok: false, friends: [], pendingIncoming: [], pendingOutgoing: [] }
  }
  return res.json()
}

export async function sendFriendAction(
  targetUsername: string,
  action: 'send' | 'accept' | 'decline' | 'remove' | 'block',
): Promise<{ ok: boolean; status?: string; error?: string }> {
  const res = await fetch('/api/friends/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetUsername, action }),
  })
  return res.json()
}

export async function getPrivacySettings(): Promise<PrivacySettings> {
  const res = await fetch('/api/users/privacy')
  if (!res.ok) {
    return { hideFriends: false, showOnline: true }
  }
  const data = await res.json()
  return data.privacy ?? { hideFriends: false, showOnline: true }
}

export async function updatePrivacySettings(settings: Partial<PrivacySettings>): Promise<PrivacySettings> {
  const res = await fetch('/api/users/privacy', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error('Failed to update privacy settings')
  const data = await res.json()
  return data.privacy
}

export async function getConversations(): Promise<ConversationSummary[]> {
  const res = await fetch('/api/messages')
  if (!res.ok) return []
  const data = await res.json()
  return data.conversations ?? []
}

export async function getMessages(recipientUsername: string): Promise<DirectMessage[]> {
  const res = await fetch(`/api/messages?recipient=${encodeURIComponent(recipientUsername)}`)
  if (!res.ok) return []
  const data = await res.json()
  return data.messages ?? []
}

export async function sendMessage(
  recipientUsername: string,
  content: string,
  messageType: 'text' | 'challenge' = 'text',
  challengeData?: { gameSlug: string; targetScore: number; bountyCandy?: number },
): Promise<{ ok: boolean; message?: DirectMessage; error?: string; cooldown?: number }> {
  const res = await fetch('/api/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipientUsername, content, messageType, challengeData }),
  })
  return res.json()
}

export async function getChallenge(id: string): Promise<any> {
  const res = await fetch(`/api/challenges/resolve?id=${encodeURIComponent(id)}`)
  if (!res.ok) return null
  const data = await res.json()
  return data.challenge ?? null
}

export async function resolveChallenge(
  challengeId: string,
  finalScore: number,
): Promise<{ ok: boolean; won: boolean; bountyWon?: number }> {
  const res = await fetch('/api/challenges/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId, finalScore }),
  })
  if (!res.ok) return { ok: false, won: false }
  return res.json()
}

export async function pingPresence(
  state: 'online' | 'idle' = 'online',
  slug?: string | null,
  startedAt?: number | null,
): Promise<void> {
  try {
    await fetch('/api/presence/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, slug, startedAt }),
    })
  } catch {
    // Ignore ping errors
  }
}

export function openChat(username?: string) {
  window.dispatchEvent(new CustomEvent('nx-open-chat', { detail: { username } }))
}

