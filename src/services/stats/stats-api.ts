import {
  parseGameStatsRecord,
  parseStatsResponse,
  readField,
  STATS_ENDPOINT,
  type GameStatsRecord,
  type StatsEvent,
} from '../../../shared/stats-protocol'
import { playerId } from './player-identity'

/**
 * Thin client for the Cloudflare Pages Function (and the identical Vite dev
 * middleware). Every method degrades to `null` rather than throwing: the site
 * must still render offline, with a cold cache, or without a bound database.
 */

const REQUEST_TIMEOUT_MS = 2500

/** Derived from the parser so the two can never drift apart. */
export type StatsPayload = NonNullable<ReturnType<typeof parseStatsResponse>>

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

const readNumber = (source: unknown, key: string): number | null => {
  const value = readField(source, key)
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export async function fetchAllStats(): Promise<StatsPayload | null> {
  return withTimeout(async (signal) => {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'GET',
      headers: { accept: 'application/json', 'x-nixlabs-client': '1' },
      cache: 'no-store',
      signal,
    })
    if (!response.ok) {
      return null
    }
    return parseStatsResponse(await response.json())
  })
}

interface PushPayload {
  readonly stats: GameStatsRecord | null
  readonly uniquePlayers: number | null
}

const post = async (game: string, event: StatsEvent): Promise<PushPayload | null> => {
  const body = JSON.stringify({ game, event, nonce: makeNonce(), playerId: playerId() })
  return withTimeout(async (signal) => {
    const response = await fetch(STATS_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nixlabs-client': '1' },
      body,
      signal,
    })
    if (!response.ok) {
      return null
    }
    const payload: unknown = await response.json()
    // The edge has already applied the event; we only re-validate the shape.
    if (readField(payload, 'ok') !== true) {
      return null
    }
    return {
      stats: parseGameStatsRecord(readField(payload, 'stats')),
      uniquePlayers: readNumber(payload, 'uniquePlayers'),
    }
  })
}

/** A run was started, or a score was submitted: both move the counters. */
export async function pushStatsEvent(game: string, event: StatsEvent): Promise<GameStatsRecord | null> {
  const result = await post(game, event)
  return result?.stats ?? null
}

/**
 * Counts this browser in `players` without touching any game's counters, so a
 * visitor shows up in "unique players" even if they never press play. The event
 * carries no game slug because it is site-wide.
 */
export async function announceVisit(): Promise<number | null> {
  const result = await post('', { type: 'visit' })
  return result?.uniquePlayers ?? null
}

/**
 * Claim a sync code issued on another device. The server replies with the
 * merged `player` row and sets a cookie on success. On success the caller
 * should refresh remote state so the UI reflects the new player row.
 */
export async function claimSyncCode(code: string): Promise<unknown | null> {
  return withTimeout(async (signal) => {
    const response = await fetch(`${STATS_ENDPOINT}/sync`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nixlabs-client': '1' },
      body: JSON.stringify({ syncCode: code }),
      signal,
    })
    if (!response.ok) {
      return null
    }
    const payload: unknown = await response.json()
    return readField(payload, 'player') ?? null
  })
}
