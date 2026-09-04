import { useSyncExternalStore } from 'react'
import { getMyFriends, getConversations, sendFriendAction, type PresencePingResult } from './social-api'
import { getCurrentUser, subscribeAuth } from './auth-api'
import type { FriendSummary, ConversationSummary } from '../../shared/auth-protocol'

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
 * Refreshes the bell snapshot. Every successful refresh costs up to two
 * Functions invocations, so it is deliberately single-flight and throttled:
 * burst triggers (boot, focus, tab-visible, ping deltas) coalesce. Mutating
 * actions pass `force` to bypass the throttle.
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

  if (refreshInflight) return refreshInflight
  const now = Date.now()
  if (!force && now - lastRefreshAt < MIN_REFRESH_INTERVAL_MS) return

  refreshInflight = (async () => {
    lastRefreshAt = Date.now()
    try {
      // getMyFriends/getConversations are themselves single-flight + briefly
      // cached in social-api, so concurrent consumers (drawer, bell, profile)
      // share one request per endpoint instead of each firing their own.
      const [friendsRes, convos] = await Promise.all([
        getMyFriends(),
        getConversations(),
      ])

      const friendRequests = friendsRes.pendingIncoming || []

      const messageNotifications: MessageNotificationItem[] = convos
        .filter((c: ConversationSummary) => c.isFirstEverMessage && !dismissedMsgUsers.has(c.partner.username.toLowerCase()))
        .map((c: ConversationSummary) => ({
          conversationId: c.id,
          username: c.partner.username,
          nickname: c.partner.nickname,
          pfpUrl: c.partner.pfpUrl,
          lastMessageSnippet: c.lastMessage?.content,
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
 * The presence heartbeat replies with raw badge counts. Only when a count
 * actually changes do we pay for the full snapshot refresh — this replaces
 * the old unconditional 45s double-fetch.
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

// Wiring. There is deliberately no fixed-interval notification poll: presence
// heartbeats already ping the edge while the tab is visible and logged in, and
// their response carries the badge counts (see applyPingCounts). Full list
// refreshes only happen when those counts change or the user comes back to the
// tab — each one is throttled + single-flight.
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
