import {
  parseGameStatsRecord,
  parseStatsResponse,
  STATS_ENDPOINT,
  readField,
  type GameStatsRecord,
  type StatsEvent,
  type StatsMap,
} from '../../../shared/stats-protocol'

/**
 * Thin client for the Cloudflare Pages Function (and the identical Vite dev
 * middleware). Every method degrades to `null` rather than throwing: the site
 * must still render offline.
 */

const REQUEST_TIMEOUT_MS = 2500

const makeNonce = (): string => {
  const uuid = globalThis.crypto?.randomUUID?.()
  return uuid ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

const withTimeout = async <T>(work: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await work(controller.signal)
  } catch {
    return null
  } finally {
    globalThis.clearTimeout(timer)
  }
}

export async function fetchAllStats(): Promise<{ games: StatsMap; distributed: boolean } | null> {
  return withTimeout(async (signal) => {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'GET',
      headers: { accept: 'application/json' },
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      return null
    }
    return parseStatsResponse(await response.json())
  })
}

export async function pushStatsEvent(
  game: string,
  event: StatsEvent,
): Promise<GameStatsRecord | null> {
  const body = JSON.stringify({ game, event, nonce: makeNonce() })
  return withTimeout(async (signal) => {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      signal,
    })
    if (!response.ok) {
      return null
    }
    const payload: unknown = await response.json()
    if (typeof payload !== 'object' || payload === null) {
      return null
    }
    // The edge has already applied the event; we only re-validate the shape.
    if (readField(payload, 'ok') !== true) {
      return null
    }
    return parseGameStatsRecord(readField(payload, 'stats'))
  })
}
