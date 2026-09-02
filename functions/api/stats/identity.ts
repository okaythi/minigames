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

export interface IdentifiedPlayer {
  readonly playerId: string | null
  readonly cookie: string | null
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
    cookie: resolved.reanchor && resolved.id !== null ? serializePlayerCookie(resolved.id) : null,
    fingerprint,
  }
}
