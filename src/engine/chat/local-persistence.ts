import { localStore } from '../../services/storage/local-store'
import type { PersistenceInterface } from './interfaces'
import type { OutboundEnvelope } from './types'
import { partnerKey } from './types'

/**
 * Crash/reload continuity for chat: per-conversation drafts and the unsent
 * outbox. Deliberately narrow — the store is the source of truth while the
 * tab lives; this adapter only mirrors it and replays it at boot. Corrupt or
 * hand-edited payloads are rejected, never trusted.
 */

const DRAFTS_KEY = 'chat_drafts_v1'
const OUTBOX_KEY = 'chat_outbox_v1'
const MAX_DRAFT_BYTES = 4096
const MAX_OUTBOX_ITEMS = 50
const STALE_AFTER_MS = 24 * 60 * 60 * 1000

type DraftMap = Readonly<Record<string, string>>

const isStringRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

function readDrafts(): DraftMap {
  const raw = localStore.read<unknown>(DRAFTS_KEY, {})
  if (!isStringRecord(raw)) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.length <= MAX_DRAFT_BYTES) {
      out[partnerKey(key)] = value
    }
  }
  return out
}

const isEnvelope = (value: unknown): value is OutboundEnvelope => {
  if (!isStringRecord(value)) return false
  const state = value['state']
  const stateOk =
    isStringRecord(state) &&
    (state['kind'] === 'queued' ||
      state['kind'] === 'retry-scheduled' ||
      state['kind'] === 'rejected')
  return (
    typeof value['clientMessageId'] === 'string' &&
    typeof value['partner'] === 'string' &&
    typeof value['partnerName'] === 'string' &&
    typeof value['content'] === 'string' &&
    (value['messageType'] === 'text' || value['messageType'] === 'challenge') &&
    typeof value['createdAtSeconds'] === 'number' &&
    stateOk
  )
}

function readOutbox(): readonly OutboundEnvelope[] {
  const raw = localStore.read<unknown>(OUTBOX_KEY, [])
  if (!Array.isArray(raw)) return []
  const cutoffSeconds = (Date.now() - STALE_AFTER_MS) / 1000
  return raw
    .filter(isEnvelope)
    .filter((env) => env.createdAtSeconds >= cutoffSeconds)
    .slice(0, MAX_OUTBOX_ITEMS)
    .map((env) => ({
      ...env,
      // A send may have completed while the tab was gone: drop any persisted
      // 'sending' state back to the queue; the poll merge dedupes against
      // the server row via the echoed clientMessageId.
      state: env.state.kind === 'rejected' ? env.state : { kind: 'queued' as const },
    }))
}

export const localChatPersistence: PersistenceInterface = {
  loadDrafts: readDrafts,
  saveDrafts: (drafts) => {
    localStore.write(DRAFTS_KEY, drafts)
  },
  loadOutbox: readOutbox,
  saveOutbox: (envelopes) => {
    const persistable = envelopes.filter(
      (e) => e.state.kind === 'queued' || e.state.kind === 'retry-scheduled' || e.state.kind === 'rejected',
    )
    localStore.write(OUTBOX_KEY, persistable.slice(-MAX_OUTBOX_ITEMS))
  },
}
