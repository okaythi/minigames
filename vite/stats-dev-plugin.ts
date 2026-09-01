import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { ALLOWED_SLUGS, isAllowedGameSlug } from '../shared/game-slugs'
import { statsStoreFrom } from '../shared/memory-store'
import {
  isFingerprint,
  isPlayerId,
  parseSyncCode,
  PLAYER_COOKIE_NAME,
  PLAYER_FINGERPRINT_HEADER,
  PLAYER_ID_HEADER,
  readCookie,
  serializePlayerCookie,
} from '../shared/player-cookie'
import { resolvePlayer, type ResolvedPlayer } from '../shared/resolve-player'
import { parseStatsEventBody, readField, isRecordOfStats, STATS_ENDPOINT } from '../shared/stats-protocol'
import type { StatsMemory } from '../shared/memory-store'
import type { StatsStore } from '../shared/stats-store'
import { loadStatsMemory, saveStatsMemory } from './stats-file'

/**
 * Local stand-in for the Pages Function, route for route: `/api/stats` and
 * `/api/stats/sync`, the same identity waterfall (cookie -> stored id ->
 * device hash -> new uuid), the same cookie, the same nonce window.
 *
 * It is not a second implementation of the rules. It hydrates the shared
 * memory store from `.nixlabs/stats.json`, so the only thing that differs from
 * production is the storage at the bottom.
 */

const MAX_BODY_BYTES = 2048
const SYNC_PATH = `${STATS_ENDPOINT}/sync`

const headerOf = (req: IncomingMessage, name: string): string | null => {
  const value = req.headers[name.toLowerCase()]
  return typeof value === 'string' ? value : null
}

const sendJson = (res: ServerResponse, status: number, payload: unknown, cookie: string | null): void => {
  res.statusCode = status
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  if (cookie !== null) {
    res.setHeader('set-cookie', cookie)
  }
  res.end(JSON.stringify(payload))
}

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.byteLength
    if (size > MAX_BODY_BYTES) {
      throw new Error('payload too large')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

const parseJson = (raw: string): unknown => {
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return null
  }
}

/** The three signals, read the way the Pages Function reads them. */
interface DevIdentity extends ResolvedPlayer {
  readonly fingerprint: string | null
}

const token = (value: string | null, valid: (candidate: string) => boolean): string | null =>
  value !== null && valid(value) ? value : null

const identitySignals = async (req: IncomingMessage, store: StatsStore): Promise<DevIdentity> => {
  const fingerprint = token(headerOf(req, PLAYER_FINGERPRINT_HEADER), isFingerprint)
  const resolved = await resolvePlayer(
    {
      cookieId: token(readCookie(headerOf(req, 'cookie'), PLAYER_COOKIE_NAME), isPlayerId),
      storedId: token(headerOf(req, PLAYER_ID_HEADER), isPlayerId),
      fingerprint,
    },
    { byFingerprint: store.findPlayerByFingerprint },
  )
  return { ...resolved, fingerprint }
}

export function statsDevPlugin(): Plugin {
  let filePath = resolve('.nixlabs/stats.json')

  return {
    name: 'nixlabs:stats-dev',
    apply: 'serve',
    configResolved(config) {
      filePath = resolve(config.root, '.nixlabs/stats.json')
    },
    configureServer(server) {
      const withStore = async <T>(run: (store: StatsStore, memory: StatsMemory) => Promise<T>): Promise<T> => {
        const memory = await loadStatsMemory(filePath, ALLOWED_SLUGS)
        const result = await run(statsStoreFrom(memory, false), memory)
        await saveStatsMemory(filePath, memory)
        return result
      }

      const handleStats = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (headerOf(req, 'x-nixlabs-client') !== '1') {
          sendJson(res, 400, { ok: false, error: 'invalid client' }, null)
          return
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
          await withStore(async (store) => {
            const identity = await identitySignals(req, store)
            const { games, uniquePlayers, player } = await store.snapshot(identity.id)
            // No shared cache in dev: the file changes under the response.
            sendJson(
              res,
              200,
              { ok: true, games, uniquePlayers, player, distributed: store.distributed },
              identity.reanchor ? serializePlayerCookie(identity.id) : null,
            )
          })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, stats: null, player: null, error: 'method not allowed' }, null)
          return
        }
        const body = parseStatsEventBody(parseJson(await readBody(req)))
        if (body === null) {
          sendJson(res, 400, { ok: false, stats: null, player: null, error: 'invalid payload' }, null)
          return
        }
        // A site-wide visit carries no slug; everything else must be a known game.
        if (body.event.type !== 'visit' && !isAllowedGameSlug(body.game)) {
          sendJson(res, 400, { ok: false, stats: null, player: null, error: 'unknown game' }, null)
          return
        }
        await withStore(async (store) => {
          const identity = await identitySignals(req, store)
          const result = await store.apply({
            game: body.game,
            event: body.event,
            nonce: body.nonce,
            playerId: identity.id,
            fingerprint: identity.fingerprint,
          })
          sendJson(
            res,
            200,
            { ok: true, stats: result.stats, uniquePlayers: result.uniquePlayers, player: result.player },
            identity.reanchor ? serializePlayerCookie(identity.id) : null,
          )
        })
      }

      const handleSync = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        if (headerOf(req, 'x-nixlabs-client') !== '1') {
          sendJson(res, 400, { ok: false, error: 'invalid client' }, null)
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, player: null, error: 'method not allowed' }, null)
          return
        }
        const raw = parseJson(await readBody(req))
        const code = isRecordOfStats(raw) ? parseSyncCode(readField(raw, 'syncCode')) : null
        if (code === null) {
          sendJson(res, 400, { ok: false, player: null, error: 'expected { syncCode: "K9F2-P7X1" }' }, null)
          return
        }
        await withStore(async (store) => {
          const identity = await identitySignals(req, store)
          const claimed = await store.claimSyncCode(code, identity.id)
          if (claimed === null) {
            sendJson(res, 404, { ok: false, player: null, error: 'unknown code' }, null)
            return
          }
          sendJson(res, 200, { ok: true, player: claimed }, serializePlayerCookie(claimed.id))
        })
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(STATS_ENDPOINT)) {
          next()
          return
        }
        try {
          if (url.startsWith(SYNC_PATH)) {
            await handleSync(req, res)
            return
          }
          await handleStats(req, res)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error'
          sendJson(res, 500, { ok: false, stats: null, player: null, error: message }, null)
        }
      })
    },
  }
}
