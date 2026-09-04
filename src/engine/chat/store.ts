import type { ChatSnapshot, ConversationView, OutboundEnvelope, PartnerKey } from './types'
import type { ChatBanner } from './types'
import type { ConversationSummaryWire, DirectMessageWire } from '../../../shared/chat-protocol'
import { clientMessageIdOf } from '../../../shared/chat-protocol'
import { buildConversationView } from './projection'

/** Internal mutable record per conversation; snapshots are immutable views. */
export interface ConversationRecord {
  partner: string
  nickname: string | null
  pfpUrl: string | null
  flags: number
  status: 'cold' | 'loading' | 'ready' | 'error'
  loadError: string | null
  serverMessages: DirectMessageWire[]
  envelopes: OutboundEnvelope[]
  draft: string
  banner: ChatBanner | null
  cooldownUntilMs: number
  unreadCount: number
  lastMessageAt: number
  lastMessage: ConversationSummaryWire['lastMessage']
  conversationId: string | null
  lastPolledAtMs: number
}

function emptyRecord(partner: string): ConversationRecord {
  return {
    partner,
    nickname: null,
    pfpUrl: null,
    flags: 0,
    status: 'cold',
    loadError: null,
    serverMessages: [],
    envelopes: [],
    draft: '',
    banner: null,
    cooldownUntilMs: 0,
    unreadCount: 0,
    lastMessageAt: 0,
    lastMessage: null,
    conversationId: null,
    lastPolledAtMs: 0,
  }
}

/**
 * Owns ALL chat state: one record per normalized partner key, so error
 * banners, queues, drafts and cooldowns are structurally incapable of
 * bleeding from one conversation into another. The store never touches the
 * network, the clock, React, or auth.
 */
export class ChatStore {
  private readonly records = new Map<PartnerKey, ConversationRecord>()
  private list: readonly ConversationSummaryWire[] = []
  private listStatus: 'cold' | 'loading' | 'ready' = 'cold'
  private activeKey: PartnerKey | null = null
  private panelOpen = false
  private revision = 0
  private cachedSnapshot: ChatSnapshot | null = null
  private readonly listeners = new Set<() => void>()

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** Memoized by revision: safe to call from useSyncExternalStore. */
  public getSnapshot = (): ChatSnapshot => {
    if (this.cachedSnapshot === null || this.cachedSnapshot.revision !== this.revision) {
      this.cachedSnapshot = this.snapshot()
    }
    return this.cachedSnapshot
  }

  public recordOf(key: PartnerKey): ConversationRecord | undefined {
    return this.records.get(key)
  }

  /** Read-only iteration for the outbox; records stay owned by the store. */
  public recordsView(): ReadonlyMap<PartnerKey, ConversationRecord> {
    return this.records
  }

  public clearCooldown(key: PartnerKey): void {
    const record = this.records.get(key)
    if (record === undefined || record.cooldownUntilMs === 0) return
    record.cooldownUntilMs = 0
    this.commit()
  }

  public ensureRecord(key: PartnerKey, partnerName: string): ConversationRecord {
    let record = this.records.get(key)
    if (record === undefined) {
      record = emptyRecord(partnerName)
      this.records.set(key, record)
    } else if (record.partner !== partnerName) {
      record.partner = partnerName
    }
    return record
  }

  public listView(): readonly ConversationSummaryWire[] {
    return this.list
  }

  /* ------------------------------------------------------------------ */
  /* Mutations — each one commits (bump revision + notify)               */
  /* ------------------------------------------------------------------ */

  public setList(list: readonly ConversationSummaryWire[]): void {
    this.list = [...list].sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    this.listStatus = 'ready'
    for (const summary of this.list) {
      const key = summary.partner.username.toLowerCase()
      const record = this.ensureRecord(key, summary.partner.username)
      record.conversationId = summary.id
      record.nickname = summary.partner.nickname
      record.pfpUrl = summary.partner.pfpUrl
      record.flags = summary.partner.flags
      if (summary.lastMessageAt >= record.lastMessageAt) {
        record.lastMessage = summary.lastMessage
      }
      record.lastMessageAt = Math.max(record.lastMessageAt, summary.lastMessageAt)
      if (record.lastPolledAtMs === 0 || record.conversationId !== summary.id) {
        // Trust the edge for unread state only while the window is untouched.
        record.unreadCount = summary.unreadCount
      }
    }
    this.commit()
  }

  public setListStatus(status: 'cold' | 'loading' | 'ready'): void {
    if (this.listStatus === status) return
    this.listStatus = status
    this.commit()
  }

  public setPanelOpen(open: boolean): void {
    if (this.panelOpen === open) return
    this.panelOpen = open
    this.commit()
  }

  public select(key: PartnerKey | null, partnerName?: string): void {
    this.activeKey = key
    if (key !== null) this.ensureRecord(key, partnerName ?? key)
    this.commit()
  }

  public replaceMessages(
    key: PartnerKey,
    partnerName: string,
    page: readonly DirectMessageWire[],
    conversationId: string | null,
    polledAtMs: number,
  ): void {
    const record = this.ensureRecord(key, partnerName)
    record.serverMessages = [...page].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    record.envelopes = record.envelopes.filter((env) => !this.isAcked(record, env))
    record.status = 'ready'
    record.loadError = null
    record.lastPolledAtMs = polledAtMs
    if (conversationId !== null) record.conversationId = conversationId
    this.commit()
  }

