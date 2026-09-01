/// <reference types="@cloudflare/workers-types" />

import { EMPTY_STATS_RECORD } from '../../../shared/stats-protocol'
import type { StatsApplyResult, StatsRequest, StatsSnapshot, StatsStore } from '../../../shared/stats-store'
import { readGames, bumpGames } from './d1-games'
import { countPlayers, readPlayer, bumpPlayer } from './d1-players'
import { claimSyncCode, findPlayerByFingerprint } from './d1-sync'
import { claimNonce, pruneNonces } from './d1-nonces'

/**
 * The D1 implementation. Replays of identical events are idempotent, and
 * score updates are monotonic across games and players.
 */

export function d1Store(db: D1Database): StatsStore {
  return {
    distributed: true,

    async snapshot(playerId: string | null): Promise<StatsSnapshot> {
      const [games, uniquePlayers, player] = await Promise.all([
        readGames(db),
        countPlayers(db),
        playerId === null ? Promise.resolve(null) : readPlayer(db, playerId),
      ])
      return { games, uniquePlayers, player }
    },

    async apply(request: StatsRequest): Promise<StatsApplyResult> {
      const now = Date.now()
      if (request.nonce.length > 0) {
        const fresh = await claimNonce(db, request.nonce, now)
        if (!fresh) {
          const games = await readGames(db)
          const player = request.playerId === null ? null : await readPlayer(db, request.playerId)
          return {
            stats: games[request.game] ?? EMPTY_STATS_RECORD,
            uniquePlayers: await countPlayers(db),
            player,
          }
        }
      }

      await bumpGames(db, request.game, request.event, now)
      if (request.playerId !== null) {
        await bumpPlayer(db, request.playerId, request.game, request.event, now)
      }

      const [games, uniquePlayers, player] = await Promise.all([
        readGames(db),
        countPlayers(db),
        request.playerId === null ? Promise.resolve(null) : readPlayer(db, request.playerId),
      ])

      if (Math.random() < 0.05) {
        void pruneNonces(db)
      }

      return {
        stats: games[request.game] ?? EMPTY_STATS_RECORD,
        uniquePlayers,
        player,
      }
    },

    async claimSyncCode(syncCode: string, sourcePlayerId: string | null) {
      return claimSyncCode(db, syncCode, sourcePlayerId)
    },

    async findPlayerByFingerprint(fingerprint: string) {
      return findPlayerByFingerprint(db, fingerprint)
    },
  }
}
