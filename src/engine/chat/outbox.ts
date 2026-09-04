import type { ChatSendRequest } from '../../../shared/chat-protocol'
import { normalizeFailure } from './errors'
import type { ClockInterface, ChatTransportInterface, PersistenceInterface } from './interfaces'
import { partnerKey } from './types'
import type { OutboundEnvelope, PartnerKey } from './types'
import type { ChatStore } from './store'

export interface OutboxConfig {
  readonly maxAttempts: number
  readonly retryBackoffBaseMs: number
}

export const DEFAULT_OUTBOX_CONFIG: OutboxConfig = {
  maxAttempts: 4,
  retryBackoffBaseMs: 1500,
}

let envelopeCounter = 0

function makeClientMessageId(nowMs: number): string {
  envelopeCounter += 1
  return `c_${nowMs.toString(36)}_${envelopeCounter.toString(36)}`
}

/**
 * The outbound side of the engine: one queue per conversation, strict
 * per-conversation sequencing (the edge allows 1 msg/sec anyway), auto-retry
 * with exponential backoff for transient failures, rate-limit parking, and
 * terminal parking + banner for policy rejections.
 *
 * Everything is keyed by PartnerKey — a queued message for one partner is
 * incapable of draining into another conversation, and a rejection for one
 * conversation can never paint another conversation's transcript.
 */
export class ChatOutbox {
  private readonly drainTimers = new Map<PartnerKey, number>()
  private readonly sending = new Set<PartnerKey>()
  private paused = true

  public constructor(
    private readonly deps: {
      readonly store: ChatStore
      readonly transport: ChatTransportInterface
      readonly clock: ClockInterface
      readonly persistence: PersistenceInterface
      readonly config: OutboxConfig
      readonly onAuthRequired: () => void
    },
  ) {}

  public setPaused(paused: boolean): void {
    this.paused = paused
    if (!paused) {
      for (const [key] of this.drainablePartners()) {
        void this.drain(key)
      }
    }
  }

  public enqueue(args: {
    readonly partnerName: string
    readonly content: string
    readonly messageType: 'text' | 'challenge'
    readonly challenge?: ChatSendRequest['challengeData']
  }): OutboundEnvelope {
    const partner = partnerKey(args.partnerName)
    const nowMs = this.deps.clock.now()
    const envelope: OutboundEnvelope = {
      clientMessageId: makeClientMessageId(nowMs),
      partner,
      partnerName: args.partnerName,
      content: args.content,
      messageType: args.messageType,
      ...(args.challenge !== undefined ? { challenge: args.challenge } : {}),
      createdAtSeconds: Math.floor(nowMs / 1000),
      state: { kind: 'queued' },
    }
    this.deps.store.upsertEnvelope(envelope)
    this.persist()
    if (!this.paused) void this.drain(partner)
    return envelope
  }

  /** Manual retry for an exhausted/failed send. */
  public retry(clientMessageId: string): void {
    const found = this.findEnvelope(clientMessageId)
    if (found === null) return
    const { key } = found
    this.deps.store.patchEnvelope(key, clientMessageId, (env) => ({
      ...env,
      state: { kind: 'queued' },
    }))
    // Clear the per-chat notice if this was the chat's only rejection.
    this.persist()
    if (!this.paused) void this.drain(key)
  }

  /** "Send anyway": drop the rejected envelope, queue a fresh attempt. */
  public resend(clientMessageId: string): void {
    const found = this.findEnvelope(clientMessageId)
    if (found === null) return
    const { envelope, key } = found
    this.deps.store.removeEnvelope(key, clientMessageId)
    this.enqueue({
      partnerName: envelope.partnerName,
      content: envelope.content,
      messageType: envelope.messageType,
      ...(envelope.challenge !== undefined ? { challenge: envelope.challenge } : {}),
    })
  }

  public dismiss(clientMessageId: string): void {
    const found = this.findEnvelope(clientMessageId)
    if (found === null) return
    this.deps.store.removeEnvelope(found.key, clientMessageId)
    this.persist()
  }

  /** Called when a rate-limit window should open; also (re)schedules the drain. */
  public armCooldown(key: PartnerKey, seconds: number): void {
    const until = this.deps.clock.now() + Math.max(1, seconds) * 1000
    this.deps.store.setCooldownUntil(key, until)
    this.schedule(key, until)
  }

  public hydrate(): void {
    for (const env of this.deps.persistence.loadOutbox()) {
      this.deps.store.upsertEnvelope({ ...env, partner: partnerKey(env.partner) })
    }
    if (!this.paused) {
      for (const [key] of this.drainablePartners()) {
        void this.drain(key)
      }
    }
  }

  public dispose(): void {
    for (const timer of this.drainTimers.values()) {
      this.deps.clock.cancel(timer)
    }
    this.drainTimers.clear()
  }

  private drainablePartners(): ReadonlyMap<PartnerKey, number> {
    const map = new Map<PartnerKey, number>()
    const records = this.deps.store.recordsView()
    for (const [key, record] of records) {
      if (record.envelopes.some((e) => e.state.kind !== 'rejected')) map.set(key, 0)
    }
    return map
  }

