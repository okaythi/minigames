import { useSyncExternalStore } from 'react'
import { getMyFriends, sendFriendAction, type PresencePingResult } from './social-api'
import { getCurrentUser, subscribeAuth } from './auth-api'
import { chatEngine } from '../engine/chat/instance'
import type { FriendSummary } from '../../shared/auth-protocol'

/**
 * The notifications engine. Its only job is the bell badge: friend requests
 * (social domain) + new-message pings (chat domain, read through the chat
 * engine's list source — this file never fetches conversations itself, and
 * the chat engine never renders a bell). Presence heartbeats carry raw
 * counts; full snapshots are rebuilt only when a count changes, so idle tabs
 * cost zero requests on this path.
 */
export interface MessageNotificationItem {
  readonly conversationId: string
  readonly username: string
  readonly nickname: string | null
  readonly pfpUrl: string | null
  readonly lastMessageSnippet?: string | undefined
}

export interface NotificationsSnapshot {
  readonly friendRequests: readonly FriendSummary[]
  readonly messageNotifications: readonly MessageNotificationItem[]
  readonly totalCount: number
}

const emptySnapshot: NotificationsSnapshot = {
  friendRequests: [],
  messageNotifications: [],
  totalCount: 0,
}

let currentSnapshot: NotificationsSnapshot = emptySnapshot
const listeners = new Set<() => void>()
const dismissedMsgUsers = new Set<string>()

function notifyListeners(): void {
  for (const listener of listeners) {
    listener()
  }
}

/**
 * Every successful refresh costs at most two edge requests (friends + chat
 * list, each shared + single-flight downstream), so it is throttled: burst
 * triggers (boot, focus, tab-visible, ping deltas) coalesce. Mutating
 * actions pass `force`.
 */
const MIN_REFRESH_INTERVAL_MS = 15_000
let lastRefreshAt = 0
let refreshInflight: Promise<void> | null = null

export async function refreshNotifications(force = false): Promise<void> {
  const user = getCurrentUser()
  if (!user) {
    if (currentSnapshot !== emptySnapshot) {
      currentSnapshot = emptySnapshot
      notifyListeners()
    }
    return
  }

  if (refreshInflight !== null) return refreshInflight
  const now = Date.now()
  if (!force && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return

  refreshInflight = (async () => {
    lastRefreshAt = Date.now()
    try {
      const [friendsRes, convos] = await Promise.all([
        getMyFriends(),
        chatEngine.refreshConversations(force),
      ])

      const friendRequests = friendsRes.pendingIncoming || []

      const messageNotifications: MessageNotificationItem[] = convos
        .filter(
          ({ wire, unreadCount }) =>
            wire.isFirstEverMessage &&
            unreadCount > 0 &&
            !dismissedMsgUsers.has(wire.partner.username.toLowerCase()),
        )
        .map(({ wire }) => ({
          conversationId: wire.id,
          username: wire.partner.username,
          nickname: wire.partner.nickname,
          pfpUrl: wire.partner.pfpUrl,
          lastMessageSnippet: wire.lastMessage?.content,
        }))

      currentSnapshot = {
        friendRequests,
        messageNotifications,
        totalCount: friendRequests.length + messageNotifications.length,
      }
      notifyListeners()
    } catch {
      // Ignore network failure
    } finally {
      refreshInflight = null
    }
  })()

  return refreshInflight
}

/**
 * Presence heartbeat piggyback: only when a count actually changes do we
 * refresh. The chat engine also learns about new messages here — it is the
 * single place ping counts are interpreted.
 */
let lastPingCounts: PresencePingResult | null = null

export function applyPingCounts(counts: PresencePingResult | null): void {
  if (!counts) return
  const changed =
    lastPingCounts === null ||
    lastPingCounts.friendRequests !== counts.friendRequests ||
    lastPingCounts.newMessages !== counts.newMessages
  lastPingCounts = counts
  if (changed) {
    chatEngine.applyNewMessageHint(counts.newMessages)
    void refreshNotifications()
  }
}

export async function acceptFriendRequest(username: string): Promise<boolean> {
  const res = await sendFriendAction(username, 'accept')
  if (res.ok) {
    await refreshNotifications(true)
    return true
  }
  return false
}

export async function declineFriendRequest(username: string): Promise<boolean> {
  const res = await sendFriendAction(username, 'decline')
  if (res.ok) {
    await refreshNotifications(true)
    return true
  }
  return false
}

export function dismissMessageNotification(username: string): void {
  dismissedMsgUsers.add(username.toLowerCase())
  if (currentSnapshot.messageNotifications.length > 0) {
    const nextMsgNotifs = currentSnapshot.messageNotifications.filter(
      (m) => m.username.toLowerCase() !== username.toLowerCase(),
    )
    currentSnapshot = {
      ...currentSnapshot,
      messageNotifications: nextMsgNotifs,
      totalCount: currentSnapshot.friendRequests.length + nextMsgNotifs.length,
    }
    notifyListeners()
  }
}

export function subscribeNotifications(callback: () => void): () => void {
  listeners.add(callback)
  return () => {
    listeners.delete(callback)
  }
}

export function getNotificationsSnapshot(): NotificationsSnapshot {
  return currentSnapshot
}

export function useNotifications(): NotificationsSnapshot {
  return useSyncExternalStore(
    subscribeNotifications,
    getNotificationsSnapshot,
    () => emptySnapshot,
  )
}

// Boot wiring. No fixed-interval poll: the presence heartbeat (which already
// exists for online status) is the carrier; focus/visibility just re-arm the
// throttled refresh.
if (typeof window !== 'undefined') {
  if (getCurrentUser()) {
    void refreshNotifications()
  }
  subscribeAuth(() => {
    if (getCurrentUser()) void refreshNotifications()
  })
  window.addEventListener('focus', () => void refreshNotifications())
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refreshNotifications()
  })
}
