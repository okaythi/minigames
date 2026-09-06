import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja, cjMatch, cjCard } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import { applyMatchProgression, STARTER_DECK_CARDS } from '../../../shared/progression'
import { recordDailyActivity } from '../achievements/d1-achievements'
import type { CardJitsuMatchPayload, CardJitsuMatchResponse } from '../../../shared/card-jitsu-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
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

  let body: CardJitsuMatchPayload
  try {
    body = (await request.json()) as CardJitsuMatchPayload
  } catch {
    return jsonResponse(400, { ok: false, error: 'invalid-json' })
  }

  if (!body.id || !body.opponent || !body.winner || !body.mode) {
    return jsonResponse(400, { ok: false, error: 'missing-required-fields' })
  }
  if ((body.winner !== 'player' && body.winner !== 'opponent') || (body.mode !== 'belts' && body.mode !== 'sensei')) {
    return jsonResponse(400, { ok: false, error: 'invalid-match-outcome' })
  }

  // Idempotency: Check if client nonce match ID was already processed
  const existingMatch = await db.select().from(cjMatch).where(eq(cjMatch.id, body.id)).get()
  if (existingMatch) {
    const currentNinja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
    const response: CardJitsuMatchResponse = {
      awardRank:
        existingMatch.rankAfter > existingMatch.rankBefore ? existingMatch.rankAfter : undefined,
      rank: existingMatch.rankAfter,
      progress: existingMatch.progressAfter,
      matchesWon: currentNinja?.matchesWon ?? 0,
      progressAwarded: Math.max(0, existingMatch.progressAfter - existingMatch.progressBefore),
    }
    return jsonResponse(200, { ok: true, ...response })
  }

  const nowIso = new Date().toISOString()

  // Fetch current ninja state
  let ninja = await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()
  if (!ninja) {
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

  // Authoritative server-side progression execution
  const outcome = applyMatchProgression(
    {
      rank: ninja.rank,
      progress: ninja.progress,
      matchesWon: ninja.matchesWon,
    },
    {
      winner: body.winner,
      mode: body.mode,
    },
  )

  // Insert match history record
  await db.insert(cjMatch).values({
    id: body.id,
    userId: playerId,
    opponent: body.opponent,
    mode: body.mode,
    winner: body.winner,
    rounds: Number(body.rounds) || 1,
    winMethod: body.winMethod || 'same-element',
    flawless: body.flawless ? 1 : 0,
    fullDojo: body.fullDojo ? 1 : 0,
    senseiCard: body.senseiCardPlayed ? 1 : 0,
    rankBefore: ninja.rank,
    rankAfter: outcome.rank,
    progressBefore: ninja.progress,
    progressAfter: outcome.progress,
    createdAt: nowIso,
  })

  // Update ninja record
  await db
    .update(cjNinja)
    .set({
      rank: outcome.rank,
      progress: outcome.progress,
      matchesWon: outcome.matchesWon,
      introSeen: 1,
      updatedAt: nowIso,
    })
    .where(eq(cjNinja.userId, playerId))

  // Ensure starter cards exist in cj_card if the player has played a match
  const cardCount = await db
    .select({ cardId: cjCard.cardId })
    .from(cjCard)
    .where(eq(cjCard.userId, playerId))
    .limit(1)
    .all()
  if (cardCount.length === 0) {
    for (const cardId of STARTER_DECK_CARDS) {
      await db
        .insert(cjCard)
        .values({
          userId: playerId,
          cardId,
          quantity: 1,
          memberQuantity: 0,
        })
        .onConflictDoNothing()
    }
  }

  // Record daily activity so Card-Jitsu matches maintain player login streaks
  await recordDailyActivity(db, playerId, nowIso.slice(0, 10))

  const response: CardJitsuMatchResponse = {
    ...(outcome.awardRank !== undefined ? { awardRank: outcome.awardRank } : {}),
    rank: outcome.rank,
    progress: outcome.progress,
    matchesWon: outcome.matchesWon,
    progressAwarded: Math.max(0, outcome.progress - ninja.progress),
  }

  return jsonResponse(200, { ok: true, ...response })
}
