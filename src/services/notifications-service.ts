import { useSyncExternalStore } from 'react'
import { getMyFriends, getConversations, sendFriendAction } from './social-api'
import { getCurrentUser } from './auth-api'
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

export async function refreshNotifications(): Promise<void> {
  const user = getCurrentUser()
  if (!user) {
    if (currentSnapshot !== emptySnapshot) {
      currentSnapshot = emptySnapshot
      notifyListeners()
    }
    return
  }

  try {
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
  }
}

export async function acceptFriendRequest(username: string): Promise<boolean> {
  const res = await sendFriendAction(username, 'accept')
  if (res.ok) {
    await refreshNotifications()
    return true
  }
  return false
}

export async function declineFriendRequest(username: string): Promise<boolean> {
  const res = await sendFriendAction(username, 'decline')
  if (res.ok) {
    await refreshNotifications()
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

// Auto-refresh interval when window is focused
if (typeof window !== 'undefined') {
  void refreshNotifications()
  window.addEventListener('focus', () => void refreshNotifications())
  window.addEventListener('nx:auth-change', () => void refreshNotifications())
  setInterval(() => void refreshNotifications(), 10000)
}
