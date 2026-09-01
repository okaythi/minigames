import type { GameStatsRecord, PlayerRecord, StatsEvent, StatsMap } from './stats-protocol'

/**
 * The storage contract for every counter on the site.
 *
 * Three implementations, one interface: D1 (online), the shared memory store
 * (a Pages deployment with no binding) and the same memory store hydrated from
 * a JSON file (Vite dev). The HTTP layers on both sides only ever call these
 * four operations, so no environment can grow a behaviour the others lack.
 */

export interface StatsRequest {
  readonly game: string
  readonly event: StatsEvent
  readonly nonce: string
  /** The resolved player. `null` means "count the aggregate, nobody in it". */
  readonly playerId: string | null
  /** Recorded against the player so a wiped device can find its way back. */
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
  readonly claimSyncCode: (
    syncCode: string,
    sourcePlayerId: string | null,
  ) => Promise<PlayerRecord | null>
}
