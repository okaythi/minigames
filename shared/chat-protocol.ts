/**
 * Chat wire protocol — the single contract between the Pages Function
 * (`functions/api/messages`) and the client-side chat engine.
 *
 * Rule of the house: nothing in the UI matches on human-readable error text.
 * Policy decisions travel as stable codes; copy lives on the client. Parsing
 * uses "parse, don't validate" guards so a malformed edge response degrades
 * to a typed failure instead of a runtime landmine.
 */

export type ChatMessageType = 'text' | 'challenge' | 'system'

/** One stored message, exactly as `functions/api/messages` emits it. */
export interface DirectMessageWire {
  readonly id: string
  readonly conversationId: string
  readonly senderUsername: string
  readonly senderNickname: string | null
  readonly senderPfpUrl: string | null
  readonly recipientUsername: string
  readonly messageType: ChatMessageType
  readonly content: string
  /** JSON string; for text messages it carries `{ clientMessageId }`. */
  readonly metadata: string | null
  readonly readAt: number | null
  readonly createdAt: number
}

export interface ConversationPartnerWire {
  readonly username: string
  readonly nickname: string | null
  readonly pfpUrl: string | null
  /** Bitmask from `shared/flags`; rendering/formatting only, never policy. */
  readonly flags: number
}

export interface ConversationSummaryWire {
  readonly id: string
  readonly lastMessageAt: number
  readonly partner: ConversationPartnerWire
  readonly lastMessage: {
    readonly content: string
    readonly senderUsername: string
    readonly createdAt: number
  } | null
  readonly unreadCount: number
  readonly hasUnread: boolean
  readonly isFirstEverMessage: boolean
}

export interface ChallengeMetadataWire {
  readonly challengeId: string
  readonly gameSlug: string
  readonly targetScore: number
  readonly bountyCandy: number
  readonly status: 'pending' | 'accepted' | 'completed' | 'declined' | 'expired'
  readonly challengerUsername: string
  readonly challengedUsername: string
  readonly winnerUsername?: string | null
  readonly clientMessageId?: string
}

export interface ChallengeDraftWire {
  readonly gameSlug: string
  readonly targetScore: number
  readonly bountyCandy: number
}

/* ------------------------------------------------------------------ */
/* Failure taxonomy                                                    */
/* ------------------------------------------------------------------ */

/**
 * Stable, machine-readable reasons a send or read can fail. The server emits
 * these; the client maps every code to exactly one failure class so retry
 * policy is data, not scattered conditionals.
 */
export const ChatSendCode = {
  /** Not signed in / session cookie rejected. */
  Unauthorized: 'unauthorized',
  /** Malformed or missing fields. */
  BadPayload: 'bad_payload',
  /** Sender carries USER_MESSAGES_BLOCKED. */
  SenderSuspended: 'sender_suspended',
  /** Recipient account does not exist. */
  RecipientNotFound: 'recipient_not_found',
  /** Recipient carries TEST_ACCOUNT: DMs are closed to it by policy. */
  RecipientUnreachable: 'recipient_unreachable',
  /** Either party blocked the other. */
  Blocked: 'blocked',
  /** Server bounty escrow refused. */
  InsufficientBounty: 'insufficient_bounty',
  /** 1/sec or 8/10s limiter tripped; retry scheduled from `cooldownSeconds`. */
  RateLimited: 'rate_limited',
  /** 5xx or unparseable edge response. */
  Server: 'server',
  /** fetch() never completed (offline, aborted, timeout). */
  Network: 'network',
} as const

export type ChatSendCode = (typeof ChatSendCode)[keyof typeof ChatSendCode]

/**
 * `transient` — the engine retries automatically with backoff.
 * `policy`    — terminal; queued messages to this partner are parked so no
 *               doomed send is repeated. `rate` parks until the cooldown
 *               expires. `auth` parks and asks the shell to re-sign-in.
 */
export type ChatFailureClass = 'transient' | 'policy' | 'rate' | 'auth'