  private findEnvelope(clientMessageId: string): { key: PartnerKey; envelope: OutboundEnvelope } | null {
    for (const [key, record] of this.deps.store.recordsView()) {
      const envelope = record.envelopes.find((e) => e.clientMessageId === clientMessageId)
      if (envelope !== undefined) return { key, envelope }
    }
    return null
  }

  private async drain(key: PartnerKey): Promise<void> {
    if (this.paused || this.sending.has(key)) return
    const record = this.deps.store.recordOf(key)
    if (record === undefined) return
    const now = this.deps.clock.now()

    if (record.cooldownUntilMs > now) {
      this.schedule(key, record.cooldownUntilMs)
      return
    }

    const due = record.envelopes.find((env) => {
      if (env.state.kind === 'queued') return true
      if (env.state.kind === 'retry-scheduled') return env.state.nextAttemptAtMs <= now
      return false
    })
    // Nothing to do right now — but NEVER cancel a pending backoff timer:
    // the finally-chain calls drain after every outcome, and clearing here
    // would silently disarm the retry it just scheduled.
    if (due === undefined) return
    this.cancelTimer(key)

    this.sending.add(key)
    const attemptBase = due.state.kind === 'retry-scheduled' ? due.state.attempt : 0
    this.deps.store.patchEnvelope(key, due.clientMessageId, (env) => ({
      ...env,
      state: { kind: 'sending', attempt: attemptBase },
    }))

    try {
      const receipt = await this.deps.transport.send({
        recipientUsername: record.partner,
        content: due.content,
        messageType: due.messageType,
        ...(due.challenge !== undefined ? { challengeData: due.challenge } : {}),
        clientMessageId: due.clientMessageId,
      })
      // Merge FIRST (store dedupes the optimistic copy against the echoed
      // clientMessageId), then remove the envelope — no duplicate flash.
      this.deps.store.appendMessage(key, record.partner, receipt.message)
      this.deps.store.removeEnvelope(key, due.clientMessageId)
      this.deps.store.setBanner(key, record.partner, null)
      this.deps.store.clearCooldown(key)
      // Client-side pacing: the edge enforces 1 msg/sec; arming a short
      // cooldown makes a multi-message burst queue-and-flow instead of
      // provoking a 429 round-trip per message.
      const stillQueued = (this.deps.store.recordOf(key)?.envelopes ?? []).some(
        (e) => e.state.kind === 'queued' || e.state.kind === 'retry-scheduled',
      )
      if (stillQueued) this.armCooldown(key, 1)
    } catch (error) {
      this.handleFailure(key, record.partner, due, attemptBase, normalizeFailure(error))
    } finally {
      this.sending.delete(key)
      this.persist()
      void this.drain(key)
    }
  }

  private handleFailure(
    key: PartnerKey,
    partnerName: string,
    env: OutboundEnvelope,
    attemptBase: number,
    failure: ReturnType<typeof normalizeFailure>,
  ): void {
    const now = this.deps.clock.now()
    const attempt = attemptBase + 1

    if (failure.class === 'rate') {
      this.deps.store.patchEnvelope(key, env.clientMessageId, (e) => ({ ...e, state: { kind: 'queued' } }))
      this.armCooldown(key, failure.retryAfterSeconds ?? 5)
      return
    }

    if (failure.class === 'transient' && attempt < this.deps.config.maxAttempts) {
      const delay = this.deps.config.retryBackoffBaseMs * 2 ** (attempt - 1)
      this.deps.store.patchEnvelope(key, env.clientMessageId, (e) => ({
        ...e,
        state: {
          kind: 'retry-scheduled',
          attempt,
          nextAttemptAtMs: now + delay,
          reason: failure.reason,
        },
      }))
      this.schedule(key, now + delay)
      return
    }

    if (failure.class === 'auth') {
      this.deps.onAuthRequired()
    }

    // Terminal for this attempt burst: mark the envelope rejected and park
    // every sibling in this conversation (a doomed partner stays parked, but
    // only inside its own chat).
    this.deps.store.patchEnvelope(key, env.clientMessageId, (e) => ({
      ...e,
      state: { kind: 'rejected', code: failure.code, reason: failure.reason },
    }))
    if (failure.class === 'policy' || failure.class === 'auth') {
      this.deps.store.rejectAllQueued(
        key,
        failure.code,
        failure.class === 'auth'
          ? 'Sign in again to deliver queued messages.'
          : failure.reason,
      )
      this.deps.store.setBanner(key, partnerName, {
        code: failure.code,
        text: failure.reason,
        shownAtMs: now,
      })
    }
  }

  private schedule(key: PartnerKey, atMs: number): void {
    this.cancelTimer(key)
    const delay = Math.max(0, atMs - this.deps.clock.now())
    const timer = this.deps.clock.schedule(() => {
      this.drainTimers.delete(key)
      void this.drain(key)
    }, delay)
    this.drainTimers.set(key, timer)
  }

  private cancelTimer(key: PartnerKey): void {
    const timer = this.drainTimers.get(key)
    if (timer !== undefined) {
      this.deps.clock.cancel(timer)
      this.drainTimers.delete(key)
    }
  }

  private persist(): void {
    const envelopes: OutboundEnvelope[] = []
    for (const record of this.deps.store.recordsView().values()) {
      envelopes.push(...record.envelopes)
    }
    this.deps.persistence.saveOutbox(envelopes)
  }
}
