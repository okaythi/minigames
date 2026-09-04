import { ChatSendCode } from '../../../shared/chat-protocol'
import type { ChatFailureClass } from '../../../shared/chat-protocol'
import { ChatTransportError } from './interfaces'

/**
 * UI copy for every stable failure code lives HERE, nowhere else: components
 * render `reason` strings, they never branch on message text, and the server
 * never needs to send copy back for a code it knows.
 */
const CODE_COPY: Readonly<Partial<Record<ChatSendCode, string>>> = {
  [ChatSendCode.Unauthorized]: 'Your session expired — sign in again to send or receive.',
  [ChatSendCode.BadPayload]: 'The message was rejected by the server.',
  [ChatSendCode.SenderSuspended]: 'Your messaging privileges have been suspended.',
  [ChatSendCode.RecipientNotFound]: 'That player could not be found.',
  [ChatSendCode.RecipientUnreachable]: 'This account cannot receive messages.',
  [ChatSendCode.Blocked]: 'You cannot message this player.',
  [ChatSendCode.InsufficientBounty]: 'Not enough candy to cover this bounty.',
  [ChatSendCode.Server]: 'The edge hiccupped. The message will be retried automatically.',
  [ChatSendCode.Network]: 'No connection. The message stays queued until it goes through.',
}

export function reasonForCode(code: ChatSendCode, serverText?: string): string {
  const fallback = CODE_COPY[code]
  if (fallback !== undefined) return fallback
  if (serverText !== undefined && serverText.length > 0) return serverText
  return 'Message could not be delivered.'
}

export interface NormalizedFailure {
  readonly code: ChatSendCode
  readonly class: ChatFailureClass
  readonly reason: string
  readonly retryAfterSeconds: number | null
}

/** Every thrown value that escapes the transport becomes this shape. */
export function normalizeFailure(error: unknown): NormalizedFailure {
  if (error instanceof ChatTransportError) {
    return {
      code: error.code,
      class: error.failure,
      reason: reasonForCode(error.code, error.message),
      retryAfterSeconds: error.retryAfterSeconds,
    }
  }
  return {
    code: ChatSendCode.Network,
    class: 'transient',
    reason: reasonForCode(ChatSendCode.Network),
    retryAfterSeconds: null,
  }
}