  public setStatus(
    key: PartnerKey,
    partnerName: string,
    status: ConversationRecord['status'],
    loadError: string | null = null,
  ): void {
    const record = this.ensureRecord(key, partnerName)
    record.status = status
    record.loadError = loadError
    this.commit()
  }

  public appendMessage(key: PartnerKey, partnerName: string, message: DirectMessageWire): void {
    const record = this.ensureRecord(key, partnerName)
    if (!record.serverMessages.some((m) => m.id === message.id)) {
      record.serverMessages = [...record.serverMessages, message].sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
      )
    }
    record.envelopes = record.envelopes.filter((env) => !this.isAcked(record, env))
    if (message.createdAt >= record.lastMessageAt) {
      record.lastMessageAt = message.createdAt
      record.lastMessage = {
        content: message.content,
        senderUsername: message.senderUsername,
        createdAt: message.createdAt,
      }
    }
    this.commit()
  }

  /** A local envelope is acked once the server row carries its id (in `id`
   *  or echoed `clientMessageId` metadata). */
  private isAcked(record: ConversationRecord, env: OutboundEnvelope): boolean {
    return record.serverMessages.some(
      (m) => m.id === env.clientMessageId || clientMessageIdOf(m.metadata) === env.clientMessageId,
    )
  }

  public upsertEnvelope(env: OutboundEnvelope): void {
    const record = this.ensureRecord(env.partner, env.partnerName)
    const index = record.envelopes.findIndex((e) => e.clientMessageId === env.clientMessageId)
    record.envelopes =
      index === -1 ? [...record.envelopes, env] : record.envelopes.map((e, i) => (i === index ? env : e))
    this.commit()
  }

  public patchEnvelope(key: PartnerKey, clientMessageId: string, patch: (env: OutboundEnvelope) => OutboundEnvelope): void {
    const record = this.records.get(key)
    if (record === undefined) return
    record.envelopes = record.envelopes.map((e) => (e.clientMessageId === clientMessageId ? patch(e) : e))
    this.commit()
  }

  public removeEnvelope(key: PartnerKey, clientMessageId: string): void {
    const record = this.records.get(key)
    if (record === undefined) return
    record.envelopes = record.envelopes.filter((e) => e.clientMessageId !== clientMessageId)
    this.commit()
  }

  public rejectAllQueued(key: PartnerKey, code: ChatBanner['code'], reason: string): void {
    const record = this.records.get(key)
    if (record === undefined) return
    record.envelopes = record.envelopes.map((e) =>
      e.state.kind === 'queued' || e.state.kind === 'retry-scheduled'
        ? { ...e, state: { kind: 'rejected' as const, code, reason } }
        : e,
    )
    this.commit()
  }

  public setDraft(key: PartnerKey, partnerName: string, draft: string): void {
    const record = this.ensureRecord(key, partnerName)
    if (record.draft === draft) return
    record.draft = draft
    this.commit()
  }

  public setBanner(key: PartnerKey, partnerName: string, banner: ChatBanner | null): void {
    const record = this.ensureRecord(key, partnerName)
    record.banner = banner
    this.commit()
  }

  public setCooldownUntil(key: PartnerKey, untilMs: number): void {
    const record = this.records.get(key)
    if (record === undefined) return
    const next = Math.max(record.cooldownUntilMs, untilMs)
    if (next === record.cooldownUntilMs) return
    record.cooldownUntilMs = next
    this.commit()
  }

  public markReadLocal(key: PartnerKey): void {
    const record = this.records.get(key)
    if (record === undefined || record.unreadCount === 0) return
    record.unreadCount = 0
    this.commit()
  }

  public reset(): void {
    this.records.clear()
    this.list = []
    this.listStatus = 'cold'
    this.activeKey = null
    this.commit()
  }

  public commit(): void {
    this.revision += 1
    for (const listener of [...this.listeners]) {
      listener()
    }
  }

  private snapshot(): ChatSnapshot {
    const nowMs = Date.now()
    const views: ConversationView[] = []
    const seen = new Set<PartnerKey>()

    for (const [key, record] of this.records) {
      seen.add(key)
      views.push(buildConversationView(record, key, nowMs))
    }
    // Partners from the list who have no local record yet (never-opened
    // conversations still show as rows, cold and read-only).
    for (const summary of this.list) {
      const key = summary.partner.username.toLowerCase()
      if (seen.has(key)) continue
      const record = emptyRecord(summary.partner.username)
      record.conversationId = summary.id
      record.unreadCount = summary.unreadCount
      record.lastMessageAt = summary.lastMessageAt
      record.lastMessage = summary.lastMessage
      record.nickname = summary.partner.nickname
      record.pfpUrl = summary.partner.pfpUrl
      record.flags = summary.partner.flags
      record.status = 'cold'
      views.push(buildConversationView(record, key, nowMs))
    }

    views.sort((a, b) => b.lastMessageAt - a.lastMessageAt || a.partner.localeCompare(b.partner))
    let totalUnread = 0
    let totalQueued = 0
    for (const view of views) {
      totalUnread += view.unreadCount
      totalQueued += view.queuedCount
    }
    return {
      revision: this.revision,
      panelOpen: this.panelOpen,
      activeKey: this.activeKey,
      listStatus: this.listStatus,
      conversations: views,
      totalUnread,
      totalQueued,
    }
  }
}
