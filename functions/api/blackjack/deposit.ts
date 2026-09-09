import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { players, blackjackSessions } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse, badRequest } from '../stats/respond'
import { identifySessionDetailed } from '../../../shared/session'
import type {
  BlackjackDepositPayload,
  BlackjackDepositResponse,
} from '../../../shared/blackjack-protocol'

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

  let body: BlackjackDepositPayload
  try {
    body = (await request.json()) as BlackjackDepositPayload
  } catch {
    return badRequest('invalid-json')
  }

  const candies = Math.floor(body.candies)
  if (typeof candies !== 'number' || isNaN(candies) || candies < 3) {
    return badRequest('candies-must-be-at-least-3')
  }

  const playerRow = await db.select().from(players).where(eq(players.id, playerId)).get()
  const currentCandy = playerRow?.candy ?? 0

  if (currentCandy < candies) {
    return jsonResponse(400, { ok: false, error: 'insufficient-candy' })
  }

  // 3 Candies = 1 EUR
  const eurToAdd = Math.floor(candies / 3)
  const candiesDeducted = eurToAdd * 3
  const newCandy = currentCandy - candiesDeducted

  // Ensure session exists
  let session = await db.select().from(blackjackSessions).where(eq(blackjackSessions.playerId, playerId)).get()
  const now = Date.now()

  if (!session) {
    await db.insert(blackjackSessions).values({
      playerId,
      bankroll: eurToAdd,
      bonusEur: 0,
      depositedEur: eurToAdd,
      initialTotalEur: eurToAdd,
      firstTimeGranted: 1,
      difficulty: 'normal',
      companionCount: 2,
      updatedAt: now,
    })
    session = await db.select().from(blackjackSessions).where(eq(blackjackSessions.playerId, playerId)).get()
  } else {
    await db
      .update(blackjackSessions)
      .set({
        bankroll: session.bankroll + eurToAdd,
        depositedEur: session.depositedEur + eurToAdd,
        initialTotalEur: session.initialTotalEur + eurToAdd,
        updatedAt: now,
      })
      .where(eq(blackjackSessions.playerId, playerId))
  }

  // Deduct candies from players
  await db.update(players).set({ candy: newCandy }).where(eq(players.id, playerId))

  const newBankroll = (session?.bankroll ?? 0) + (session ? eurToAdd : 0)
  const newDeposited = (session?.depositedEur ?? 0) + (session ? eurToAdd : 0)
  const newInitialTotal = (session?.initialTotalEur ?? 0) + (session ? eurToAdd : 0)

  const res: BlackjackDepositResponse = {
    ok: true,
    candy: newCandy,
    bankroll: newBankroll,
    wallet: {
      bonusEur: session?.bonusEur ?? 0,
      depositedEur: newDeposited,
      initialTotalEur: newInitialTotal,
    },
  }

  return jsonResponse(200, res)
}
