import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { ALLOWED_SLUGS, isAllowedGameSlug } from '../shared/game-slugs'
import { statsStoreFrom } from '../shared/memory-store'
import { parseSyncCode, serializePlayerCookie } from '../shared/player-cookie'
import { parseStatsEventBody, readField, isRecordOfStats, STATS_ENDPOINT } from '../shared/stats-protocol'
import type { StatsMemory } from '../shared/memory-store'
import type { StatsStore } from '../shared/stats-store'
import { loadStatsMemory, saveStatsMemory } from './stats-file'
import { headerOf, sendJson, readBody, parseJson, identitySignals } from './http-helpers'

/**
 * Local stand-in for the Pages Function, route for route: `/api/stats` and
 * `/api/stats/sync`.
 */

const SYNC_PATH = `${STATS_ENDPOINT}/sync`

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
            const snapshot = await store.snapshot(identity.id)
            sendJson(
              res,
              200,
              {
                ok: true,
                games: snapshot.games,
                uniquePlayers: snapshot.uniquePlayers,
                player: snapshot.player,
                distributed: store.distributed,
              },
              identity.reanchor && identity.id !== null ? serializePlayerCookie(identity.id) : null,
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
            identity.reanchor && identity.id !== null ? serializePlayerCookie(identity.id) : null,
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
          sendJson(res, 400, { ok: false, player: null, error: 'expected { syncCode: "XXXX-XXXX" }' }, null)
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
