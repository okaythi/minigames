import type { ConversationRecord } from './store'
import type { ChatMessageView, ConversationView, OutboundEnvelope, PartnerKey } from './types'
import type { DirectMessageWire } from '../../../shared/chat-protocol'

/**
 * Pure derivation: records in, view out. No I/O, no mutation — every render
 * surface (drawer, bell, tests) consumes exactly this projection.
 */

function wireFromEnvelope(env: OutboundEnvelope, meName: string): DirectMessageWire {
  return {
    id: env.clientMessageId,
    conversationId: 'pending',
    senderUsername: meName,
    senderNickname: null,
    senderPfpUrl: null,
    recipientUsername: env.partnerName,
    messageType: env.messageType,
    content: env.content,
    metadata: null,
    readAt: null,
    createdAt: env.createdAtSeconds,
  }
}

function pendingMessagesFrom(record: ConversationRecord): ChatMessageView[] {
  return record.envelopes.map((outbound) => ({
    id: outbound.clientMessageId,
    // The wire copy of a still-unacked message exists only for render; the
    // outbound record is the source of truth (state, reason, attempts).
    wire: wireFromEnvelope(outbound, record.partner),
    outbound,
  }))
}

export function buildConversationView(
  record: ConversationRecord,
  key: PartnerKey,
  nowMs: number,
): ConversationView {
  const pending = pendingMessagesFrom(record)
  const messages: ChatMessageView[] = [
    ...record.serverMessages.map((wire) => ({ id: wire.id, wire, outbound: null }) satisfies ChatMessageView),
    ...pending,
  ].sort((a, b) => (a.wire?.createdAt ?? 0) - (b.wire?.createdAt ?? 0))

  const queuedCount = record.envelopes.filter(
    (e) => e.state.kind === 'queued' || e.state.kind === 'sending' || e.state.kind === 'retry-scheduled',
  ).length
  const cooldownMs = Math.max(0, record.cooldownUntilMs - nowMs)

  return {
    key,
    partner: record.partner,
    nickname: record.nickname,
    pfpUrl: record.pfpUrl,
    flags: record.flags,
    status: record.status,
    loadError: record.loadError,
    messages,
    draft: record.draft,
    banner: record.banner,
    cooldownSecondsLeft: Math.ceil(cooldownMs / 1000),
    queuedCount,
    unreadCount: record.unreadCount,
    lastMessageAt: record.lastMessageAt,
    lastMessage: record.lastMessage ?? (pending.length > 0
      ? (() => {
          const last = record.envelopes[record.envelopes.length - 1]
          return last === undefined
            ? null
            : { content: last.content, senderUsername: record.partner, createdAt: last.createdAtSeconds }
        })()
      : null),
    isOutboundInFlight: record.envelopes.some((e) => e.state.kind === 'sending'),
  }
}
