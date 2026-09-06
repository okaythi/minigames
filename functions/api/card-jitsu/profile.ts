import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, cjNinja, cjCard, cjMatch, cjNinjaColors } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import rawRoster from '../../../src/games/card-jitsu/engine/opponents/roster.json'
import { BELT_TO_RANK, STARTER_DECK_CARDS, type NinjaBelt } from '../../../shared/progression'
import type { OwnedCard, CardJitsuProfileResponse } from '../../../shared/card-jitsu-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

interface RosterJsonItem {
  readonly name: string
  readonly belt: string
  readonly colorId: number
  readonly onceOnly?: boolean
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  // Fetch or initialize cj_ninja record
  let ninja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  if (!ninja) {
    const nowIso = new Date().toISOString()
    const defaultNinja = {
      userId: playerId,
      rank: 0,
      progress: 0,
      matchesWon: 0,
      colorId: 1,
      introSeen: 0,
      packsPurchased: 0,
      updatedAt: nowIso,
    }
    await db.insert(cjNinja).values(defaultNinja).onConflictDoNothing()
    ninja = (await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()) ?? defaultNinja
  }

  if (!ninja) {
    return jsonResponse(500, { ok: false, error: 'failed-to-initialize-ninja' })
  }

  // Fetch owned cards
  const cardRows = await db.select().from(cjCard).where(eq(cjCard.userId, playerId)).all()
  const cards: OwnedCard[] = cardRows.map((r) => ({
    cardId: r.cardId,
    quantity: r.quantity,
    memberQuantity: r.memberQuantity,
  }))

  // Compute eligible opponents: min(rank + 1, 9) minus any with a cj_match row where onceOnly is true
  const maxOpponentRank = Math.min(ninja.rank + 1, 9)
  const roster = rawRoster as readonly RosterJsonItem[]
  const candidates = roster.filter((item) => {
    const beltRank = BELT_TO_RANK[item.belt as NinjaBelt] ?? 1
    return beltRank <= maxOpponentRank
  })

  const playedMatches = await db
    .select({ opponent: cjMatch.opponent })
    .from(cjMatch)
    .where(eq(cjMatch.userId, playerId))
    .all()
  const playedOpponents = new Set(playedMatches.map((m) => m.opponent.toLowerCase()))

  const eligibleOpponents = candidates
    .filter((item) => {
      if (item.onceOnly === true && playedOpponents.has(item.name.toLowerCase())) {
        return false
      }
      return true
    })
    .map((item) => item.name)

  let ownedColors = [1]
  try {
    const ownedColorRows = await db
      .select({ colorId: cjNinjaColors.colorId })
      .from(cjNinjaColors)
      .where(eq(cjNinjaColors.userId, playerId))
      .all()
    ownedColors = Array.from(new Set<number>([1, ...ownedColorRows.map((r) => r.colorId)]))
  } catch (err) {
    console.warn('[Card-Jitsu Profile] Error loading owned colors:', err)
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const candy = playerRow?.candy ?? 0

  // A player with ANY progression (belt rank, wins toward the next belt, or
  // owned cards) must never be treated as brand new: the intro_seen flag is
  // only persisted when the Sensei intro animation runs to completion, so
  // veterans who skipped it (or progressed before that persistence existed)
  // would otherwise get the first-time intro on every visit. Derive the
  // effective value from progression itself, and self-heal the stored state
  // to what intro-complete would have written (flag + starter deck).
  const hasProgression =
    ninja.rank > 0 || ninja.progress > 0 || ninja.matchesWon > 0 || cards.length > 0
  const introSeen = ninja.introSeen === 1 || hasProgression
  if (hasProgression && ninja.introSeen !== 1) {
    try {
      await db
        .update(cjNinja)
        .set({ introSeen: 1, updatedAt: new Date().toISOString() })
        .where(eq(cjNinja.userId, playerId))
      for (const cardId of STARTER_DECK_CARDS) {
        await db
          .insert(cjCard)
          .values({ userId: playerId, cardId, quantity: 1, memberQuantity: 0 })
          .onConflictDoNothing()
      }
      console.log('[Card-Jitsu Profile] Healed intro state for veteran player', playerId)
    } catch (err) {
      // The derived value already covers this session; the stored flag is
      // only an optimization for the next load.
      console.warn('[Card-Jitsu Profile] Failed to heal intro state:', err)
    }
  }

  const profile: CardJitsuProfileResponse = {
    rank: ninja.rank,
    progress: ninja.progress,
    matchesWon: ninja.matchesWon,
    colorId: ninja.colorId,
    introSeen,
    cards,
    eligibleOpponents,
    ownedColors,
    candy,
  }

  return jsonResponse(200, { ok: true, profile })
}

