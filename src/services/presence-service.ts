import { pingPresence } from './social-api'
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
    void sendHeartbeat()
  }
}

async function sendHeartbeat() {
  if (!getCurrentUser()) return
  if (typeof document !== 'undefined' && document.hidden) return
  const now = Date.now()
  if (!isIdle && now - lastActivityTime > IDLE_THRESHOLD_MS) {
    isIdle = true
  }
  const state = isIdle ? 'idle' : 'online'
  await pingPresence(state, currentGameSlug, gameStartedAt)
}

export function setCurrentlyPlaying(slug: string | null) {
  currentGameSlug = slug
  gameStartedAt = slug ? Math.floor(Date.now() / 1000) : null
  void sendHeartbeat()
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
