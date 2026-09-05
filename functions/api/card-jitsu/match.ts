import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, cjNinja, cjMatch } from '../../../src/db/schema'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import { jsonResponse } from '../stats/respond'
import { applyMatchProgression } from '../../../shared/progression'
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
      updatedAt: nowIso,
    }
    await db.insert(cjNinja).values(defaultNinja).onConflictDoNothing()
    ninja = (await db.select().from(cjNinja).where(eq(cjNinja.userId, playerId)).get()) ?? defaultNinja
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
      updatedAt: nowIso,
    })
    .where(eq(cjNinja.userId, playerId))

  const response: CardJitsuMatchResponse = {
    ...(outcome.awardRank !== undefined ? { awardRank: outcome.awardRank } : {}),
    rank: outcome.rank,
    progress: outcome.progress,
    matchesWon: outcome.matchesWon,
  }

  return jsonResponse(200, { ok: true, ...response })
}
