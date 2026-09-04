import { ChatStore } from './store'
import { ChatOutbox, DEFAULT_OUTBOX_CONFIG } from './outbox'
import { ConversationPoller, DEFAULT_POLLER_CONFIG } from './poller'
import type { OutboxConfig } from './outbox'
import type { PollerConfig } from './poller'
import type {
  ChatListSourceInterface,
  ChatSnapshotReaderInterface,
  ChatTransportInterface,
  ClockInterface,
  PersistenceInterface,
} from './interfaces'
import { partnerKey } from './types'
import type { ChatSnapshot, ConversationWithLocalState } from './types'

export interface ChatEngineConfig {
  readonly listTtlMs: number
  readonly recentSendGuardMs: number
  readonly poller: PollerConfig
  readonly outbox: OutboxConfig
  readonly draftPersistDebounceMs: number
}

export const DEFAULT_ENGINE_CONFIG: ChatEngineConfig = {
  // Same window as the social snapshot cache: boot burst, bell open and
  // drawer open collapse into ONE list fetch.
  listTtlMs: 10_000,
  // A send just re-stamped the list locally; a focus event right after must
  // not pay for a fresh GET.
  recentSendGuardMs: 4_000,
  poller: DEFAULT_POLLER_CONFIG,
  outbox: DEFAULT_OUTBOX_CONFIG,
  draftPersistDebounceMs: 350,
}

export interface ChatEngineDeps {
  readonly transport: ChatTransportInterface
  readonly clock: ClockInterface
  readonly persistence: PersistenceInterface
  readonly config?: Partial<ChatEngineConfig>
}

/**
 * The chat engine orchestrator. Owns the store, the outbox and the poller,
 * and exposes a small typed command surface. It never imports auth,
 * friends, presence or flags — the boot layer wires those signals in
 * (onSignedIn / onSignedOut / applyNewMessageHint / requestSignIn).
 *
 * Request budget per interaction (all endpoints single-flight + TTL):
 *   open drawer            1 list fetch
 *   open a conversation    1 message fetch (+1 every 6s while VISIBLE only)
 *   send                   1 POST, no follow-up fetch (receipt merges)
 *   return to a stale tab  1 message fetch
 *   hidden tab / closed    0
 */
export class ChatEngine implements ChatSnapshotReaderInterface, ChatListSourceInterface {
  private readonly store = new ChatStore()
  private readonly outbox: ChatOutbox
  private readonly poller: ConversationPoller
  private readonly config: ChatEngineConfig
  private listFetchedAtMs = 0
  private listSentAtMs = 0
  private listInflight: Promise<ConversationWithLocalState[]> | null = null
  private draftSaveTimer: number | null = null
  private signedIn = false
  private readonly signInListeners = new Set<() => void>()

  public constructor(private readonly deps: ChatEngineDeps) {
    this.config = { ...DEFAULT_ENGINE_CONFIG, ...(deps.config ?? {}) }
    this.poller = new ConversationPoller({
      transport: deps.transport,
      store: this.store,
      clock: deps.clock,
      config: this.config.poller,
      onAuthExpired: () => {
        for (const listener of this.signInListeners) listener()
      },
    })
    this.outbox = new ChatOutbox({
      store: this.store,
      transport: deps.transport,
      clock: deps.clock,
      persistence: deps.persistence,
      config: this.config.outbox,
      onAuthRequired: () => {
        for (const listener of this.signInListeners) listener()
      },
    })
  }

  /* ---------------------------------------------------------------- */
  /* Reader surface                                                    */
  /* ---------------------------------------------------------------- */

  public getSnapshot = (): ChatSnapshot => this.store.getSnapshot()

  public subscribe = (listener: () => void): (() => void) => this.store.subscribe(listener)

  public subscribeSignInRequired = (listener: () => void): (() => void) => {
    this.signInListeners.add(listener)
    return () => this.signInListeners.delete(listener)
  }

  public getConversations(): readonly ConversationWithLocalState[] {
    return this.mergeListWithLocalState()
  }

  /* ---------------------------------------------------------------- */
  /* Lifecycle                                                         */
  /* ---------------------------------------------------------------- */

  /** Boot: hydrate drafts + unsent outbox. Call once, after auth is known. */
  public start(): void {
    for (const [key, draft] of Object.entries(this.deps.persistence.loadDrafts())) {
      this.store.setDraft(key, key, draft)
    }
    this.outbox.hydrate()
  }

  public onSignedIn(): void {
    this.signedIn = true
    this.outbox.setPaused(false)
    void this.refreshConversations(true)
  }

  public onSignedOut(): void {
    this.signedIn = false
    this.outbox.setPaused(true)
    this.poller.detach()
    this.store.reset()
    this.listFetchedAtMs = 0
    this.listSentAtMs = 0
    this.persistDraftsNow()
  }

  /** Tab visibility: the single most important quota lever — hidden = silent. */
  public setVisibility(visible: boolean): void {
    this.poller.setSuspended(!visible)
    if (visible && this.signedIn && this.store.getSnapshot().panelOpen) {
      void this.refreshConversations()
    }
  }

  /* ---------------------------------------------------------------- */
  /* Panel + conversation navigation                                   */
  /* ---------------------------------------------------------------- */

  public openPanel(): void {
    this.store.setPanelOpen(true)
    void this.refreshConversations()
    this.poller.kick()
  }

  public closePanel(): void {
    this.store.setPanelOpen(false)
    // Stop all polling (quota!), but KEEP which conversation was open —
    // re-opening lands back on the same thread, exactly as before.
    this.poller.detach()
  }

