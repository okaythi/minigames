import {
  parseStatsEventBody,
  type StatsEventResponseBody,
  type StatsResponseBody,
} from '../../../shared/stats-protocol'
import { d1Store, memoryStore, type StatsStore } from './store'

/**
 * Cloudflare Pages Function for the counters.
 *
 * GET  /api/stats  -> every game's record + the unique-player total
 * POST /api/stats  -> one event (visit | play | score), nonce-guarded
 *
 * Backed by D1 (binding `NIXLABS_DB`, schema in `migrations/0001_init.sql`).
 * Without the binding it answers from memory and reports `distributed: false`,
 * so the front end labels its numbers honestly instead of failing.
 */

interface Env {
  readonly NIXLABS_DB?: D1Database
}

interface PagesContext {
  readonly request: Request
  readonly env: Env
}

/**
 * Slugs are allow-listed so a hostile client cannot make the function mint
 * unbounded rows. Adding a game means adding it here as well as to the
 * registry - see docs/adding-a-game.md.
 */
const ALLOWED_SLUGS: readonly string[] = ['avoid-the-spikes']

const MAX_BODY_BYTES = 2048

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

const validSlug = (slug: string): boolean => /^[a-z0-9][a-z0-9-]{0,63}$/.test(slug)

const storeFor = (env: Env): StatsStore =>
  env.NIXLABS_DB === undefined ? memoryStore(ALLOWED_SLUGS) : d1Store(env.NIXLABS_DB)

async function readJsonBody(request: Request): Promise<unknown> {
  const buffer = await request.arrayBuffer()
  if (buffer.byteLength > MAX_BODY_BYTES) {
    return null
  }
  try {
    return JSON.parse(new TextDecoder().decode(buffer)) as unknown
  } catch {
    return null
  }
}

export const onRequestGet = async ({ env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { games, uniquePlayers } = await store.snapshot()
  const payload: StatsResponseBody = {
    ok: true,
    games,
    uniquePlayers,
    distributed: store.distributed,
  }
  return json(200, payload)
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return badRequest('expected application/json')
  }
  const body = parseStatsEventBody(await readJsonBody(request))
  if (body === null) {
    return badRequest('invalid payload')
  }
  // Site-wide visits carry no game slug; everything else must name a known one.
  const gameOk =
    body.event.type === 'visit'
      ? body.game.length === 0
      : validSlug(body.game) && ALLOWED_SLUGS.includes(body.game)
  if (!gameOk) {
    return badRequest('unknown game')
  }

  const store = storeFor(env)
  const stats = await store.apply({
    game: body.game,
    event: body.event,
    nonce: body.nonce,
    playerId: body.playerId ?? null,
  })
  const { uniquePlayers } = await store.snapshot()
  return json(200, { ok: true, stats, uniquePlayers } satisfies StatsEventResponseBody, 0)
}
