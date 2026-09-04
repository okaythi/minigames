import {
  ChatSendCode,
  classifyChatFailure,
  parseConversationListWire,
  parseMessagePageWire,
  parseRejectWire,
  parseSendReceiptWire,
} from '../../../shared/chat-protocol'
import type {
  ChatSendReceiptWire,
  ChatSendRequest,
  ConversationSummaryWire,
  MessagePageWire,
} from '../../../shared/chat-protocol'
import { ChatTransportError } from './interfaces'
import type { ChatTransportInterface } from './interfaces'
import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_SEND_TIMEOUT_MS,
} from './types'

/**
 * The only module in the engine that touches `fetch`. Everything it returns
 * has passed a parse guard; everything it rejects is a ChatTransportError
 * with a stable code + failure class. No UI logic, no state, no caching —
 * one call, one parsed result.
 */
export class HttpChatTransport implements ChatTransportInterface {
  public constructor(
    private readonly requestTimeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
    private readonly sendTimeoutMs: number = DEFAULT_SEND_TIMEOUT_MS,
  ) {}

  public async listConversations(): Promise<readonly ConversationSummaryWire[]> {
    const payload = await this.request('GET', '/api/messages', this.requestTimeoutMs)
    const parsed = parseConversationListWire(payload)
    if (parsed === null) {
      throw this.parseFailure()
    }
    return parsed
  }

  public async fetchMessages(partner: string): Promise<MessagePageWire> {
    const url = `/api/messages?recipient=${encodeURIComponent(partner)}`
    const payload = await this.request('GET', url, this.requestTimeoutMs)
    const parsed = parseMessagePageWire(payload)
    if (parsed === null) {
      throw this.parseFailure()
    }
    return parsed
  }

  public async send(request: ChatSendRequest): Promise<ChatSendReceiptWire> {
    const payload = await this.request(
      'POST',
      '/api/messages',
      this.sendTimeoutMs,
      JSON.stringify(request),
    )
    const receipt = parseSendReceiptWire(payload)
    if (receipt === null) {
      throw this.parseFailure()
    }
    return receipt
  }

  private parseFailure(): ChatTransportError {
    return new ChatTransportError({
      message: 'Malformed response from the edge',
      failure: 'transient',
      code: ChatSendCode.Server,
    })
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    timeoutMs: number,
    body?: string,
  ): Promise<unknown> {
    const controller = new AbortController()
    const timer = globalThis.setTimeout(() => {
      controller.abort()
    }, timeoutMs)
    let response: Response
    try {
      response = await fetch(path, {
        method,
        credentials: 'same-origin',
        ...(body !== undefined
          ? { headers: { 'content-type': 'application/json' }, body }
          : {}),
        signal: controller.signal,
      })
    } catch (cause) {
      throw new ChatTransportError({
        message: cause instanceof Error ? cause.message : 'Network request failed',
        failure: 'transient',
        code: ChatSendCode.Network,
      })
    } finally {
      globalThis.clearTimeout(timer)
    }

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    if (!response.ok) {
      throw this.httpFailure(response.status, payload)
    }
    if (payload === null) {
      throw this.parseFailure()
    }
    return payload
  }

  private httpFailure(status: number, payload: unknown): ChatTransportError {
    const reject = parseRejectWire(payload)
    const code = reject?.code ?? statusToCode(status)
    return new ChatTransportError({
      message: reject?.error ?? `HTTP ${status}`,
      failure: classifyChatFailure(code),
      code,
      retryAfterSeconds: reject?.cooldown ?? null,
    })
  }
}

function statusToCode(status: number): ChatSendCode {
  if (status === 401) return ChatSendCode.Unauthorized
  if (status === 403) return ChatSendCode.Blocked
  if (status === 429) return ChatSendCode.RateLimited
  if (status >= 500) return ChatSendCode.Server
  return ChatSendCode.BadPayload
}
