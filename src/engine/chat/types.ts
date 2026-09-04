import type { ChallengeDraftWire, ConversationSummaryWire, DirectMessageWire } from '../../../shared/chat-protocol'

/** A list row with local truth overlaid (e.g. unread cleared on read). */
export interface ConversationWithLocalState {
  readonly wire: ConversationSummaryWire
  readonly unreadCount: number
}
import type { ChatSendCode } from '../../../shared/chat-protocol'

export type { ChatSendCode }

/**
 * A rendered chat row. Either a confirmed server row (`wire`), a local
 * envelope in flight or parked (`outbound`) — never both, because acked
 * envelopes are removed on receipt merge.
 */
export interface ChatMessageView {
  readonly id: string
  readonly wire: DirectMessageWire | null
  readonly outbound: OutboundEnvelope | null
}

/**
 * Normalized handle used as the key of every per-conversation map.
 * The ONLY way conversation state is addressed — leaks between chats become
 * structurally impossible because nothing is shared across keys.
 */
export type PartnerKey = string

export function partnerKey(username: string): PartnerKey {
  return username.trim().toLowerCase()
}

export type ConversationLoadStatus = 'cold' | 'loading' | 'ready' | 'error'

/** A persistent, per-conversation notice (a policy rejection, etc.). */
export interface ChatBanner {
  readonly code: ChatSendCode
  readonly text: string
  readonly shownAtMs: number
}

/**
 * The lifecycle of an outbound message. Discriminated union: the UI renders
 * one thing per `kind`, retry policy is decided by `kind`, never by parsing
 * strings.
 */
export type OutboundState =
  | { readonly kind: 'queued' }
  | { readonly kind: 'sending'; readonly attempt: number }
  | {
      readonly kind: 'retry-scheduled'
      readonly attempt: number
      readonly nextAttemptAtMs: number
      readonly reason: string
    }
  | { readonly kind: 'rejected'; readonly code: ChatSendCode; readonly reason: string }

export interface OutboundEnvelope {
  readonly clientMessageId: string
  readonly partner: PartnerKey
  /** Original display name as typed, for stable render keys and receipts. */
  readonly partnerName: string
  readonly content: string
  readonly messageType: 'text' | 'challenge'
  readonly challenge?: ChallengeDraftWire
  readonly createdAtSeconds: number
  readonly state: OutboundState
}

/** Everything the engine knows about one conversation. Immutable views. */
export interface ConversationView {
  readonly key: PartnerKey
  readonly partner: string
  readonly nickname: string | null
  readonly pfpUrl: string | null
  readonly flags: number
  readonly status: ConversationLoadStatus
  readonly loadError: string | null
  readonly messages: readonly ChatMessageView[]
  readonly draft: string
  readonly banner: ChatBanner | null
  readonly cooldownSecondsLeft: number
  readonly queuedCount: number
  readonly unreadCount: number
  readonly lastMessageAt: number
  readonly lastMessage: ConversationSummaryWire['lastMessage']
  readonly isOutboundInFlight: boolean
}

export interface ChatSnapshot {
  /** Bumped on every state change; powers cheap reference equality upstream. */
  readonly revision: number
  readonly panelOpen: boolean
  readonly activeKey: PartnerKey | null
  readonly listStatus: 'cold' | 'loading' | 'ready'
  readonly conversations: readonly ConversationView[]
  readonly totalUnread: number
  readonly totalQueued: number
}

export interface ChatTransportConfig {
  readonly requestTimeoutMs: number
  readonly sendTimeoutMs: number
}

export const DEFAULT_REQUEST_TIMEOUT_MS = 8000
export const DEFAULT_SEND_TIMEOUT_MS = 15000
