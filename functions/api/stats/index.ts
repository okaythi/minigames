/// <reference types="@cloudflare/workers-types" />

import {
  applyStatsEvent,
  EMPTY_STATS_RECORD,
  parseGameStatsRecord,
  parseStatsEventBody,
  readField,
  type GameStatsRecord,
  type StatsEventResponseBody,
  type StatsResponseBody,
} from '../../../shared/stats-protocol'

/**
 * Cloudflare Pages Function backing the global "times played" / high-score
 * counters. Bound KV namespace: `GAMES_STATS` (see wrangler.jsonc).
 *
 * When the binding is missing (a fork, a preview without KV) the handler
 * answers with `distributed: false` and an in-memory table, so the front end
 * transparently falls back to per-browser localStorage counters.
 */

interface Env {
  readonly GAMES_STATS?: KVNamespace
}

interface StoredRecord {
  readonly stats: GameStatsRecord
  readonly nonces: readonly string[]
}

const memory = new Map<string, StoredRecord>()
const MAX_TRACKED_NONCES = 32

const json = (status: number, payload: unknown, cacheSeconds = 25): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': status === 200 ? `public, max-age=${cacheSeconds}` : 'no-store',
    },
  })

const badRequest = (reason: string): Response =>
  json(400, { ok: false, stats: null, error: reason } satisfies StatsEventResponseBody & {
    error: string
  })

const statsKey = (slug: string): string => `stats:${slug}`

const validSlug = (slug: string): boolean => /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)

function parseBody(raw: string): { game: string; body: NonNullable<ReturnType<typeof parseStatsEventBody>> } | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  const body = parseStatsEventBody(parsed)
  if (body === null || !validSlug(body.game)) {
    return null
  }
  return { game: body.game, body }
}

async function readRecord(env: Env, slug: string): Promise<StoredRecord> {
  if (env.GAMES_STATS === undefined) {
    return memory.get(slug) ?? { stats: EMPTY_STATS_RECORD, nonces: [] }
  }
  const stored: unknown = await env.GAMES_STATS.get(statsKey(slug), 'json')
  if (typeof stored !== 'object' || stored === null) {
    return { stats: EMPTY_STATS_RECORD, nonces: [] }
  }
  const nonces = readField(stored, 'nonces')
  return {
    stats: parseGameStatsRecord(readField(stored, 'stats')) ?? EMPTY_STATS_RECORD,
    nonces: Array.isArray(nonces) ? nonces.filter((entry): entry is string => typeof entry === 'string') : [],
  }
}

async function writeRecord(env: Env, slug: string, record: StoredRecord): Promise<void> {
  if (env.GAMES_STATS === undefined) {
    memory.set(slug, record)
    return
  }
  await env.GAMES_STATS.put(statsKey(slug), JSON.stringify(record))
}

export const onRequestGet: (
  context: { request: Request; env: Env },
) => Promise<Response> = async ({ env }) => {
  const slugs = listKnownSlugs()
  const games: Record<string, GameStatsRecord> = {}
  await Promise.all(
    slugs.map(async (slug) => {
      const { stats } = await readRecord(env, slug)
      games[slug] = stats
    }),
  )
  for (const [slug, record] of memory) {
    games[slug] ??= record.stats
  }
  const payload: StatsResponseBody = {
    ok: true,
    games,
    distributed: env.GAMES_STATS !== undefined,
  }
  return json(200, payload)
}

export const onRequestPost: (
  context: { request: Request; env: Env },
) => Promise<Response> = async ({ request, env }) => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return badRequest('expected application/json')
  }
  const parsed = parseBody(await request.text())
  if (parsed === null) {
    return badRequest('invalid payload')
  }
  const { game, body } = parsed
  const stored = await readRecord(env, game)
  if (stored.nonces.includes(body.nonce)) {
    return json(200, { ok: true, stats: stored.stats } satisfies StatsEventResponseBody, 0)
  }
  const stats = applyStatsEvent(stored.stats, body.event, Date.now())
  await writeRecord(env, game, {
    stats,
    nonces: [body.nonce, ...stored.nonces].slice(0, MAX_TRACKED_NONCES),
  })
  return json(200, { ok: true, stats } satisfies StatsEventResponseBody, 0)
}

/**
 * Slugs are read from a static list so a hostile client cannot force the
 * function to enumerate or mint unbounded KV keys.
 */
function listKnownSlugs(): readonly string[] {
  return ['avoid-the-spikes']
}
