import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja, cjCard, cjMatch, cjNinjaColors } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import rawRoster from '../../../src/games/card-jitsu/engine/opponents/roster.json'
import { BELT_TO_RANK, type NinjaBelt } from '../../../shared/progression'
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

  const profile: CardJitsuProfileResponse = {
    rank: ninja.rank,
    progress: ninja.progress,
    matchesWon: ninja.matchesWon,
    colorId: ninja.colorId,
    introSeen: ninja.introSeen === 1,
    cards,
    eligibleOpponents,
    ownedColors,
  }

  return jsonResponse(200, { ok: true, profile })
}

