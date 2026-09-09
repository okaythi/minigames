import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { players, blackjackSessions } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import { identifySessionDetailed } from '../../../shared/session'
import type { BlackjackCashOutResponse } from '../../../shared/blackjack-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

async function resolvePlayerId(
  request: Request,
  db: DrizzleD1Database,
  store: ReturnType<typeof storeFor>,
): Promise<string | null> {
  try {
    const sessionRes = await identifySessionDetailed(request, db)
    if (sessionRes.status === 'valid' && sessionRes.playerId) {
      return sessionRes.playerId
    }
  } catch {
    // Continue fallback
  }

  const identified = await identifyPlayer(request, store)
  return identified.playerId
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const store = storeFor(env)
  const playerId = await resolvePlayerId(request, db, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const currentCandy = playerRow?.candy ?? 0

  const session = await db.select().from(blackjackSessions).where(eq(blackjackSessions.playerId, playerId)).get()

  if (!session || session.bankroll <= 0) {
    const res: BlackjackCashOutResponse = {
      ok: true,
      cashedOutEur: 0,
      cashedOutCandies: 0,
      candy: currentCandy,
      bankroll: 0,
      wallet: {
        bonusEur: 0,
        depositedEur: 0,
        initialTotalEur: 0,
      },
    }
    return jsonResponse(200, res)
  }

  const bankroll = session.bankroll
  const initialTotal = session.initialTotalEur
  const deposited = session.depositedEur

  let cashoutEur = 0
  if (bankroll > initialTotal) {
    // Player made profit over initial bankroll
    const profit = bankroll - initialTotal
    cashoutEur = deposited + profit
  } else if (initialTotal > 0) {
    // Player is below or at initial bankroll: proportional cashout of own deposited funds
    cashoutEur = Math.floor(bankroll * (deposited / initialTotal))
  }

  const candiesAwarded = cashoutEur * 3
  const newCandy = currentCandy + candiesAwarded
  const now = Date.now()

  // Update player candies in DB
  await db.update(players).set({ candy: newCandy }).where(eq(players.id, playerId))

  // Clear table session bankroll and active wallet in DB
  await db
    .update(blackjackSessions)
    .set({
      bankroll: 0,
      bonusEur: 0,
      depositedEur: 0,
      initialTotalEur: 0,
      updatedAt: now,
    })
    .where(eq(blackjackSessions.playerId, playerId))

  const res: BlackjackCashOutResponse = {
    ok: true,
    cashedOutEur: cashoutEur,
    cashedOutCandies: candiesAwarded,
    candy: newCandy,
    bankroll: 0,
    wallet: {
      bonusEur: 0,
      depositedEur: 0,
      initialTotalEur: 0,
    },
  }

  return jsonResponse(200, res)
}