const FAILURE_CLASS_BY_CODE: Readonly<Partial<Record<ChatSendCode, ChatFailureClass>>> = {
  [ChatSendCode.Unauthorized]: 'auth',
  [ChatSendCode.BadPayload]: 'policy',
  [ChatSendCode.SenderSuspended]: 'policy',
  [ChatSendCode.RecipientNotFound]: 'policy',
  [ChatSendCode.RecipientUnreachable]: 'policy',
  [ChatSendCode.Blocked]: 'policy',
  [ChatSendCode.InsufficientBounty]: 'policy',
  [ChatSendCode.RateLimited]: 'rate',
  [ChatSendCode.Server]: 'transient',
  [ChatSendCode.Network]: 'transient',
}

export function classifyChatFailure(code: ChatSendCode): ChatFailureClass {
  return FAILURE_CLASS_BY_CODE[code] ?? 'transient'
}

/* ------------------------------------------------------------------ */
/* Requests & responses                                                */
/* ------------------------------------------------------------------ */

export interface ChatSendRequest {
  readonly recipientUsername: string
  readonly content: string
  readonly messageType: 'text' | 'challenge'
  readonly challengeData?: ChallengeDraftWire
  /**
   * Client-generated id echoed back through `message.metadata`, so in-flight
   * optimistic copies can be reconciled against the server row no matter
   * which response (receipt or poll) lands first.
   */
  readonly clientMessageId: string
}

/** The per-conversation stamp a receipt carries, so the chat list can be
 *  reordered without a follow-up fetch. */
export interface ConversationStampWire {
  readonly id: string
  readonly lastMessageAt: number
}

export interface ChatSendReceiptWire {
  readonly ok: true
  readonly message: DirectMessageWire
  readonly conversation: ConversationStampWire
}

export interface ChatRejectWire {
  readonly ok: false
  readonly code: ChatSendCode
  readonly error?: string
  readonly cooldown?: number
}

export interface MessagePageWire {
  readonly conversationId: string | null
  readonly messages: readonly DirectMessageWire[]
}

