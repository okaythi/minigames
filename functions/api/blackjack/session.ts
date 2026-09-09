import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1'
import { eq, and } from 'drizzle-orm'
import { players, playerGames, blackjackSessions } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse, badRequest } from '../stats/respond'
import { identifySessionDetailed } from '../../../shared/session'
import type {
  BlackjackSessionResponse,
  BlackjackSessionUpdatePayload,
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

async function ensurePlayer(db: DrizzleD1Database, playerId: string): Promise<number> {
  const existing = await db.select().from(players).where(eq(players.id, playerId)).get()
  if (existing) {
    return existing.candy ?? 0
  }
  const now = Date.now()
  await db.insert(players).values({
    id: playerId,
    firstSeen: now,
    lastSeen: now,
    candy: 0,
  }).onConflictDoNothing()
  const created = await db.select().from(players).where(eq(players.id, playerId)).get()
  return created?.candy ?? 0
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const store = storeFor(env)
  const playerId = await resolvePlayerId(request, db, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  const candy = await ensurePlayer(db, playerId)
  let row = await db.select().from(blackjackSessions).where(eq(blackjackSessions.playerId, playerId)).get()

  if (!row) {
    // Check if player has ever played blackjack before
    const pg = await db
      .select()
      .from(playerGames)
      .where(and(eq(playerGames.playerId, playerId), eq(playerGames.slug, 'blackjack-21')))
      .get()

    const isFirstTime = !pg || pg.plays === 0
    const bankroll = isFirstTime ? 500 : 0
    const bonusEur = isFirstTime ? 500 : 0
    const depositedEur = 0
    const initialTotalEur = isFirstTime ? 500 : 0

    const now = Date.now()
    await db.insert(blackjackSessions).values({
      playerId,
      bankroll,
      bonusEur,
      depositedEur,
      initialTotalEur,
      firstTimeGranted: 1,
      difficulty: 'normal',
      companionCount: 2,
      updatedAt: now,
    }).onConflictDoNothing()

    row = await db.select().from(blackjackSessions).where(eq(blackjackSessions.playerId, playerId)).get()
    if (!row) {
      return jsonResponse(500, { ok: false, error: 'failed-to-init-blackjack-session' })
    }

    const res: BlackjackSessionResponse = {
      ok: true,
      session: {
        bankroll: row.bankroll,
        wallet: {
          bonusEur: row.bonusEur,
          depositedEur: row.depositedEur,
          initialTotalEur: row.initialTotalEur,
        },
        difficulty: (row.difficulty as any) || 'normal',
        companionCount: (row.companionCount as any) || 2,
        firstTimeGranted: true,
      },
      candy,
      isFirstTime,
    }
    return jsonResponse(200, res)
  }

  const res: BlackjackSessionResponse = {
    ok: true,
    session: {
      bankroll: row.bankroll,
      wallet: {
        bonusEur: row.bonusEur,
        depositedEur: row.depositedEur,
        initialTotalEur: row.initialTotalEur,
      },
      difficulty: (row.difficulty as any) || 'normal',
      companionCount: (row.companionCount as any) || 2,
      firstTimeGranted: row.firstTimeGranted === 1,
    },
    candy,
    isFirstTime: false,
  }
  return jsonResponse(200, res)
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const store = storeFor(env)
  const playerId = await resolvePlayerId(request, db, store)
  if (!playerId) {
    return jsonResponse(401, { ok: false, error: 'unauthorized' })
  }

  let body: BlackjackSessionUpdatePayload
  try {
    body = (await request.json()) as BlackjackSessionUpdatePayload
  } catch {
    return badRequest('invalid-json')
  }

  if (typeof body.bankroll !== 'number' || !body.wallet) {
    return badRequest('invalid-payload')
  }

  const now = Date.now()
  await db
    .update(blackjackSessions)
    .set({
      bankroll: Math.max(0, Math.floor(body.bankroll)),
      bonusEur: Math.max(0, Math.floor(body.wallet.bonusEur ?? 0)),
      depositedEur: Math.max(0, Math.floor(body.wallet.depositedEur ?? 0)),
      initialTotalEur: Math.max(0, Math.floor(body.wallet.initialTotalEur ?? 0)),
      difficulty: body.difficulty ?? 'normal',
      companionCount: body.companionCount ?? 2,
      updatedAt: now,
    })
    .where(eq(blackjackSessions.playerId, playerId))

  return jsonResponse(200, { ok: true })
}
