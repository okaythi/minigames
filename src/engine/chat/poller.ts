import { normalizeFailure } from './errors'
import type { ChatTransportInterface, ClockInterface } from './interfaces'
import type { ChatStore } from './store'
import type { PartnerKey } from './types'

export interface PollerConfig {
  readonly baseIntervalMs: number
  readonly maxIntervalMs: number
  /** Re-poll on tab-return only if the last successful poll is older than this. */
  readonly staleAfterMs: number
}

export const DEFAULT_POLLER_CONFIG: PollerConfig = {
  baseIntervalMs: 6_000,
  maxIntervalMs: 30_000,
  staleAfterMs: 2_000,
}

/**
 * Polls exactly ONE conversation — the one the drawer is looking at — and
 * only while it may. Rules, in order of importance:
 *
 *  1. Hidden tab or no active conversation: zero requests, full stop.
 *  2. Healthy: fixed `baseIntervalMs` cadence (fluid feel while watching).
 *  3. Failing: exponential backoff 6s → 12s → 24s → capped at 30s. Broken
 *     connectivity or a hammering client costs nothing extra at the edge.
 *  4. Coming back to a stale tab or a ping hint: one immediate poll, then
 *     back to cadence.
 *
 * Every fetch carries a generation token; a response for a conversation the
 * user navigated away from is discarded instead of leaking into the new view.
 */
export class ConversationPoller {
  private key: PartnerKey | null = null
  private partnerName = ''
  private timer: number | null = null
  private failures = 0
  private suspended = false
  private generation = 0

  public constructor(
    private readonly deps: {
      readonly transport: ChatTransportInterface
      readonly store: ChatStore
      readonly clock: ClockInterface
      readonly config: PollerConfig
      readonly onAuthExpired: () => void
    },
  ) {}

  public attach(key: PartnerKey, partnerName: string): void {
    if (this.key === key) return
    this.detach()
    this.key = key
    this.partnerName = partnerName
    this.failures = 0
    void this.tick()
  }

  public detach(): void {
    this.generation += 1
    this.key = null
    this.partnerName = ''
    this.failures = 0
    this.clearTimer()
  }

  public setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return
    this.suspended = suspended
    if (suspended) {
      this.clearTimer()
      return
    }
    // Returning to a tab: one immediate catch-up poll if the data is stale,
    // then resume cadence. (No delay-theater on coming back.)
    const record = this.key === null ? undefined : this.deps.store.recordOf(this.key)
    const stale =
      record === undefined || this.deps.clock.now() - record.lastPolledAtMs > this.deps.config.staleAfterMs
    void (stale ? this.tick() : this.arm())
  }

  /** External nudge (badge-count hint said "new message"): poll now. */
  public kick(): void {
    if (this.key !== null && !this.suspended) void this.tick()
  }

  public dispose(): void {
    this.detach()
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      this.deps.clock.cancel(this.timer)
      this.timer = null
    }
  }

  private arm(): void {
    this.clearTimer()
    const backoff = Math.min(
      this.deps.config.maxIntervalMs,
      this.deps.config.baseIntervalMs * 2 ** Math.min(this.failures, 4),
    )
    this.timer = this.deps.clock.schedule(() => {
      this.timer = null
      void this.tick()
    }, backoff)
  }

  private async tick(): Promise<void> {
    if (this.key === null || this.suspended) return
    const { key, partnerName } = this
    const generation = this.generation
    const record = this.deps.store.recordOf(key)
    // Only a first load shows a spinner; background polls never blank the
    // transcript or flicker a loading state.
    if (record === undefined || record.status === 'cold') {
      this.deps.store.setStatus(key, partnerName, 'loading', null)
    }
    try {
      const page = await this.deps.transport.fetchMessages(partnerName)
      if (generation !== this.generation || this.key !== key) return
      this.failures = 0
      this.deps.store.replaceMessages(key, partnerName, page.messages, page.conversationId, this.deps.clock.now())
      // Fetching a window marks it read server-side; mirror that locally so
      // the unread badge never waits for a list round-trip.
      this.deps.store.markReadLocal(key)
    } catch (error) {
      if (generation !== this.generation || this.key !== key) return
      const failure = normalizeFailure(error)
      this.failures += 1
      if (failure.class === 'auth') {
        this.deps.onAuthExpired()
      }
      this.deps.store.setStatus(
        key,
        partnerName,
        'error',
        failure.class === 'transient' ? null : failure.reason,
      )
    }
    this.arm()
  }
}
