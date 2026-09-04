import type { FriendSummary, DirectMessage, PrivacySettings, ConversationSummary } from '../../shared/auth-protocol'

/**
 * Short-lived shared cache for cheap snapshot reads (friends, conversations,
 * public profiles). Multiple surfaces want the same list on the same tick —
 * the notification poller, the DM drawer, the bell, the profile page. Instead
 * of each hitting the edge separately (each hit = 1 Functions invocation),
 * they coalesce into one in-flight request and share its result briefly.
 * Mutating actions invalidate the cache, so freshness is never lost where it
 * matters. GETs of a conversation's messages are intentionally NOT cached.
 */
const SOCIAL_SNAPSHOT_TTL_MS = 10_000

interface CacheSlot<T> {
  value: T
  fetchedAt: number
}

const snapshotCache = new Map<string, CacheSlot<unknown>>()
const snapshotInflight = new Map<string, Promise<unknown>>()

function sharedSnapshot<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const running = snapshotInflight.get(key) as Promise<T> | undefined
  if (running) return running

  const hit = snapshotCache.get(key) as CacheSlot<T> | undefined
  if (hit && Date.now() - hit.fetchedAt < SOCIAL_SNAPSHOT_TTL_MS) {
    return Promise.resolve(hit.value)
  }

  const p = loader()
    .then((value) => {
      snapshotCache.set(key, { value, fetchedAt: Date.now() })
      return value
    })
    .finally(() => {
      snapshotInflight.delete(key)
    })
  snapshotInflight.set(key, p)
  return p
}

export function invalidateSocialCache(): void {
  snapshotCache.clear()
}

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
  return sharedSnapshot('myFriends', async () => {
    const res = await fetch('/api/friends')
    if (!res.ok) {
      return { ok: false, friends: [], pendingIncoming: [], pendingOutgoing: [] }
    }
    return res.json()
  })
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
  if (res.ok) {
    invalidateSocialCache()
  }
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
  const conversations = await sharedSnapshot('conversations', async () => {
    const res = await fetch('/api/messages')
    if (!res.ok) return []
    const data = await res.json()
    return (data.conversations ?? []) as ConversationSummary[]
  })
  return conversations
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
  if (res.ok) {
    invalidateSocialCache()
  }
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

export interface PresencePingResult {
  readonly friendRequests: number
  readonly newMessages: number
}

/**
 * Sends the presence heartbeat. The edge replies with badge counts for free,
 * so a separate notifications poll is unnecessary while nothing changes.
 */
export async function pingPresence(
  state: 'online' | 'idle' = 'online',
  slug?: string | null,
  startedAt?: number | null,
): Promise<PresencePingResult | null> {
  try {
    const res = await fetch('/api/presence/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state, slug, startedAt }),
    })
    if (!res.ok) return null
    const data = (await res.json().catch(() => null)) as
      | { notifications?: { friendRequests?: number; newMessages?: number } }
      | null
    const n = data?.notifications
    if (n && typeof n.friendRequests === 'number' && typeof n.newMessages === 'number') {
      return { friendRequests: n.friendRequests, newMessages: n.newMessages }
    }
    return null
  } catch {
    // Ignore ping errors
    return null
  }
}

export function openChat(username?: string) {
  window.dispatchEvent(new CustomEvent('nx-open-chat', { detail: { username } }))
}

