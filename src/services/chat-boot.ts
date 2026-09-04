import { getCurrentUser, subscribeAuth } from './auth-api'
import { chatEngine } from '../engine/chat/instance'

/**
 * The seam between the chat engine and the rest of the app. The engine is
 * domain-pure (no auth, no presence); this module is the only place that
 * feeds it those signals. One function, one responsibility.
 */
let initCount = 0

export function initChatSubsystem(): () => void {
  if (typeof window === 'undefined') {
    return () => undefined
  }
  initCount += 1
  // start() is idempotent by design (keyed upserts), so it is safe under
  // StrictMode's mount → cleanup → mount cycle and re-hydrates after dispose.
  chatEngine.start()

  const applyAuth = (): void => {
    if (getCurrentUser() !== null) {
      chatEngine.onSignedIn()
    } else {
      chatEngine.onSignedOut()
    }
  }
  const applyVisibility = (): void => {
    chatEngine.setVisibility(!document.hidden)
  }

  const unsubAuth = subscribeAuth(applyAuth)
  document.addEventListener('visibilitychange', applyVisibility)
  applyAuth()
  applyVisibility()

  return () => {
    initCount -= 1
    document.removeEventListener('visibilitychange', applyVisibility)
    unsubAuth()
    if (initCount === 0) {
      // Persist in-flight drafts; timers die with the engine.
      chatEngine.dispose()
    }
  }
}

/** Presence/notifications bridge: badge deltas drive chat refreshes. */
export function notifyChatOfUnreadChange(unreadConversationCount: number): void {
  chatEngine.applyNewMessageHint(unreadConversationCount)
}
