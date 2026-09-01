import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { dirname, resolve } from 'node:path'
import type { Plugin } from 'vite'
import {
  applyStatsEvent,
  EMPTY_STATS_RECORD,
  parseGameStatsRecord,
  parseStatsEventBody,
  readField,
  STATS_ENDPOINT,
  type GameStatsRecord,
  type StatsMap,
} from '../shared/stats-protocol'

/**
 * Local stand-in for `functions/api/stats/index.ts`.
 *
 * On Cloudflare Pages the counters live in D1; `vite dev` has no database, so
 * this middleware implements the exact same endpoint (including the
 * unique-player count and the nonce guard) against a JSON file. The browser
 * code is therefore identical in both environments.
 */

interface PersistedStats {
  games: Record<string, GameStatsRecord>
  players: string[]
  recentNonces: string[]
}

const MAX_TRACKED_NONCES = 64
const MAX_BODY_BYTES = 2048

const emptyStats = (): PersistedStats => ({ games: {}, players: [], recentNonces: [] })

const parseBody = (raw: string): ReturnType<typeof parseStatsEventBody> => {
  try {
    return parseStatsEventBody(JSON.parse(raw) as unknown)
  } catch {
    return null
  }
}

const sendJson = (res: ServerResponse, status: number, payload: unknown): void => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
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

export function statsDevPlugin(): Plugin {
  let filePath = resolve('.nixlabs/stats.json')

  const load = async (): Promise<PersistedStats> => {
    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'))
      const gamesRaw = readField(parsed, 'games')
      const playersRaw = readField(parsed, 'players')
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
      const list = (input: unknown): string[] =>
        Array.isArray(input) ? input.filter((entry): entry is string => typeof entry === 'string') : []
      return { games, players: list(playersRaw), recentNonces: list(noncesRaw) }
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
        if (!(req.url ?? '').startsWith(STATS_ENDPOINT)) {
          next()
          return
        }
        try {
          if (req.method === 'GET' || req.method === 'HEAD') {
            const stats = await load()
            const games: StatsMap = stats.games
            sendJson(res, 200, {
              ok: true,
              games,
              uniquePlayers: stats.players.length,
              // Local file, not a real fleet-wide database.
              distributed: false,
            })
            return
          }
          if (req.method === 'POST') {
            const body = parseBody(await readBody(req))
            if (body === null) {
              sendJson(res, 400, { ok: false, stats: null, error: 'invalid payload' })
              return
            }
            const stats = await load()
            if (!stats.recentNonces.includes(body.nonce)) {
              if (body.game.length > 0) {
                stats.games[body.game] = applyStatsEvent(
                  stats.games[body.game] ?? EMPTY_STATS_RECORD,
                  body.event,
                  Date.now(),
                )
              }
              const playerId = body.playerId
              if (typeof playerId === 'string' && !stats.players.includes(playerId)) {
                stats.players.push(playerId)
              }
              stats.recentNonces = [body.nonce, ...stats.recentNonces].slice(0, MAX_TRACKED_NONCES)
              await save(stats)
            }
            sendJson(res, 200, {
              ok: true,
              stats: stats.games[body.game] ?? EMPTY_STATS_RECORD,
              uniquePlayers: stats.players.length,
            })
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
