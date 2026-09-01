import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import {
  applyStatsEvent,
  parseGameStatsRecord,
  EMPTY_STATS_RECORD,
  parseStatsEventBody,
  readField,
  STATS_ENDPOINT,
  type GameStatsRecord,
  type StatsMap,
} from '../shared/stats-protocol'

/**
 * Local stand-in for `functions/api/stats/index.ts`.
 *
 * On Cloudflare Pages the counters live in a KV namespace; `vite dev` has no
 * KV, so this middleware implements the exact same endpoint against a JSON
 * file. The browser code is therefore identical in both environments and the
 * "times played" counter really is shared across tabs/machines on the LAN.
 */

interface PersistedStats {
  games: Record<string, GameStatsRecord>
  recentNonces: string[]
}

const MAX_TRACKED_NONCES = 64

const emptyStats = (): PersistedStats => ({ games: {}, recentNonces: [] })

const parseBody = (raw: string): ReturnType<typeof parseStatsEventBody> => {
  try {
    return parseStatsEventBody(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

const readBody = async (req: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer: Buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
    size += buffer.byteLength
    if (size > 64 * 1024) {
      throw new Error('payload too large')
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks).toString('utf8')
}

export function statsDevPlugin(): Plugin {
  let filePath = resolve('.nixlabs/stats.json')

  const load = async (): Promise<PersistedStats> => {
    try {
      const raw = await readFile(filePath, 'utf8')
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) {
        return emptyStats()
      }
      const gamesRaw = readField(parsed, 'games')
      const noncesRaw = readField(parsed, 'recentNonces')
      const games: Record<string, GameStatsRecord> = {}
      if (typeof gamesRaw === 'object' && gamesRaw !== null) {
        for (const [key, value] of Object.entries(gamesRaw as Record<string, unknown>)) {
          const candidate = parseGameStatsRecord(value)
          if (candidate !== null) {
            games[key] = candidate
          }
        }
      }
      return {
        games,
        recentNonces: Array.isArray(noncesRaw)
          ? noncesRaw.filter((entry): entry is string => typeof entry === 'string')
          : [],
      }
    } catch {
      return emptyStats()
    }
  }

  const save = async (stats: PersistedStats): Promise<void> => {
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, `${JSON.stringify(stats, null, 2)}\n`, 'utf8')
  }

  return {
    name: 'nixlabs:stats-dev',
    apply: 'serve',
    configResolved(config) {
      filePath = resolve(config.root, '.nixlabs/stats.json')
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (!url.startsWith(STATS_ENDPOINT)) {
          next()
          return
        }
        try {
          if (req.method === 'GET' || req.method === 'HEAD') {
            const stats = await load()
            const games: StatsMap = stats.games
            sendJson(res, 200, { ok: true, games, distributed: false })
            return
          }
          if (req.method === 'POST') {
            const body = parseBody(await readBody(req))
            if (body === null) {
              sendJson(res, 400, { ok: false, stats: null, error: 'invalid payload' })
              return
            }
            const stats = await load()
            if (stats.recentNonces.includes(body.nonce)) {
              sendJson(res, 200, {
                ok: true,
                stats: stats.games[body.game] ?? EMPTY_STATS_RECORD,
              })
              return
            }
            const current = stats.games[body.game] ?? EMPTY_STATS_RECORD
            const nextRecord = applyStatsEvent(current, body.event, Date.now())
            stats.games[body.game] = nextRecord
            stats.recentNonces = [body.nonce, ...stats.recentNonces].slice(0, MAX_TRACKED_NONCES)
            await save(stats)
            sendJson(res, 200, { ok: true, stats: nextRecord })
            return
          }
          sendJson(res, 405, { ok: false, stats: null, error: 'method not allowed' })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'unknown error'
          sendJson(res, 500, { ok: false, stats: null, error: message })
        }
      })
    },
  }
}