  /**
   * `partnerName === null` returns to the conversation list. The list fetch
   * is usually free here (TTL-fresh from boot or the drawer opening).
   */
  public selectConversation(partnerName: string | null): void {
    if (partnerName === null) {
      this.poller.detach()
      this.store.select(null)
      return
    }
    const key = partnerKey(partnerName)
    void this.refreshConversations()
    this.store.select(key, partnerName)
    this.poller.attach(key, partnerName)
  }

  /* ---------------------------------------------------------------- */
  /* Data flows                                                        */
  /* ---------------------------------------------------------------- */

  /**
   * Single-flight + TTL list refresh shared by the drawer, the bell and the
   * notifications engine: whoever asks first pays for everyone.
   */
  public refreshConversations(force = false): Promise<readonly ConversationWithLocalState[]> {
    if (!this.signedIn) return Promise.resolve([])
    const now = this.deps.clock.now()
    // Fresh either from a recent fetch OR from a recent local send-stamp:
    // the send receipt already re-stamped the list rows, so a focus event
    // right after sending must NOT pay for a GET (within the guard window).
    // Forced refreshes (badge pings) override both windows; single-flight
    // below still keeps them at one request.
    const fresh =
      this.store.getSnapshot().listStatus === 'ready' &&
      (now - this.listFetchedAtMs < this.config.listTtlMs ||
        now - this.listSentAtMs < this.config.recentSendGuardMs)
    if (!force && fresh) return Promise.resolve(this.mergeListWithLocalState())
    if (this.listInflight !== null) return this.listInflight

    this.store.setListStatus('loading')
    const inflight = (async () => {
      try {
        const list = await this.deps.transport.listConversations()
        this.listFetchedAtMs = this.deps.clock.now()
        this.store.setList(list)
        return this.mergeListWithLocalState()
      } catch {
        // The list is auxiliary (badges/rows); a failure must not poison an
        // open conversation. Keep showing what we have.
        this.store.setListStatus('ready')
        return this.mergeListWithLocalState()
      } finally {
        this.listInflight = null
      }
    })()
    this.listInflight = inflight
    return inflight
  }

  public send(
    partnerName: string,
    content: string,
    kind: 'text' | 'challenge' = 'text',
    challenge?: Parameters<ChatOutbox['enqueue']>[0]['challenge'],
  ): void {
    const trimmed = content.trim()
    if (trimmed.length === 0) return
    const capped = trimmed.slice(0, 1000)
    const key = partnerKey(partnerName)
    // Opening the conversation makes sure the transcript view exists even if
    // the list row was never fetched (deep-link from a profile page).
    if (this.store.getSnapshot().activeKey !== key) {
      this.store.select(key, partnerName)
    }
    this.store.setDraft(key, partnerName, '')
    this.persistDraftsSoon()
    this.outbox.enqueue({
      partnerName,
      content: capped,
      messageType: kind,
      ...(challenge !== undefined ? { challenge } : {}),
    })
    // Re-stamp the list locally: it sorts by lastMessageAt without a fetch.
    this.listSentAtMs = this.deps.clock.now()
  }

  public retryEnvelope(clientMessageId: string): void {
    this.outbox.retry(clientMessageId)
  }

  public resendEnvelope(clientMessageId: string): void {
    this.outbox.resend(clientMessageId)
  }

  public dismissEnvelope(clientMessageId: string): void {
    this.outbox.dismiss(clientMessageId)
  }

  public dismissBanner(partnerName: string): void {
    const key = partnerKey(partnerName)
    const record = this.store.recordOf(key)
    if (record === undefined || record.banner === null) return
    this.store.setBanner(key, record.partner, null)
  }

  public setDraft(partnerName: string, draft: string): void {
    const key = partnerKey(partnerName)
    this.store.setDraft(key, partnerName, draft)
    this.persistDraftsSoon()
  }

  /**
   * Presence ping said the unread count changed. Only then do we spend a
   * list refresh, and only the active conversation re-polls immediately.
   */
  public applyNewMessageHint(unreadConversations: number): void {
    if (!this.signedIn) return
    if (unreadConversations > 0) {
      void this.refreshConversations(true)
      this.poller.kick()
      return
    }
    const snapshot = this.store.getSnapshot()
    const hasLocalUnread = snapshot.conversations.some((view) => view.unreadCount > 0)
    if (hasLocalUnread) {
      void this.refreshConversations()
    }
  }

  /** After accepting/declining/other mutations that could change visibility of chats. */
  public invalidateListCache(): void {
    this.listFetchedAtMs = 0
  }

  public dispose(): void {
    this.poller.dispose()
    this.outbox.dispose()
    if (this.draftSaveTimer !== null) {
      this.deps.clock.cancel(this.draftSaveTimer)
      this.draftSaveTimer = null
    }
    this.persistDraftsNow()
  }

  /* ---------------------------------------------------------------- */
  /* Internals                                                         */
  /* ---------------------------------------------------------------- */

  private mergeListWithLocalState(): ConversationWithLocalState[] {
    const out: ConversationWithLocalState[] = []
    for (const wire of this.store.listView()) {
      const record = this.store.recordOf(wire.partner.username.toLowerCase())
      out.push({
        wire,
        unreadCount: record?.unreadCount ?? wire.unreadCount,
      })
    }
    return out
  }

  private persistDraftsSoon(): void {
    if (this.draftSaveTimer !== null) this.deps.clock.cancel(this.draftSaveTimer)
    this.draftSaveTimer = this.deps.clock.schedule(() => {
      this.draftSaveTimer = null
      this.persistDraftsNow()
    }, this.config.draftPersistDebounceMs)
  }

  private persistDraftsNow(): void {
    const drafts: Record<string, string> = {}
    for (const [key, record] of this.store.recordsView()) {
      if (record.draft.length > 0) drafts[key] = record.draft
    }
    this.deps.persistence.saveDrafts(drafts)
  }
}
