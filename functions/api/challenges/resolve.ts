import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, challenges, messages, conversations } from '../../../src/db/schema'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const url = new URL(request.url)
  const challengeId = url.searchParams.get('id')
  if (!challengeId) {
    return badRequest('id is required')
  }

  const db = drizzle(env.NIXLABS_DB)
  const ch = await db.select().from(challenges).where(eq(challenges.id, challengeId)).get()
  if (!ch) {
    return badRequest('challenge not found')
  }

  const challenger = await db.select().from(users).where(eq(users.playerId, ch.challengerId)).get()
  const challenged = await db.select().from(users).where(eq(users.playerId, ch.challengedId)).get()

  return jsonResponse(200, {
    ok: true,
    challenge: {
      id: ch.id,
      gameSlug: ch.gameSlug,
      targetScore: ch.targetScore,
      bountyCandy: ch.bountyCandy,
      status: ch.status,
      challengerUsername: challenger?.username ?? 'unknown',
      challengedUsername: challenged?.username ?? 'unknown',
    },
  })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const body = (await readJsonBody(request)) as { challengeId?: string; finalScore?: number } | null
  if (!body?.challengeId || typeof body.finalScore !== 'number') {
    return badRequest('challengeId and finalScore are required')
  }

  const db = drizzle(env.NIXLABS_DB)
  const ch = await db.select().from(challenges).where(eq(challenges.id, body.challengeId)).get()
  if (!ch || ch.status !== 'pending') {
    return jsonResponse(200, { ok: true, active: false })
  }

  if (ch.challengedId !== playerId) {
    return badRequest('not your challenge to resolve')
  }

  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  const won = body.finalScore >= ch.targetScore
  const nowSeconds = Math.floor(Date.now() / 1000)

  if (won) {
    if (ch.bountyCandy > 0) {
      const recipientPlayer = await db.select().from(players).where(eq(players.id, playerId)).get()
      if (recipientPlayer) {
        await db
          .update(players)
          .set({ candy: recipientPlayer.candy + ch.bountyCandy })
          .where(eq(players.id, playerId))
          .run()
      }
    }

    await db
      .update(challenges)
      .set({
        status: 'completed',
        winnerId: playerId,
        completedAt: nowSeconds,
      })
      .where(eq(challenges.id, ch.id))
      .run()

    if (ch.conversationId) {
      const bountyText = ch.bountyCandy > 0 ? ` (+${ch.bountyCandy} Candy 🍬)` : ''
      const sysMsgId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      await db
        .insert(messages)
        .values({
          id: sysMsgId,
          conversationId: ch.conversationId,
          senderId: playerId,
          recipientId: ch.challengerId,
          messageType: 'system',
          content: `🎉 Challenge Won! @${user.username} beat the target of ${ch.targetScore} with score ${body.finalScore}!${bountyText}`,
          createdAt: nowSeconds,
        })
        .run()

      await db
        .update(conversations)
        .set({ lastMessageAt: nowSeconds })
        .where(eq(conversations.id, ch.conversationId))
        .run()
    }

    return jsonResponse(200, { ok: true, won: true, bountyWon: ch.bountyCandy })
  }

  return jsonResponse(200, { ok: true, won: false })
}
