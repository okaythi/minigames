import {
  isFingerprint,
  isPlayerId,
  PLAYER_COOKIE_NAME,
  PLAYER_FINGERPRINT_HEADER,
  PLAYER_ID_HEADER,
  readCookie,
  serializePlayerCookie,
} from '../../../shared/player-cookie'
import { resolvePlayer } from '../../../shared/resolve-player'
import type { StatsStore } from '../../../shared/stats-store'

/**
 * Reads the three identity signals off a request and turns them into one
 * player id, in the order the site trusts them: cookie, then the id this
 * browser kept for itself, then the device hash. The rules live in
 * `shared/resolve-player.ts`; this file only speaks HTTP.
 */

export interface IdentifiedPlayer {
  /** `null` only when the visitor is anonymous *and* the store is not bound. */
  readonly playerId: string | null
  /** Set this on the response when the browser could not be anchored. */
  readonly cookie: string | null
  /** The validated device hash, to store against the player for next time. */
  readonly fingerprint: string | null
}

const headerToken = (request: Request, name: string, valid: (value: string) => boolean): string | null => {
  const value = request.headers.get(name)
  return value !== null && valid(value) ? value : null
}

export async function identifyPlayer(
  request: Request,
  store: Pick<StatsStore, 'findPlayerByFingerprint'>,
): Promise<IdentifiedPlayer> {
  const cookieValue = readCookie(request.headers.get('cookie'), PLAYER_COOKIE_NAME)
  const fingerprint = headerToken(request, PLAYER_FINGERPRINT_HEADER, isFingerprint)
  const resolved = await resolvePlayer(
    {
      cookieId: isPlayerId(cookieValue) ? cookieValue : null,
      storedId: headerToken(request, PLAYER_ID_HEADER, isPlayerId),
      fingerprint,
    },
    { byFingerprint: store.findPlayerByFingerprint },
  )
  return {
    playerId: resolved.id,
    cookie: resolved.reanchor ? serializePlayerCookie(resolved.id) : null,
    fingerprint,
  }
}
