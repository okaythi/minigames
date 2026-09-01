import { randomUuid } from './player-cookie'

/**
 * The identity waterfall, in one place, with no storage of its own.
 *
 * Three layers, cheapest and most reliable first: the httpOnly cookie the
 * server owns, the id the browser kept for itself, then a device fingerprint
 * for the case where both were wiped. Only the fingerprint needs a lookup, so
 * the caller injects it and this stays testable in every runtime.
 */

export interface PlayerIdentitySignals {
  /** `player_id` cookie, if the browser sent one. */
  readonly cookieId: string | null
  /** The id kept in localStorage, sent as a header. */
  readonly storedId: string | null
  /** Hash of the device, sent as a header. Last resort. */
  readonly fingerprint: string | null
}

export interface PlayerIdentityLookups {
  /** The most recently seen player whose fingerprint matches. */
  readonly byFingerprint: (fingerprint: string) => Promise<string | null>
}

export interface ResolvedPlayer {
  readonly id: string
  /** Nothing matched: the caller has to insert the row this visit creates. */
  readonly minted: boolean
  /** The browser has no usable cookie: the caller has to send one again. */
  readonly reanchor: boolean
}

export async function resolvePlayer(
  signals: PlayerIdentitySignals,
  lookups: PlayerIdentityLookups,
): Promise<ResolvedPlayer> {
  if (signals.cookieId !== null) {
    return { id: signals.cookieId, minted: false, reanchor: false }
  }
  if (signals.storedId !== null) {
    // Cookie cleared, storage intact: trust the client's memory and re-plant.
    return { id: signals.storedId, minted: false, reanchor: true }
  }
  if (signals.fingerprint !== null) {
    const recovered = await lookups.byFingerprint(signals.fingerprint)
    if (recovered !== null) {
      return { id: recovered, minted: false, reanchor: true }
    }
  }
  return { id: randomUuid(), minted: true, reanchor: true }
}
