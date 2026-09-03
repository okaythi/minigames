import {
  applyStatsEvent,
  EMPTY_STATS_RECORD,
  type GameStatsRecord,
  type PlayerRecord,
  type StatsMap,
} from './stats-protocol'
import { applyPlayerEvent, emptyPlayerRecord, mergePlayerRecords } from './player-record'
import { mintSyncCode } from './player-cookie'
import type { StatsApplyResult, StatsRequest, StatsSnapshot, StatsStore } from './stats-store'

/**
 * A store whose entire state is these four collections, so it can be built from
 * nothing (a Pages deployment with no D1 binding) or hydrated from a JSON file
 * (`vite dev`) without a second set of rules. What an event does to a counter is
 * decided here and nowhere else that is not SQL.
 */
export interface StatsMemory {
  readonly games: Map<string, GameStatsRecord>
  readonly players: Map<string, PlayerRecord>
  /** Device hash -> player id. Last-resort anchor, last write wins. */
  readonly fingerprints: Map<string, string>
  /** A bounded replay window, not a ledger. */
  readonly nonces: Set<string>
}

const MAX_TRACKED_NONCES = 512
const MAX_NONCE_ATTEMPTS = 4

export function emptyStatsMemory(slugs: readonly string[]): StatsMemory {
  return {
    games: new Map(slugs.map((slug) => [slug, EMPTY_STATS_RECORD])),
    players: new Map(),
    fingerprints: new Map(),
    nonces: new Set(),
  }
}

export function statsStoreFrom(memory: StatsMemory, distributed: boolean): StatsStore {
  const nextCode = (): string | null => {
    for (let attempt = 0; attempt < MAX_NONCE_ATTEMPTS; attempt += 1) {
      const code = mintSyncCode(Math.random)
      if (![...memory.players.values()].some((player) => player.syncCode === code)) {
        return code
      }
    }
    return null
  }

  const write = (player: PlayerRecord): void => {
    memory.players.set(player.id, player.syncCode === null ? { ...player, syncCode: nextCode() } : player)
  }

  /** A player row is created empty and only ever grows from there. */
  const ensurePlayer = (playerId: string): PlayerRecord => {
    const existing = memory.players.get(playerId)
    if (existing !== undefined) {
      return existing
    }
    const created: PlayerRecord = { ...emptyPlayerRecord(playerId), syncCode: null }
    memory.players.set(playerId, created)
    return created
  }

  const readPlayer = (playerId: string | null): PlayerRecord | null => {
    if (playerId === null) {
      return null
    }
    const record = memory.players.get(playerId)
    if (record === undefined) {
      return null
    }
    if (record.syncCode === null) {
      write(record)
      return memory.players.get(playerId) ?? record
    }
    return record
  }

  const readGames = (): StatsMap => {
    const snapshot: Record<string, GameStatsRecord> = {}
    for (const [slug, record] of memory.games) {
      snapshot[slug] = record
    }
    return snapshot
  }

  const rememberNonce = (nonce: string): void => {
    memory.nonces.add(nonce)
    if (memory.nonces.size > MAX_TRACKED_NONCES) {
      // Drop the whole window rather than track ages; a replay after that is a
      // retry the client should have deduped itself.
      memory.nonces.clear()
      memory.nonces.add(nonce)
    }
  }

  return {
    distributed,

    async snapshot(playerId): Promise<StatsSnapshot> {
      return { games: readGames(), uniquePlayers: memory.players.size, player: readPlayer(playerId) }
    },

    findPlayerByFingerprint: async (fingerprint) => memory.fingerprints.get(fingerprint) ?? null,

    claimSyncCode: async (syncCode, sourcePlayerId) => {
      const target = [...memory.players.entries()].find(([, player]) => player.syncCode === syncCode)
      if (target === undefined) {
        return null
      }
      const [targetId, targetRecord] = target
      if (sourcePlayerId === null || sourcePlayerId === targetId) {
        return readPlayer(targetId)
      }
      const source = memory.players.get(sourcePlayerId)
      if (source !== undefined) {
        memory.players.delete(sourcePlayerId)
        for (const [fingerprint, id] of [...memory.fingerprints]) {
          if (id === sourcePlayerId) {
            memory.fingerprints.set(fingerprint, targetId)
          }
        }
        write(mergePlayerRecords(targetRecord, source))
      }
      return readPlayer(targetId)
    },

    async apply(request: StatsRequest): Promise<StatsApplyResult> {
      if (!memory.nonces.has(request.nonce)) {
        rememberNonce(request.nonce)
        const { playerId, fingerprint, game, event } = request
        if (playerId !== null) {
          if (fingerprint !== null) {
            memory.fingerprints.set(fingerprint, playerId)
          }
          const updated = applyPlayerEvent(ensurePlayer(playerId), game, event)
          if (updated !== null) {
            write(updated)
          }
        }
        if (game.length > 0) {
          memory.games.set(
            game,
            applyStatsEvent(memory.games.get(game) ?? EMPTY_STATS_RECORD, event, Date.now(), game),
          )
        }
      }
      return {
        stats: memory.games.get(request.game) ?? EMPTY_STATS_RECORD,
        player: readPlayer(request.playerId),
        uniquePlayers: memory.players.size,
      }
    },
  }
}

