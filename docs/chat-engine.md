# Chat Engine — Design & Operating Contract

The DM subsystem lives in `src/engine/chat/` (+ the wire contract in
`shared/chat-protocol.ts`). It exists because the old chat was one component
sharing one blob of state: an error in chat A painted over chat B, queued
messages drained into whatever conversation happened to be open, and every
"helpful" catch-up re-fetched the world. The engine replaces all of that with
small, single-purpose, strictly typed parts.

## The one rule that matters

**One thing does one thing.** The chat engine knows nothing about auth,
friends, presence, flags, or notifications — it imports none of them. It
consumes three injected ports and emits snapshots:

```
transport (ChatTransportInterface)  ← HttpChatTransport (fetch + parse guards)
clock     (ClockInterface)          ← systemClock (wall time + timers)
persistence(PersistenceInterface)   ← localChatPersistence (drafts + outbox)
```

External facts arrive only as method calls wired by `src/services/chat-boot.ts`
(`onSignedIn/onSignedOut/setVisibility/applyNewMessageHint`). The notifications
engine composes chat *through* the engine's public read surface
(`ChatListSourceInterface`) — it never reaches into chat state, and chat never
decides what a notification looks like.

## File map

| File | Responsibility |
|---|---|
| `shared/chat-protocol.ts` | THE wire contract: wire types, `ChatSendCode`, failure classes, parse guards |
| `types.ts` | Domain model: `OutboundEnvelope`, `ConversationView`, `PartnerKey` |
| `interfaces.ts` | Ports + the only error type allowed to cross them |
| `store.ts` | ALL state. One `ConversationRecord` per normalized partner key |
| `projection.ts` | Pure records→views derivation (never touches the network) |
| `outbox.ts` | Per-partner send queues, retry ladder, cooldown parking |
| `poller.ts` | Polls the ONE visible conversation, with backoff + suspension |
| `engine.ts` | Orchestrator: store + outbox + poller + list cache lifecycle |
| `transport.ts` | `fetch` + strict parse; everything unparseable → `ChatTransportError` |
| `local-persistence.ts` | localStorage mirror (drafts debounced, outbox replayed at boot) |
| `hooks.ts` / `instance.ts` | React binding (`useChatController`) + singleton wiring |

## Failure model (no string matching, ever)

Every error is a stable `ChatSendCode` from the server, classified once by
`classifyChatFailure`:

- **transient** (network/server/timeout) → auto-retry ladder `1.5s × 2ⁿ`,
  4 attempts, then a visible "retry" affordance. Content is never wiped.
- **rate** (`rate_limited`) → queue parks, resumes exactly at the server's
  `cooldown`; per-conversation client pacing (1/s) prevents provoking 429s
  in the first place.
- **policy** (`blocked`, `sender_suspended`, `recipient_unreachable`…) →
  terminal: the envelope AND its queued siblings in that one conversation
  park with a banner ("send anyway" re-issues a single message deliberately).
  Other conversations are structurally untouched.
- **auth** → sign-in-required listeners fire; queue survives sign-in.

UI copy for codes lives only in `errors.ts`; the server never needs to send
prose, and components never parse it.

## Request budget (the Cloudflare-free part)

`100k` Function invocations/day includes every API hit, so the engine is
built around *not asking*:

| Interaction | Edge requests |
|---|---|
| boot / sign-in | 1 list fetch (shared: bell + drawer + boot collapse into it via single-flight + 10s TTL) |
| open drawer | 0 extra if list is fresh |
| open a conversation | 1 messages fetch |
| watching, visible | 1 fetch / 6s |
| watching, failing | 6 → 12 → 24 → 30s (backoff = FEWER requests while broken) |
| send | exactly 1 POST; receipt re-stamps the list locally (no follow-up GET) |
| hidden tab or closed drawer | **0** — timers are cleared, not slowed |
| re-show after >2s | 1 immediate catch-up poll |

A send within 4s of the last one marks the list "fresh" (the receipt already
updated it locally), so focus/visibility refreshes triggered right after
sending cost nothing.

## Reconciliation (why messages never duplicate or vanish)

Each envelope carries a `clientMessageId`; the server echoes it inside the
message `metadata`. A local envelope is considered acked when **any** server
row carries it (in `id` or metadata). Receipts and poll pages both flow
through the same dedupe (`store.isAcked`), so whichever arrives first — or in
any interleaving — leaves exactly one copy. Drafts and unsent envelopes
persist through reload; a send that died mid-flight resumes, to its own
partner, after boot.

## Invariants (enforced by `npm run test:chat`)

1. Failure/banner/cooldown state is keyed by partner — leakage is structural,
   not temporal (a rejected send in A cannot appear in B, ever).
2. Queues drain per partner; switching chats never misroutes a pending send.
3. Optimistic + acked + polled copies reconcile to one (echoed id).
4. Polling is zero while hidden/closed; backoff grows under failure.
5. No redundant fetches (single-flight + TTL + send-guard).
6. Policy rejections park whole queues; transients never do.
7. Malformed server data is dropped or typed as `ChatTransportError` — it
   never reaches React un-parsed.

Run the suite: `npm run test:chat`. The engine takes its ports by injection,
so the suite runs it headless with a fake transport/clock/persistence.
