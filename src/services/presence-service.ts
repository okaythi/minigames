import { pingPresence } from './social-api'
import { applyPingCounts } from './notifications-service'
import { getCurrentUser, subscribeAuth } from './auth-api'

let currentGameSlug: string | null = null
let gameStartedAt: number | null = null
let isIdle = false
let lastActivityTime = Date.now()
let pingTimer: number | null = null

const IDLE_THRESHOLD_MS = 60 * 1000

function updateActivity() {
  lastActivityTime = Date.now()
  if (isIdle) {
    isIdle = false
    void sendHeartbeat(true)
  }
}

async function sendHeartbeat(force = false) {
  if (!getCurrentUser()) return
  if (typeof document !== 'undefined' && document.hidden) return
  // While nobody is touching the keyboard/mouse we deliberately go silent:
  // the edge still shows "idle" for ~2.5 minutes and then lets the presence
  // row decay to "offline", which is exactly what a real onlooker should see.
  // This removes the per-minute quota tax of pinging a tab nobody is using.
  // `force` keeps explicit state changes (game start/stop, return to tab)
  // instant, and an in-progress game keeps the beat alive even when the
  // player pauses between rounds.
  if (isIdle && !force && !currentGameSlug) return
  const now = Date.now()
  if (!isIdle && now - lastActivityTime > IDLE_THRESHOLD_MS) {
    isIdle = true
  }
  const state = isIdle ? 'idle' : 'online'
  const counts = await pingPresence(state, currentGameSlug, gameStartedAt)
  if (counts) {
    applyPingCounts(counts)
  }
}

export function setCurrentlyPlaying(slug: string | null) {
  currentGameSlug = slug
  gameStartedAt = slug ? Math.floor(Date.now() / 1000) : null
  // Entering/leaving a game is a visible state change; push it immediately.
  void sendHeartbeat(true)
}

export function initPresenceTracker(): () => void {
  const events = ['mousemove', 'keydown', 'touchstart', 'scroll']
  events.forEach((ev) => window.addEventListener(ev, updateActivity, { passive: true }))

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isIdle = true
    } else {
      updateActivity()
    }
  })

  // Start periodic heartbeat
  pingTimer = window.setInterval(() => {
    void sendHeartbeat()
  }, 40 * 1000)

  // Initial heartbeat
  void sendHeartbeat()

  const unsubAuth = subscribeAuth(() => {
    void sendHeartbeat()
  })

  return () => {
    events.forEach((ev) => window.removeEventListener(ev, updateActivity))
    if (pingTimer) clearInterval(pingTimer)
    unsubAuth()
  }
}
