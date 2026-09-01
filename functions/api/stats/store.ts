import type {
  GameStatsRecord,
  PlayerRecord,
  StatsEvent,
  StatsMap,
} from '../../../shared/stats-protocol'

/**
 * Storage for every counter on the site, behind one interface.
 *
 *  - `d1Store()`     Cloudflare D1 (binding `NIXLABS_DB`, see migrations/)
 *  - `memoryStore()` no binding: a fork, a bare `pages dev`, a preview build
 *
 * The HTTP layer only sees these five operations, so the route behaves the same
 * with or without a database; it just reports `distributed: false` and keeps
 * the player's own row out of the response.
 */

export interface StatsRequest {
  readonly game: string
  readonly event: StatsEvent
  readonly nonce: string
  /** The resolved player. `null` means "count the aggregate, nobody in it". */
  readonly playerId: string | null
  /** Recorded on the player row so a wiped device can still find its way back. */
  readonly fingerprint: string | null
}

export interface StatsSnapshot {
  readonly games: StatsMap
  readonly uniquePlayers: number
  readonly player: PlayerRecord | null
}

export interface StatsApplyResult {
  readonly stats: GameStatsRecord
  readonly player: PlayerRecord | null
  readonly uniquePlayers: number
}

export interface StatsStore {
  readonly distributed: boolean
  /** Everything the GET route answers with, in one round trip. */
  readonly snapshot: (playerId: string | null) => Promise<StatsSnapshot>
  /** One event, applied atomically enough for a counter. */
  readonly apply: (request: StatsRequest) => Promise<StatsApplyResult>
  /** Last-resort identity anchor: which player owns this device hash? */
  readonly findPlayerByFingerprint: (fingerprint: string) => Promise<string | null>
  /** Folds `sourcePlayerId` into whoever owns `syncCode`, and retires it. */
  readonly claimSyncCode: (syncCode: string, sourcePlayerId: string | null) => Promise<PlayerRecord | null>
}
