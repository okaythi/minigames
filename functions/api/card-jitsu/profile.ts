import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja, cjCard, cjMatch } from '../../../src/db/schema'
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
      updatedAt: nowIso,
    }
    await db.insert(cjNinja).values(defaultNinja).onConflictDoNothing()
    ninja = (await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()) ?? defaultNinja
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

  const profile: CardJitsuProfileResponse = {
    rank: ninja.rank,
    progress: ninja.progress,
    matchesWon: ninja.matchesWon,
    colorId: ninja.colorId,
    introSeen: ninja.introSeen === 1,
    cards,
    eligibleOpponents,
  }

  return jsonResponse(200, { ok: true, profile })
}