/* ------------------------------------------------------------------ */
/* Parse guards                                                        */
/* ------------------------------------------------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null
const optStr = (v: unknown): string | null | undefined =>
  v === null || v === undefined ? null : str(v)
const optNum = (v: unknown): number | null | undefined =>
  v === null || v === undefined ? null : num(v)

export function parseDirectMessageWire(raw: unknown): DirectMessageWire | null {
  if (!isRecord(raw)) return null
  const id = str(raw['id'])
  const conversationId = str(raw['conversationId'])
  const senderUsername = str(raw['senderUsername'])
  const recipientUsername = str(raw['recipientUsername'])
  const messageType = str(raw['messageType'])
  const content = str(raw['content'])
  const createdAt = num(raw['createdAt'])
  const readAt = optNum(raw['readAt'])
  if (
    id === null ||
    conversationId === null ||
    senderUsername === null ||
    recipientUsername === null ||
    content === null ||
    createdAt === null ||
    (messageType !== 'text' && messageType !== 'challenge' && messageType !== 'system')
  ) {
    return null
  }
  return {
    id,
    conversationId,
    senderUsername,
    senderNickname: optStr(raw['senderNickname']) ?? null,
    senderPfpUrl: optStr(raw['senderPfpUrl']) ?? null,
    recipientUsername,
    messageType,
    content,
    metadata: optStr(raw['metadata']) ?? null,
    readAt: readAt ?? null,
    createdAt,
  }
}

export function parseConversationSummaryWire(raw: unknown): ConversationSummaryWire | null {
  if (!isRecord(raw)) return null
  const id = str(raw['id'])
  const lastMessageAt = num(raw['lastMessageAt'])
  const partnerRaw = raw['partner']
  if (id === null || lastMessageAt === null || !isRecord(partnerRaw)) return null
  const username = str(partnerRaw['username'])
  if (username === null) return null
  const lastRaw = raw['lastMessage']
  const lastMessage = isRecord(lastRaw)
    ? {
        content: str(lastRaw['content']) ?? '',
        senderUsername: str(lastRaw['senderUsername']) ?? username,
        createdAt: num(lastRaw['createdAt']) ?? lastMessageAt,
      }
    : null
  return {
    id,
    lastMessageAt,
    partner: {
      username,
      nickname: optStr(partnerRaw['nickname']) ?? null,
      pfpUrl: optStr(partnerRaw['pfpUrl']) ?? null,
      flags: num(partnerRaw['flags']) ?? 0,
    },
    lastMessage,
    unreadCount: num(raw['unreadCount']) ?? 0,
    hasUnread: raw['hasUnread'] === true,
    isFirstEverMessage: raw['isFirstEverMessage'] === true,
  }
}

export function parseConversationListWire(payload: unknown): readonly ConversationSummaryWire[] | null {
  if (!isRecord(payload) || !Array.isArray(payload['conversations'])) return null
  const out: ConversationSummaryWire[] = []
  for (const item of payload['conversations']) {
    const parsed = parseConversationSummaryWire(item)
    if (parsed !== null) out.push(parsed)
  }
  return out
}

export function parseMessagePageWire(payload: unknown): MessagePageWire | null {
  if (!isRecord(payload) || !Array.isArray(payload['messages'])) return null
  const messages: DirectMessageWire[] = []
  for (const item of payload['messages']) {
    const parsed = parseDirectMessageWire(item)
    if (parsed !== null) messages.push(parsed)
  }
  return { conversationId: str(payload['conversationId']), messages }
}

export function parseSendReceiptWire(payload: unknown): ChatSendReceiptWire | null {
  if (!isRecord(payload) || payload['ok'] !== true) return null
  const message = parseDirectMessageWire(payload['message'])
  const convoRaw = payload['conversation']
  if (message === null || !isRecord(convoRaw)) return null
  const convoId = str(convoRaw['id'])
  const lastMessageAt = num(convoRaw['lastMessageAt'])
  if (convoId === null || lastMessageAt === null) return null
  return { ok: true, message, conversation: { id: convoId, lastMessageAt } }
}

export function parseRejectWire(payload: unknown): ChatRejectWire | null {
  if (!isRecord(payload) || payload['ok'] !== false) return null
  const code = str(payload['code'])
  if (code === null || !(code in ChatSendCode)) return null
  const errorText = str(payload['error'])
  const cooldown = num(payload['cooldown'])
  return {
    ok: false,
    code: code as ChatSendCode,
    ...(errorText !== null ? { error: errorText } : {}),
    ...(cooldown !== null ? { cooldown } : {}),
  }
}

export function parseChallengeMetadata(metadata: string | null): ChallengeMetadataWire | null {
  if (metadata === null) return null
  let raw: unknown
  try {
    raw = JSON.parse(metadata)
  } catch {
    return null
  }
  if (!isRecord(raw)) return null
  const challengeId = str(raw['challengeId'])
  const gameSlug = str(raw['gameSlug'])
  const targetScore = num(raw['targetScore'])
  if (challengeId === null || gameSlug === null || targetScore === null) return null
  const status = str(raw['status'])
  const clientMsgId = str(raw['clientMessageId'])
  return {
    challengeId,
    gameSlug,
    targetScore,
    bountyCandy: num(raw['bountyCandy']) ?? 0,
    status:
      status === 'accepted' || status === 'completed' || status === 'declined' || status === 'expired'
        ? status
        : 'pending',
    challengerUsername: str(raw['challengerUsername']) ?? '',
    challengedUsername: str(raw['challengedUsername']) ?? '',
    winnerUsername: optStr(raw['winnerUsername']) ?? null,
    ...(clientMsgId !== null ? { clientMessageId: clientMsgId } : {}),
  }
}

/** Extract the reconciliation id from a text message's metadata, if present. */
export function clientMessageIdOf(metadata: string | null): string | null {
  if (metadata === null) return null
  let raw: unknown
  try {
    raw = JSON.parse(metadata)
  } catch {
    return null
  }
  return isRecord(raw) ? str(raw['clientMessageId']) : null
}
