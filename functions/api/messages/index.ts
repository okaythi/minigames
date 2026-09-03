import { drizzle } from 'drizzle-orm/d1'
import { eq, or, and, desc, gte, isNull } from 'drizzle-orm'
import { users, players, conversations, messages, friendships, challenges } from '../../../src/db/schema'
import { hasFlag, UserFlags } from '../../../shared/flags'
import { readJsonBody } from '../stats/body'
import { badRequest, jsonResponse } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import type { DirectMessage, ConversationSummary } from '../../../shared/auth-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const user = await db.select().from(users).where(eq(users.playerId, playerId)).get()
  if (!user) {
    return badRequest('unauthorized')
  }

  const url = new URL(request.url)
  const convoIdParam = url.searchParams.get('conversationId')
  const recipientParam = url.searchParams.get('recipient')?.toLowerCase()

  if (convoIdParam || recipientParam) {
    let convo = convoIdParam
      ? await db.select().from(conversations).where(eq(conversations.id, convoIdParam)).get()
      : null

    if (!convo && recipientParam) {
      const target = await db.select().from(users).where(eq(users.username, recipientParam)).get()
      if (target) {
        convo = await db
          .select()
          .from(conversations)
          .where(
            or(
              and(eq(conversations.user1Id, playerId), eq(conversations.user2Id, target.playerId)),
              and(eq(conversations.user1Id, target.playerId), eq(conversations.user2Id, playerId)),
            ),
          )
          .get()
      }
    }

    if (!convo) {
      return jsonResponse(200, { ok: true, messages: [] })
    }

    const nowSeconds = Math.floor(Date.now() / 1000)
    // Mark unread messages as read
    await db
      .update(messages)
      .set({ readAt: nowSeconds })
      .where(
        and(
          eq(messages.conversationId, convo.id),
          eq(messages.recipientId, playerId),
          isNull(messages.readAt),
        ),
      )
      .run()

    const msgRows = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, convo.id),
          or(
            and(eq(messages.senderId, playerId), eq(messages.deletedBySender, 0)),
            and(eq(messages.recipientId, playerId), eq(messages.deletedByRecipient, 0)),
          ),
        ),
      )
      .orderBy(messages.createdAt)
      .all()

    const otherPlayerId = convo.user1Id === playerId ? convo.user2Id : convo.user1Id
    const otherUser = await db.select().from(users).where(eq(users.playerId, otherPlayerId)).get()

    const formatted: DirectMessage[] = msgRows.map((m) => {
      const isMe = m.senderId === playerId
      return {
        id: m.id,
        conversationId: m.conversationId,
        senderUsername: isMe ? user.username : (otherUser?.username ?? 'unknown'),
        senderNickname: isMe ? user.nickname : (otherUser?.nickname ?? null),
        senderPfpUrl: isMe
          ? (user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null)
          : (otherUser?.pfpR2Key ? `/api/assets/pfp/${otherUser.pfpR2Key}` : null),
        recipientUsername: isMe ? (otherUser?.username ?? 'unknown') : user.username,
        messageType: m.messageType as 'text' | 'challenge' | 'system',
        content: m.content,
        metadata: m.metadata,
        readAt: m.readAt,
        createdAt: m.createdAt,
        status: 'sent',
      }
    })

    return jsonResponse(200, { ok: true, conversationId: convo.id, messages: formatted })
  }

  // List all conversations for the player
  const convos = await db
    .select()
    .from(conversations)
    .where(or(eq(conversations.user1Id, playerId), eq(conversations.user2Id, playerId)))
    .orderBy(desc(conversations.lastMessageAt))
    .all()

  const partnerIds = convos.map((c) => (c.user1Id === playerId ? c.user2Id : c.user1Id))
  const partners = partnerIds.length > 0
    ? await db.select().from(users).all()
    : []
  const partnerMap = new Map(partners.map((p) => [p.playerId, p]))

  const rawList = await Promise.all(
    convos.map(async (c): Promise<ConversationSummary | null> => {
      const partnerId = c.user1Id === playerId ? c.user2Id : c.user1Id
      const p = partnerMap.get(partnerId)
      if (!p) return null

        const lastMsg = await db
          .select()
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, c.id),
              or(
                and(eq(messages.senderId, playerId), eq(messages.deletedBySender, 0)),
                and(eq(messages.recipientId, playerId), eq(messages.deletedByRecipient, 0)),
              ),
            ),
          )
          .orderBy(desc(messages.createdAt))
          .limit(1)
          .get()

        const unreadRows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, c.id),
              eq(messages.recipientId, playerId),
              eq(messages.deletedByRecipient, 0),
              isNull(messages.readAt),
            ),
          )
          .all()

        const partnerMsgRows = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              eq(messages.conversationId, c.id),
              eq(messages.senderId, partnerId),
            ),
          )
          .all()

        const isFirstEverMessage =
          unreadRows.length > 0 &&
          partnerMsgRows.length === 1 &&
          lastMsg !== undefined &&
          lastMsg !== null &&
          lastMsg.senderId === partnerId

        return {
          id: c.id,
          lastMessageAt: c.lastMessageAt,
          partner: {
            username: p.username,
            nickname: p.nickname,
            pfpUrl: p.pfpR2Key ? `/api/assets/pfp/${p.pfpR2Key}` : null,
            flags: p.flags,
          },
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                senderUsername: lastMsg.senderId === playerId ? user.username : p.username,
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount: unreadRows.length,
          hasUnread: unreadRows.length > 0,
          isFirstEverMessage,
        }
      }),
    )
    const list = rawList.filter((c): c is ConversationSummary => c !== null)

    return jsonResponse(200, { ok: true, conversations: list })
  }

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId: senderPlayerId } = await identifyPlayer(request, store)
  if (!senderPlayerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const sender = await db.select().from(users).where(eq(users.playerId, senderPlayerId)).get()
  if (!sender) {
    return badRequest('unauthorized')
  }

  if (hasFlag(sender.flags, UserFlags.USER_MESSAGES_BLOCKED)) {
    return jsonResponse(403, { ok: false, error: 'Your messaging privileges have been suspended.' })
  }

  const body = (await readJsonBody(request)) as {
    recipientUsername?: string
    content?: string
    messageType?: 'text' | 'challenge'
    challengeData?: { gameSlug: string; targetScore: number; bountyCandy?: number }
  } | null

  if (!body?.recipientUsername || !body.content) {
    return badRequest('recipientUsername and content are required')
  }

  const targetUsername = body.recipientUsername.toLowerCase()
  const recipient = await db.select().from(users).where(eq(users.username, targetUsername)).get()
  if (!recipient) {
    return badRequest('recipient not found')
  }

  if (hasFlag(recipient.flags, UserFlags.TEST_ACCOUNT)) {
    return jsonResponse(400, { ok: false, error: 'This account cannot receive messages.', isTestAccount: true })
  }

  // Block check: If either user blocked the other, immediately fail
  const blockCheck = await db
    .select()
    .from(friendships)
    .where(
      and(
        eq(friendships.status, 'blocked'),
        or(
          and(eq(friendships.requesterId, senderPlayerId), eq(friendships.addresseeId, recipient.playerId)),
          and(eq(friendships.requesterId, recipient.playerId), eq(friendships.addresseeId, senderPlayerId)),
        ),
      ),
    )
    .get()

  if (blockCheck) {
    return jsonResponse(403, { ok: false, error: 'You cannot message this player.' })
  }

  const nowSeconds = Math.floor(Date.now() / 1000)

  // Rate Limiting: 1 per second, 8 per 10 seconds
  const oneSecAgo = nowSeconds - 1
  const tenSecAgo = nowSeconds - 10

  const recentMsgs = await db
    .select()
    .from(messages)
    .where(and(eq(messages.senderId, senderPlayerId), gte(messages.createdAt, tenSecAgo)))
    .all()

  const msgsLastSec = recentMsgs.filter((m) => m.createdAt >= oneSecAgo).length
  if (msgsLastSec >= 1) {
    return jsonResponse(429, { ok: false, error: 'Rate limit: 1 msg/sec', cooldown: 1 })
  }

  if (recentMsgs.length >= 8) {
    return jsonResponse(429, { ok: false, error: 'Rate limit: 8 msgs/10s', cooldown: 5 })
  }

  // Handle Challenge Bounty escrow if challenge
  let challengeMetadataStr: string | null = null
  if (body.messageType === 'challenge' && body.challengeData) {
    const bounty = Math.max(0, Math.floor(body.challengeData.bountyCandy || 0))
    if (bounty > 0) {
      const senderPlayer = await db.select().from(players).where(eq(players.id, senderPlayerId)).get()
      if (!senderPlayer || senderPlayer.candy < bounty) {
        return jsonResponse(400, { ok: false, error: 'Insufficient candy for this bounty.' })
      }
      await db
        .update(players)
        .set({ candy: senderPlayer.candy - bounty })
        .where(eq(players.id, senderPlayerId))
        .run()
    }

    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await db
      .insert(challenges)
      .values({
        id: challengeId,
        gameSlug: body.challengeData.gameSlug,
        challengerId: senderPlayerId,
        challengedId: recipient.playerId,
        targetScore: body.challengeData.targetScore,
        bountyCandy: bounty,
        status: 'pending',
        createdAt: nowSeconds,
      })
      .run()

    challengeMetadataStr = JSON.stringify({
      challengeId,
      gameSlug: body.challengeData.gameSlug,
      targetScore: body.challengeData.targetScore,
      bountyCandy: bounty,
      status: 'pending',
      challengerUsername: sender.username,
      challengedUsername: recipient.username,
    })
  }

  // Find or create conversation
  let convo = await db
    .select()
    .from(conversations)
    .where(
      or(
        and(eq(conversations.user1Id, senderPlayerId), eq(conversations.user2Id, recipient.playerId)),
        and(eq(conversations.user1Id, recipient.playerId), eq(conversations.user2Id, senderPlayerId)),
      ),
    )
    .get()

  if (!convo) {
    const newConvoId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    await db
      .insert(conversations)
      .values({
        id: newConvoId,
        user1Id: senderPlayerId,
        user2Id: recipient.playerId,
        lastMessageAt: nowSeconds,
        createdAt: nowSeconds,
      })
      .run()
    convo = { id: newConvoId, user1Id: senderPlayerId, user2Id: recipient.playerId, lastMessageAt: nowSeconds, createdAt: nowSeconds }
  } else {
    await db
      .update(conversations)
      .set({ lastMessageAt: nowSeconds })
      .where(eq(conversations.id, convo.id))
      .run()
  }

  const messageId = `m_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  await db
    .insert(messages)
    .values({
      id: messageId,
      conversationId: convo.id,
      senderId: senderPlayerId,
      recipientId: recipient.playerId,
      messageType: body.messageType || 'text',
      content: body.content.slice(0, 1000),
      metadata: challengeMetadataStr,
      createdAt: nowSeconds,
    })
    .run()

  const result: DirectMessage = {
    id: messageId,
    conversationId: convo.id,
    senderUsername: sender.username,
    senderNickname: sender.nickname,
    senderPfpUrl: sender.pfpR2Key ? `/api/assets/pfp/${sender.pfpR2Key}` : null,
    recipientUsername: recipient.username,
    messageType: (body.messageType || 'text') as 'text' | 'challenge',
    content: body.content,
    metadata: challengeMetadataStr,
    createdAt: nowSeconds,
    status: 'sent',
  }

  return jsonResponse(200, { ok: true, message: result })
}
