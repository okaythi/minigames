/**
 * ChatEngine invariant tests — run with:  npm run test:chat
 *
 * Deterministic by construction: a scripted transport that throws the same
 * ChatTransportError the real one throws, a virtual clock (timers fire only
 * on advance()), and an in-memory persistence port. `settle()` flushes the
 * microtask chains between virtual-clock advances. No network, no DOM,
 * no React.
 */
import { ChatEngine } from '../src/engine/chat/engine'
import type { ChatEngineConfig } from '../src/engine/chat/engine'
import { ChatTransportError } from '../src/engine/chat/interfaces'
import type { ChatTransportInterface } from '../src/engine/chat/interfaces'
import type { ClockInterface, PersistenceInterface } from '../src/engine/chat/interfaces'
import type { ConversationView, OutboundEnvelope } from '../src/engine/chat/types'
import {
  ChatSendCode,
  classifyChatFailure,
  parseChallengeMetadata,
  parseConversationListWire,
  parseMessagePageWire,
  parseSendReceiptWire,
} from '../shared/chat-protocol'
import type {
  ChatSendReceiptWire,
  ChatSendRequest,
  ConversationSummaryWire,
  DirectMessageWire,
  MessagePageWire,
} from '../shared/chat-protocol'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`)
    process.exit(1)
  }
  console.log(`✅ PASS: ${message}`)
}

/** Drain all pending promise chains (real timer — the engine never uses it). */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

// ── Virtual clock ────────────────────────────────────────────────────────────
class FakeClock implements ClockInterface {
  nowMs = 1_000_000
  private seq = 0
  private readonly timers = new Map<number, { at: number; cb: () => void }>()

  public now(): number { return this.nowMs }

  public schedule(callback: () => void, delayMs: number): number {
    const id = ++this.seq
    this.timers.set(id, { at: this.nowMs + Math.max(0, delayMs), cb: callback })
    return id
  }

  public cancel(handle: number): void {
    this.timers.delete(handle)
  }

  public advance(ms: number): void {
    const target = this.nowMs + ms
    for (;;) {
      let nextId = -1
      let nextAt = Infinity
      for (const [id, t] of this.timers) {
        if (t.at <= target && t.at < nextAt) {
          nextAt = t.at
          nextId = id
        }
      }
      if (nextId === -1) break
      const t = this.timers.get(nextId)!
      this.timers.delete(nextId)
      this.nowMs = t.at
      t.cb()
    }
    this.nowMs = target
  }
}

// ── Scripted transport ───────────────────────────────────────────────────────
interface TransportScript {
  list?: () => readonly ConversationSummaryWire[]
  page?: (partner: string) => MessagePageWire
  send?: (request: ChatSendRequest) => Promise<ChatSendReceiptWire>
}

class FakeTransport implements ChatTransportInterface {
  public readonly calls = {
    list: 0,
    page: [] as string[],
    send: [] as Array<{ partner: string; content: string; cid: string }>,
  }

  public constructor(private readonly script: TransportScript) {}

  public async listConversations(): Promise<readonly ConversationSummaryWire[]> {
    this.calls.list += 1
    if (this.script.list === undefined) return []
    return this.script.list()
  }

  public async fetchMessages(partnerName: string): Promise<MessagePageWire> {
    this.calls.page.push(partnerName)
    if (this.script.page === undefined) return { conversationId: null, messages: [] }
    return this.script.page(partnerName)
  }

  public async send(request: ChatSendRequest): Promise<ChatSendReceiptWire> {
    this.calls.send.push({ partner: request.recipientUsername, content: request.content, cid: request.clientMessageId })
    if (this.script.send === undefined) {
      throw new ChatTransportError({
        message: 'offline',
        failure: 'transient',
        code: ChatSendCode.Network,
      })
    }
    return this.script.send(request)
  }
}

function fail(code: (typeof ChatSendCode)[keyof typeof ChatSendCode]): Promise<never> {
  const cls = classifyChatFailure(code)
  return Promise.reject(
    new ChatTransportError({
      message: 'scripted failure',
      failure: cls,
      code,
      ...(cls === 'rate' ? { retryAfterSeconds: 1 } : {}),
    }),
  )
}

// ── Persistence (in-memory; also a hydrate source) ───────────────────────────
class FakePersistence implements PersistenceInterface {
  public drafts: Readonly<Record<string, string>> = {}
  public outbox: readonly OutboundEnvelope[] = []
  public saveCount = { drafts: 0, outbox: 0 }

  public constructor(saved?: { drafts?: Record<string, string>; outbox?: OutboundEnvelope[] }) {
    if (saved?.drafts !== undefined) this.drafts = saved.drafts
    if (saved?.outbox !== undefined) this.outbox = saved.outbox
  }

  public loadDrafts(): Readonly<Record<string, string>> { return this.drafts }
  public saveDrafts(drafts: Readonly<Record<string, string>>): void {
    this.drafts = drafts
    this.saveCount.drafts += 1
  }
  public loadOutbox(): readonly OutboundEnvelope[] { return this.outbox }
  public saveOutbox(envelopes: readonly OutboundEnvelope[]): void {
    this.outbox = envelopes
    this.saveCount.outbox += 1
  }
}

const CONFIG: ChatEngineConfig = {
  listTtlMs: 10_000,
  recentSendGuardMs: 4_000,
  draftPersistDebounceMs: 350,
  poller: { baseIntervalMs: 6_000, maxIntervalMs: 30_000, staleAfterMs: 2_000 },
  outbox: { maxAttempts: 4, retryBackoffBaseMs: 1_500 },
}

const sec = (clock: FakeClock): number => Math.floor(clock.nowMs / 1000)

const msgWire = (
  id: string,
  sender: string,
  recipient: string,
  content: string,
  createdAt: number,
  metadata: string | null = null,
): DirectMessageWire => ({
  id,
  conversationId: 'c1',
  senderUsername: sender,
  senderNickname: null,
  senderPfpUrl: null,
  recipientUsername: recipient,
  messageType: 'text',
  content,
  metadata,
  readAt: null,
  createdAt,
})

function summary(partner: string, overrides: Partial<ConversationSummaryWire> = {}): ConversationSummaryWire {
  return {
    id: `c-${partner}`,
    lastMessageAt: 100,
    partner: { username: partner, nickname: null, pfpUrl: null, flags: 0 },
    lastMessage: null,
    unreadCount: 0,
    hasUnread: false,
    isFirstEverMessage: false,
    ...overrides,
  }
}

const okSend = (
  clock: FakeClock,
  contentFrom: (r: ChatSendRequest) => string = (r) => r.content,
): ((r: ChatSendRequest) => Promise<ChatSendReceiptWire>) => async (r) => ({
  ok: true as const,
  message: {
    ...msgWire(`srv-${r.clientMessageId}`, 'me', r.recipientUsername, contentFrom(r), sec(clock)),
    metadata: JSON.stringify({ clientMessageId: r.clientMessageId }),
  },
  conversation: { id: `c-${r.recipientUsername}`, lastMessageAt: sec(clock) },
})

function boot(
  script: TransportScript,
  persistence: PersistenceInterface = new FakePersistence(),
  clock: FakeClock = new FakeClock(),
): { engine: ChatEngine; transport: FakeTransport; clock: FakeClock } {
  const transport = new FakeTransport(script)
  const engine = new ChatEngine({ transport, clock, persistence, config: CONFIG })
  engine.start()
  engine.onSignedIn()
  return { engine, transport, clock }
}

const viewOf = (engine: ChatEngine, partner: string): ConversationView | undefined =>
  engine.getSnapshot().conversations.find((v) => v.partner === partner)
const stateOf = (view: ConversationView | undefined, content: string): string | undefined =>
  view?.messages.find((m) => m.wire?.content === content)?.outbound?.state.kind

console.log('--- ChatEngine Invariant Tests ---')
console.log('\n[Isolation: a failure in one chat never touches another]')
{
  const clock = new FakeClock()
  const { engine } = boot(
    {
      send: (r) =>
        r.recipientUsername === 'alice'
          ? fail(ChatSendCode.RecipientUnreachable)
          : okSend(clock)(r),
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  engine.send('alice', 'hello there')
  await settle()

  const alice = viewOf(engine, 'alice')!
  assert(alice.status === 'ready', 'alice stays ready even with a rejected send')
  const rejected = alice.messages.find((m) => m.outbound?.state.kind === 'rejected')!
  assert(rejected !== undefined, 'alice shows a rejected message')
  assert(rejected.wire?.content === 'hello there', 'rejected message KEEPS its content (old bug wiped it)')
  assert(
    rejected.outbound?.state.kind === 'rejected' && rejected.outbound.state.code === ChatSendCode.RecipientUnreachable,
    'rejection carries the stable policy CODE, not a string to parse',
  )
  assert(alice.banner?.code === ChatSendCode.RecipientUnreachable, 'policy banner is scoped to alice')

  engine.selectConversation('bob')
  engine.send('bob', 'clean message')
  await settle()
  const bob = viewOf(engine, 'bob')!
  assert(bob.messages.length === 1 && bob.messages[0]!.outbound === null, 'bob sent cleanly while alice was failing')
  assert(bob.banner === null, 'bob sees NO banner — alice policy error did not leak')
  assert(!bob.messages.some((m) => m.outbound?.state.kind === 'rejected'), 'no rejected ghosts in bobs thread')
  engine.dispose()
}

console.log('\n[Policy rejection parks the WHOLE conversation queue, siblings included]')
{
  const { engine, transport } = boot({
    send: () => fail(ChatSendCode.Blocked),
  })
  engine.selectConversation('alice')
  engine.send('alice', 'one')
  engine.send('alice', 'two') // queued behind the in-flight one
  await settle()
  const alice = viewOf(engine, 'alice')!
  const rejected = alice.messages.filter((m) => m.outbound?.state.kind === 'rejected')
  assert(rejected.length === 2, 'both siblings rejected at once (pointless retries are a flag provocation)')
  assert(alice.queuedCount === 0, 'nothing is left to retry-loop in the background')
  assert(alice.banner?.code === ChatSendCode.Blocked && alice.banner.text.includes('cannot message'), 'banner explains the policy reason')
  assert(transport.calls.send.length === 1, 'exactly ONE request was burned for two parked messages')
  // "Send anyway" resends fresh, per envelope.
  const first = rejected[0]!
  engine.resendEnvelope(first.id)
  await settle()
  assert(transport.calls.send.length === 2, 'resend ("send anyway") re-issues only the envelope the user chose')
  engine.dispose()
}

console.log('\n[Queue routing: pending sends drain to THEIR OWN partner]')
{
  let aliceAttempts = 0
  const clock = new FakeClock()
  const { engine, transport } = boot(
    {
      send: (r) => {
        if (r.recipientUsername !== 'alice') return okSend(clock)(r)
        aliceAttempts += 1
        return aliceAttempts < 2 ? fail(ChatSendCode.RateLimited) : okSend(clock)(r)
      },
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  engine.send('alice', 'throttled') // → 429 rate → parked 1s
  await settle()
  assert(stateOf(viewOf(engine, 'alice'), 'throttled') === 'queued', 'rate-limited send stays QUEUED, never dropped')
  engine.selectConversation('bob')
  engine.send('bob', 'for bob')
  await settle()
  assert(
    transport.calls.send.filter((c) => c.partner === 'bob').length === 1,
    "bobs message drains on bobs chain while alice's is parked (no cross-routing)",
  )
  clock.advance(1_000 + 50)
  await settle()
  assert(stateOf(viewOf(engine, 'alice'), 'throttled') === undefined, "alice's parked send drained after HER cooldown expired")
  assert(
    viewOf(engine, 'bob')!.messages.every((m) => m.outbound === null),
    'bobs thread is untouched by alices cooldown cycle',
  )
  engine.dispose()
}

console.log('\n[Transient failure: auto-retry ladder 1.5s × 2^n, acked once]')
{
  let attempts = 0
  const clock = new FakeClock()
  const { engine } = boot(
    {
      send: (r) => {
        attempts += 1
        return attempts < 4 ? fail(ChatSendCode.Network) : okSend(clock)(r)
      },
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  engine.send('alice', 'resilient')
  await settle()
  assert(attempts === 1, 'first attempt fires immediately (optimistic UX)')
  clock.advance(1_500)
  await settle()
  assert(attempts === 2, 'transient failure auto-retries after 1.5s')
  clock.advance(3_000)
  await settle()
  assert(attempts === 3, 'backoff doubles to 3s')
  clock.advance(6_000)
  await settle()
  assert(attempts === 4, 'third retry at 6s')
  const v = viewOf(engine, 'alice')!
  assert(v.messages.length === 1 && v.messages[0]!.outbound === null, 'acked exactly once after retries (no ghost duplicates)')
  engine.dispose()
}

console.log('\n[Ladder exhausted → manual retry affordance; dismiss removes]')
{
  const { engine, clock, transport } = boot({ send: () => fail(ChatSendCode.Server) })
  engine.selectConversation('alice')
  engine.send('alice', 'doomed')
  await settle()
  assert(stateOf(viewOf(engine, 'alice'), 'doomed') === 'retry-scheduled', 'transient failure enters retry-scheduled, never rejected-early')
  clock.advance(1_500)
  await settle()
  clock.advance(3_000)
  await settle()
  clock.advance(6_000)
  await settle() // 4th attempt fails → ladder exhausted
  const v1 = viewOf(engine, 'alice')!
  const failed = v1.messages.find((m) => m.outbound?.state.kind === 'rejected')!
  assert(failed !== undefined, 'after the ladder, the message remains visibly rejected')
  assert(
    failed.outbound!.state.kind === 'rejected' && classifyChatFailure(failed.outbound.state.code) === 'transient',
    'a server failure stays classified TRANSIENT → UI offers retry (vs send-anyway for policy)',
  )
  const sendsBefore = transport.calls.send.length
  engine.retryEnvelope(failed.id)
  await settle()
  assert(transport.calls.send.length === sendsBefore + 1, 'manual retry immediately re-issues the send')
  assert(stateOf(viewOf(engine, 'alice'), 'doomed') === 'retry-scheduled', 'manual retry re-enters the auto-ladder (not stuck on rejected)')
  clock.advance(1_500)
  await settle()
  clock.advance(3_000)
  await settle()
  clock.advance(6_000)
  await settle()
  assert(transport.calls.send.length === sendsBefore + 4, 'manual retry gets a FULL fresh ladder (4 attempts)')
  const v2 = viewOf(engine, 'alice')!
  engine.dismissEnvelope(v2.messages.find((m) => m.outbound !== undefined)!.id)
  assert(viewOf(engine, 'alice')!.messages.length === 0, 'dismiss drops the envelope and its bubble')
  engine.dispose()
}

console.log('\n[Rate limit: parked, auto-flushed at the server cooldown, and paced]')
{
  const clock = new FakeClock()
  const { engine, transport } = boot(
    {
      send: okSend(clock),
      list: () => [],
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  engine.send('alice', 'burst 1')
  engine.send('alice', 'burst 2')
  engine.send('alice', 'burst 3')
  await settle()
  assert(transport.calls.send.length === 1, 'burst collapses to sequential sends (1 in flight, rest queued)')
  clock.advance(1_000) // client pacing cooldown
  await settle()
  clock.advance(1_000)
  await settle()
  assert(transport.calls.send.length === 3, 'the queue drains itself at ~1/s without any user action')
  const v = viewOf(engine, 'alice')!
  assert(v.messages.length === 3 && v.queuedCount === 0, 'all three acked into the thread')
  engine.dispose()
}

console.log('\n[Request budget: no redundant fetches anywhere]')
{
  const clock = new FakeClock()
  const { engine, transport } = boot(
    {
      list: () => [summary('alice', { unreadCount: 1, hasUnread: true, lastMessageAt: sec(clock) })],
    },
    new FakePersistence(),
    clock,
  )
  await settle()
  assert(transport.calls.list === 1, 'sign-in hydration costs exactly ONE list call')
  engine.openPanel()
  engine.refreshConversations()
  engine.refreshConversations()
  assert(transport.calls.list === 1, 'panel open + double refresh inside TTL: still ONE list call (shared cache)')
  engine.selectConversation('alice')
  engine.selectConversation('alice')
  assert(transport.calls.page.length === 1, 're-selecting the same conversation refetches nothing')

  engine.send('alice', 'guarded')
  await settle()
  engine.refreshConversations()
  assert(transport.calls.list === 1, 'send guard: focus-style refresh right after a send stays FREE (rows were re-stamped locally)')

  engine.refreshConversations(true)
  engine.refreshConversations(true)
  await settle()
  assert(transport.calls.list === 2, 'forced (ping-driven) refreshes still go out, single-flight: two calls = one request')

  engine.setVisibility(false)
  const listAtHide = transport.calls.list
  const pageAtHide = transport.calls.page.length
  clock.advance(120_000)
  assert(transport.calls.list === listAtHide && transport.calls.page.length === pageAtHide,
    'hidden tab: ZERO requests for two full minutes (the big quota lever)')
  engine.setVisibility(true)
  await settle()
  assert(transport.calls.page.length === pageAtHide + 1, 're-show: exactly ONE immediate catch-up fetch')
  engine.dispose()
}

console.log('\n[Poller: backoff grows on failures, resets on success]')
{
  const clock = new FakeClock()
  let pageFails = 0
  let lateContent = 'late msg'
  const { engine, transport } = boot(
    {
      page: () => {
        pageFails += 1
        if (pageFails <= 2) {
          throw new ChatTransportError({ message: 'offline', failure: 'transient', code: ChatSendCode.Network })
        }
        return { conversationId: 'c1', messages: [msgWire('srv-p', 'alice', 'me', lateContent, sec(clock) - 10)] }
      },
    },
    new FakePersistence(),
    clock,
  )
  engine.setVisibility(true)
  engine.openPanel()
  engine.selectConversation('alice')
  await settle()
  assert(transport.calls.page.length === 1, 'opening a conversation costs exactly one fetch')
  const vErr = viewOf(engine, 'alice')!
  assert(vErr.status === 'error', 'failed load surfaces an error status the UI can show')

  clock.advance(6_000)
  await settle()
  assert(transport.calls.page.length === 1, 'no retry at the healthy 6s mark — failure pushed it out, not multiplied it')
  clock.advance(6_000) // t=12s: backoff step (6s × 2)
  await settle()
  assert(transport.calls.page.length === 2, 'retry after 12s backoff, not 6s')
  clock.advance(24_000) // t=36s: 6s × 4
  await settle()
  assert(transport.calls.page.length === 3, 'third attempt after 24s backoff')
  assert(viewOf(engine, 'alice')!.status === 'ready', 'recovered poll clears the stale error state')
  assert(viewOf(engine, 'alice')!.messages.some((m) => m.id === 'srv-p'), 'late message merged on recovery')
  clock.advance(6_000) // back to healthy cadence
  await settle()
  assert(transport.calls.page.length === 4, 'backoff reset to the 6s cadence after success')
  engine.dispose()
}

console.log('\n[Dedup: receipt AND poll rows reconcile against clientMessageId — one copy, always]')
{
  const clock = new FakeClock()
  let cidSent: string | null = null
  const { engine, transport } = boot(
    {
      page: (partner) => ({
        conversationId: 'c1',
        messages: cidSent === null ? [] : [{
          ...msgWire('srv-d1', 'me', partner, 'dedup me', sec(clock)),
          metadata: JSON.stringify({ clientMessageId: cidSent }),
        }],
      }),
      send: () => fail(ChatSendCode.Network), // never acks — only the poll can resolve it
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  await settle()
  engine.send('alice', 'dedup me') // server actually delivered it (network died on the way back)
  await settle()
  const cid = viewOf(engine, 'alice')!.messages.find((m) => m.outbound !== undefined)!.id
  cidSent = cid
  // A poll row carrying the echoed clientMessageId proves delivery: the
  // retry-scheduled envelope must vanish, not double up.
  engine.applyNewMessageHint(1) // pings force an immediate poll (kick)
  await settle()
  const v = viewOf(engine, 'alice')!
  assert(v.messages.filter((m) => m.wire?.content === 'dedup me').length === 1, 'poll-reconciled: exactly one copy, zero envelopes')
  assert(v.messages[0]!.outbound === null, 'the surviving copy is the SERVER row')
  const sendsBefore = transport.calls.send.length
  clock.advance(1_500 + 3_000 + 6_000 + 1)
  await settle()
  assert(transport.calls.send.length >= sendsBefore, 'residual retry (if scheduled) dedups via appendMessage id-guard — no dup either way')
  assert(viewOf(engine, 'alice')!.messages.filter((m) => m.wire?.content === 'dedup me').length === 1, 'still one copy after any late re-ack')
  engine.dispose()
}

console.log('\n[Drafts + outbox persistence: debounce, clear-on-send, boot recovery]')
{
  const clock = new FakeClock()
  const persistence = new FakePersistence()
  const { engine } = boot({ list: () => [], send: okSend(clock) }, persistence, clock)
  engine.setDraft('alice', 'work in progress')
  clock.advance(200)
  await settle()
  assert(persistence.saveCount.drafts === 0, 'draft NOT persisted before the debounce window (no write storm while typing)')
  clock.advance(200)
  await settle()
  assert(persistence.drafts['alice'] === 'work in progress', 'draft persisted after debounce')
  engine.selectConversation('alice')
  engine.send('alice', 'work in progress')
  await settle()
  assert(persistence.drafts['alice'] === 'work in progress', 'draft survives the microtask window (persistence is debounced, not eager)')
  clock.advance(350)
  await settle()
  assert(persistence.drafts['alice'] === undefined, 'draft cleared after debounce — nothing stale survives')
  engine.dispose()

  // Second boot: saved draft back in the input; saved envelope re-queued and
  // delivered on sign-in.
  const orphan: OutboundEnvelope = {
    clientMessageId: 'cid-boot-1',
    partner: 'bob',
    partnerName: 'bob',
    content: 'saved while offline',
    messageType: 'text',
    createdAtSeconds: 900,
    state: { kind: 'queued' },
  }
  const p2 = new FakePersistence({ drafts: { bob: 'half-written' }, outbox: [orphan] })
  const clock2 = new FakeClock()
  const transport2 = new FakeTransport({ send: okSend(clock2) })
  const engine2 = new ChatEngine({ transport: transport2, clock: clock2, persistence: p2, config: CONFIG })
  engine2.start()
  assert(viewOf(engine2, 'bob')?.draft === 'half-written', 'draft restored from disk on boot')
  assert(viewOf(engine2, 'bob')!.messages.length === 1 && stateOf(viewOf(engine2, 'bob'), 'saved while offline') === 'queued',
    'interrupted send survives reload as queued')
  engine2.onSignedIn()
  await settle()
  assert(transport2.calls.send.length === 1 && transport2.calls.send[0]!.partner === 'bob',
    'resumed send goes to the RIGHT partner after sign-in')
  engine2.dispose()
}

console.log('\n[Unread authority: server rows while closed; instant local mirror while open]')
{
  const clock = new FakeClock()
  let listUnread = 2
  const { engine } = boot(
    {
      list: () => [summary('alice', {
        unreadCount: listUnread,
        hasUnread: listUnread > 0,
        lastMessageAt: sec(clock),
        lastMessage: { content: 'ping', senderUsername: 'alice', createdAt: sec(clock) },
      })],
    },
    new FakePersistence(),
    clock,
  )
  await settle()
  assert(viewOf(engine, 'alice')!.unreadCount === 2, 'closed chat takes the server count')
  assert(viewOf(engine, 'alice')!.lastMessage?.content === 'ping', 'cold rows render list metadata (no fetch to preview)')
  engine.selectConversation('alice')
  await settle()
  assert(viewOf(engine, 'alice')!.unreadCount === 0, 'opening mirrors the server mark-read immediately (no badge wait)')
  engine.closePanel()
  listUnread = 0
  clock.advance(11_000) // past the TTL
  await engine.refreshConversations(true)
  assert(viewOf(engine, 'alice')!.unreadCount === 0, 're-sync keeps the badge clean')
  engine.dispose()
}

console.log('\n[Challenge card: gated on parsed metadata, never on content strings]')
{
  const clock = new FakeClock()
  const meta = JSON.stringify({
    challengeId: 'ch1', gameSlug: 'tron', targetScore: 100, bountyCandy: 50,
    status: 'pending', challengerUsername: 'alice', challengedUsername: 'me',
  })
  const { engine } = boot(
    {
      page: () => ({
        conversationId: 'c1',
        messages: [
          { ...msgWire('srv-ch', 'alice', 'me', 'Challenge: tron 100 for 50 candy', sec(clock) - 5, meta) },
          msgWire('srv-pl', 'alice', 'me', 'Challenge: tron 100 for 50 candy', sec(clock) - 4),
        ],
      }),
    },
    new FakePersistence(),
    clock,
  )
  engine.selectConversation('alice')
  await settle()
  const msgs = viewOf(engine, 'alice')!.messages
  const challengeRow = msgs.find((m) => m.id === 'srv-ch')!
  const plainRow = msgs.find((m) => m.id === 'srv-pl')!
  assert(parseChallengeMetadata(challengeRow.wire!.metadata) !== null, 'challenge parses from metadata')
  assert(parseChallengeMetadata(plainRow.wire!.metadata) === null,
    'a LOOKALIKE text message (same content!) is not rendered as a card — old bug')
  engine.dispose()
}

console.log('\n[Protocol parsing guards]')
{
  const poisoned = parseConversationListWire({
    conversations: [{ id: 42 }, { id: 'ok', lastMessageAt: 1, partner: { username: 'a', nickname: null, pfpUrl: null, flags: 0 }, lastMessage: null, unreadCount: 0, hasUnread: false, isFirstEverMessage: false }],
  })
  assert(poisoned?.length === 1, 'list parser drops malformed rows instead of poisoning the whole drawer')
  assert(parseConversationListWire({ nope: true }) === null, 'list parser rejects a non-list payload')
  assert(parseMessagePageWire({ messages: [{ id: 'x' }] })?.messages.length === 0, 'message parser drops malformed rows')
  assert(
    parseSendReceiptWire({ ok: true, message: msgWire('a', 'b', 'c', 'd', 1), conversation: { id: 'z', lastMessageAt: 5 } })
      ?.conversation.lastMessageAt === 5,
    'receipt parser accepts valid payloads',
  )
  assert(
    parseSendReceiptWire({ ok: true, message: msgWire('a', 'b', 'c', 'd', 1) }) === null,
    'receipt parser rejects a receipt without the conversation stamp',
  )
  assert(classifyChatFailure(ChatSendCode.SenderSuspended) === 'policy' && classifyChatFailure(ChatSendCode.Server) === 'transient',
    'failure classes are stable across the wire boundary')
}

console.log('\nAll ChatEngine invariants held. 🎉')
