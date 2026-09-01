import {
  parseStatsEventBody,
  type StatsEventResponseBody,
  type StatsResponseBody,
} from '../../../shared/stats-protocol'
import { isAllowedGameSlug } from '../../../shared/game-slugs'
import { readJsonBody } from './body'
import { identifyPlayer } from './identity'
import { badRequest, jsonResponse } from './respond'
import { storeFor, type StatsEnv } from './store-for'

/**
 * The counters API.
 *
 * GET  /api/stats        every game's record, the unique-player total, and this
 *                        player's own row (highscore + candy, global and per game)
 * POST /api/stats        one event - visit | play | score | candy, nonce-guarded
 * POST /api/stats/sync   claim a sync code from another device (sync.ts)
 *
 * Identity is resolved from the request itself - cookie first, then the id this
 * browser kept, then the device hash - and a response that mints or recovers an
 * id re-plants the cookie. Backed by D1 (`NIXLABS_DB`); without the binding the
 * same routes answer from memory and report `distributed: false`.
 */

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId, cookie } = await identifyPlayer(request, store)
  const { games, uniquePlayers, player } = await store.snapshot(playerId)
  const payload: StatsResponseBody = {
    ok: true,
    games,
    uniquePlayers,
    player,
    distributed: store.distributed,
  }
  // The aggregate half of the answer is the same for everyone and worth
  // caching; the moment a player's own row is in there, it is not.
  return jsonResponse(200, payload, {
    cacheSeconds: player === null ? 25 : undefined,
    cookie,
  })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return badRequest('expected application/json')
  }
  const body = parseStatsEventBody(await readJsonBody(request))
  if (body === null) {
    return badRequest('invalid payload')
  }
  // A site-wide visit carries no game slug; everything else must name a known one.
  const gameOk = body.event.type === 'visit' ? body.game.length === 0 : isAllowedGameSlug(body.game)
  if (!gameOk) {
    return badRequest('unknown game')
  }

  const store = storeFor(env)
  const { playerId, cookie, fingerprint } = await identifyPlayer(request, store)
  const result = await store.apply({
    game: body.game,
    event: body.event,
    nonce: body.nonce,
    playerId,
    fingerprint,
  })
  const response: StatsEventResponseBody = {
    ok: true,
    stats: result.stats,
    uniquePlayers: result.uniquePlayers,
    player: result.player,
  }
  return jsonResponse(200, response, { cookie })
}
