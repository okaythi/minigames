import type {
  ChatSendReceiptWire,
  ChatSendRequest,
  ConversationSummaryWire,
  ChatSendCode,
  ChatFailureClass,
  MessagePageWire,
} from '../../../shared/chat-protocol'
import type { ChatSnapshot, ConversationWithLocalState, OutboundEnvelope } from './types'

/**
 * Ports the engine depends on. Nothing here imports React, auth, friends or
 * flags — the engine consumes abstractions, the boot layer wires reality.
 */

export interface ClockInterface {
  readonly now: () => number
  readonly schedule: (callback: () => void, delayMs: number) => number
  readonly cancel: (handle: number) => void
}

export interface PersistenceInterface {
  loadDrafts: () => Readonly<Record<string, string>>
  saveDrafts: (drafts: Readonly<Record<string, string>>) => void
  loadOutbox: () => readonly OutboundEnvelope[]
  saveOutbox: (envelopes: readonly OutboundEnvelope[]) => void
}

/** The single failure type that crosses the transport boundary. */
export class ChatTransportError extends Error {
  public readonly failure: ChatFailureClass
  public readonly code: ChatSendCode
  /** For rate-limited failures: whole seconds the server asked us to wait. */
  public readonly retryAfterSeconds: number | null

  public constructor(args: {
    message: string
    failure: ChatFailureClass
    code: ChatSendCode
    retryAfterSeconds?: number | null
  }) {
    super(args.message)
    this.name = 'ChatTransportError'
    this.failure = args.failure
    this.code = args.code
    this.retryAfterSeconds = args.retryAfterSeconds ?? null
  }
}

export interface ChatTransportInterface {
  readonly listConversations: () => Promise<readonly ConversationSummaryWire[]>
  readonly fetchMessages: (partner: string) => Promise<MessagePageWire>
  readonly send: (request: ChatSendRequest) => Promise<ChatSendReceiptWire>
}

export interface ChatSnapshotReaderInterface {
  readonly getSnapshot: () => ChatSnapshot
  readonly subscribe: (listener: () => void) => () => void
}

/** Read-only surface the engine exposes to *other* engines (notifications). */
export interface ChatListSourceInterface {
  readonly getConversations: () => readonly ConversationWithLocalState[]
  readonly refreshConversations: (force?: boolean) => Promise<readonly ConversationWithLocalState[]>
}
