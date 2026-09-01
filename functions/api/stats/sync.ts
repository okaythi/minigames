import { readField, isRecordOfStats } from '../../../shared/stats-protocol'
import { parseSyncCode, serializePlayerCookie } from '../../../shared/player-cookie'
import { readJsonBody } from './body'
import { identifyPlayer } from './identity'
import { badRequest, jsonResponse } from './respond'
import { storeFor, type StatsEnv } from './store-for'

/**
 * POST /api/stats/sync - "this device used to be that other device".
 *
 * The code is the whole credential, so the route does exactly three things:
 * look it up, fold whatever this anonymous device had banked into the account it
 * names, and re-plant the cookie on the new identity. A wrong code costs
 * nothing and tells nothing: one 404, no hint whether it was never issued or
 * already used.
 */

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv
}

const codeFrom = (body: unknown): string | null =>
  isRecordOfStats(body) ? parseSyncCode(readField(body, 'syncCode')) : null

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const code = codeFrom(await readJsonBody(request))
  if (code === null) {
    return badRequest('expected { syncCode: "K9F2-P7X1" }')
  }

  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  const player = await store.claimSyncCode(code, playerId)
  if (player === null) {
    return jsonResponse(404, { ok: false, player: null })
  }
  // From now on this device *is* that player: overwrite the cookie.
  return jsonResponse(200, { ok: true, player }, { cookie: serializePlayerCookie(player.id) })
}
