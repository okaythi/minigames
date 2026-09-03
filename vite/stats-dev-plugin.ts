import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { ALLOWED_SLUGS, isAllowedGameSlug } from '../shared/game-slugs'
import { ACHIEVEMENT_DEFS } from '../shared/achievement-defs'
import { statsStoreFrom } from '../shared/memory-store'
import { parseSyncCode, serializePlayerCookie } from '../shared/player-cookie'
import { parseStatsEventBody, readField, isRecordOfStats, STATS_ENDPOINT } from '../shared/stats-protocol'
import type { StatsMemory } from '../shared/memory-store'
import type { StatsStore } from '../shared/stats-store'
import { loadStatsMemory, saveStatsMemory } from './stats-file'
import { headerOf, sendJson, readBody, parseJson, identitySignals } from './http-helpers'
import { UserFlags } from '../shared/flags'

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

      // Dev in-memory user store
      interface DevUser {
        username: string
        passwordHash: string
        playerId: string
        nickname: string | null
        nicknameChangedCount: number
        pfpUrl: string | null
        createdOn: number
        legacyUser: boolean
        developer: boolean
        flags: UserFlags
      }

      const devUsers = new Map<string, DevUser>()
      const devPlayerToUsername = new Map<string, string>()

      const handleAuth = async (req: IncomingMessage, res: ServerResponse, url: string): Promise<void> => {
        if (url === '/api/auth/register' && req.method === 'POST') {
          const body = parseJson(await readBody(req)) as any
          if (!body || !body.username || !body.password) {
            sendJson(res, 400, { ok: false, error: 'invalid payload' }, null)
            return
          }
          const username = String(body.username).toLowerCase()
          if (devUsers.has(username)) {
            sendJson(res, 400, { ok: false, error: 'username taken' }, null)
            return
          }
          await withStore(async (store) => {
            const identity = await identitySignals(req, store)
            const playerId = identity.id || crypto.randomUUID()
            const newUser: DevUser = {
              username,
              passwordHash: body.password,
              playerId,
              nickname: null,
              nicknameChangedCount: 0,
              pfpUrl: null,
              createdOn: Math.floor(Date.now() / 1000),
              legacyUser: true,
              developer: username === 'thy',
              flags: UserFlags.USER_PIONEER | (username === 'thy' ? (UserFlags.USER_DEVELOPER | UserFlags.STAFF | UserFlags.CMS_EDITOR) : UserFlags.NONE),
            }
            devUsers.set(username, newUser)
            devPlayerToUsername.set(playerId, username)
            sendJson(res, 200, { ok: true, username }, serializePlayerCookie(playerId))
          })
          return
        }

        if (url === '/api/auth/login' && req.method === 'POST') {
          const body = parseJson(await readBody(req)) as any
          if (!body || !body.username || !body.password) {
            sendJson(res, 400, { ok: false, error: 'invalid payload' }, null)
            return
          }
          const username = String(body.username).toLowerCase()
          const user = devUsers.get(username)
          if (!user || user.passwordHash !== body.password) {
            sendJson(res, 400, { ok: false, error: 'invalid username or password' }, null)
            return
          }
          devPlayerToUsername.set(user.playerId, username)
          sendJson(res, 200, { ok: true, username }, serializePlayerCookie(user.playerId))
          return
        }

        if (url === '/api/auth/logout' && req.method === 'POST') {
          sendJson(res, 200, { ok: true }, 'player_id=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict')
          return
        }

        sendJson(res, 404, { ok: false, error: 'not found' }, null)
      }

      const devAchievementsStore = new Map<string, Map<string, { progress: number; unlockedAt: number | null }>>()

      const handleUsers = async (req: IncomingMessage, res: ServerResponse, url: string): Promise<void> => {
        if (url === '/api/users/me') {
          await withStore(async (store) => {
            const identity = await identitySignals(req, store)
            if (!identity.id) {
              sendJson(res, 400, { ok: false, error: 'unauthorized' }, null)
              return
            }
            let username = devPlayerToUsername.get(identity.id)
            let user = username ? devUsers.get(username) : null

            if (!user) {
              // Auto create default user for convenience in dev
              user = {
                username: 'thy',
                passwordHash: 'password',
                playerId: identity.id,
                nickname: 'Lab Pioneer',
                nicknameChangedCount: 0,
                pfpUrl: null,
                createdOn: Math.floor(Date.now() / 1000) - 86400 * 30,
                legacyUser: true,
                developer: true,
                flags: UserFlags.USER_DEVELOPER | UserFlags.USER_PIONEER | UserFlags.STAFF | UserFlags.CMS_EDITOR,
              }
              devUsers.set('thy', user)
              devPlayerToUsername.set(identity.id, 'thy')
            }

            if (req.method === 'GET') {
              sendJson(res, 200, {
                ok: true,
                profile: {
                  username: user.username,
                  nickname: user.nickname,
                  pfpUrl: user.pfpUrl,
                  legacyUser: user.legacyUser,
                  developer: user.developer,
                  flags: user.flags,
                  nicknameChangedCount: user.nicknameChangedCount,
                  createdOn: user.createdOn,
                },
              }, null)
              return
            }

            if (req.method === 'PUT') {
              const body = parseJson(await readBody(req)) as Record<string, unknown> | null
              const nickname = body ? body['nickname'] : undefined
              if (!nickname || typeof nickname !== 'string') {
                sendJson(res, 400, { ok: false, error: 'invalid payload' }, null)
                return
              }
              if (user.nicknameChangedCount >= 1) {
                sendJson(res, 400, { ok: false, error: 'nickname can only be changed once' }, null)
                return
              }
              user.nickname = nickname.trim().slice(0, 30)
              user.nicknameChangedCount += 1
              sendJson(res, 200, { ok: true }, null)
              return
            }

            if (req.method === 'POST') {
              const chunks: Buffer[] = []
              for await (const chunk of req) {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
              }
              const buffer = Buffer.concat(chunks)
              const mime = req.headers['content-type'] || 'image/png'
              const base64 = `data:${mime};base64,${buffer.toString('base64')}`
              user.pfpUrl = base64
              sendJson(res, 200, { ok: true, pfpUrl: base64 }, null)
              return
            }

            sendJson(res, 405, { ok: false, error: 'method not allowed' }, null)
          })
          return
        }

        if (url.startsWith('/api/users/')) {
          const rawParam = url.slice('/api/users/'.length).split('?')[0] ?? ''
          const targetUsername = rawParam.toLowerCase()
          let user = devUsers.get(targetUsername)
          if (!user && targetUsername === 'thy') {
            user = {
              username: 'thy',
              passwordHash: 'password',
              playerId: 'dev-thy-id',
              nickname: 'Lab Pioneer',
              nicknameChangedCount: 0,
              pfpUrl: null,
              createdOn: Math.floor(Date.now() / 1000) - 86400 * 30,
              legacyUser: true,
              developer: true,
              flags: UserFlags.USER_DEVELOPER | UserFlags.USER_PIONEER | UserFlags.STAFF | UserFlags.CMS_EDITOR,
            }
            devUsers.set('thy', user)
          }

          if (!user) {
            sendJson(res, 404, { ok: false, error: 'user not found' }, null)
            return
          }

          const targetUser = user
          await withStore(async (store, memory) => {
            const identity = await identitySignals(req, store)
            const effectivePlayerId = targetUser.playerId === 'dev-thy-id' && identity.id ? identity.id : targetUser.playerId
            const playerRecord = memory.players.get(effectivePlayerId) || memory.players.get(targetUser.playerId) || null
            const sumGamesCandy = Object.values(playerRecord?.games ?? {}).reduce((s, g) => s + (g.candy || 0), 0)
            const totalCandy = Math.max(playerRecord?.candy ?? 0, sumGamesCandy)
            const totalPlays = 244

            const games = {
              'avoid-the-spikes': {
                slug: 'avoid-the-spikes',
                title: 'Avoid the Spikes!',
                plays: 189,
                highscore: playerRecord?.games['avoid-the-spikes']?.highscore ?? 30,
                candy: playerRecord?.games['avoid-the-spikes']?.candy ?? 85,
                globalHighscore: memory.games.get('avoid-the-spikes')?.highscore ?? 30,
                isRecordHolder: (playerRecord?.games['avoid-the-spikes']?.highscore ?? 30) >= (memory.games.get('avoid-the-spikes')?.highscore ?? 30),
                percentile: 'Top 1%',
                updatedAt: Date.now(),
              },
              'pong': {
                slug: 'pong',
                title: 'Pong',
                plays: 14,
                highscore: playerRecord?.games['pong']?.highscore ?? 79,
                candy: playerRecord?.games['pong']?.candy ?? 20,
                globalHighscore: memory.games.get('pong')?.highscore ?? 94,
                isRecordHolder: false,
                percentile: 'Top 12%',
                updatedAt: Date.now(),
              },
              'fl-tron-3': {
                slug: 'fl-tron-3',
                title: 'FL Tron 3.0',
                plays: 41,
                highscore: playerRecord?.games['fl-tron-3']?.highscore ?? 4,
                candy: playerRecord?.games['fl-tron-3']?.candy ?? 14,
                globalHighscore: memory.games.get('fl-tron-3')?.highscore ?? 6,
                isRecordHolder: false,
                percentile: 'Top 25%',
                updatedAt: Date.now(),
              },
            }

            const devAchievements = devAchievementsStore.get(user.username) || new Map<string, { progress: number; unlockedAt: number | null }>()

            const badges = ACHIEVEMENT_DEFS.map((def) => {
              const state = devAchievements.get(def.id)
              const unlocked = state?.unlockedAt !== null && state?.unlockedAt !== undefined
              const progress = state?.progress ?? 0
              return {
                id: def.id,
                pillar: def.pillar,
                track: def.track,
                name: def.name,
                description: def.description,
                icon: def.icon,
                unlocked: unlocked || (def.id === 'identity_developer' && user.developer) || (def.id === 'identity_lab_pioneer' && user.legacyUser) || def.id === 'identity_claimed' || def.id === 'identity_picture_perfect',
                unlockedAt: state?.unlockedAt ?? null,
                progress: def.maxProgress !== null ? { current: progress, max: def.maxProgress } : undefined,
              }
            })

            const recentActivity = [
              {
                id: 'act-avoid',
                text: 'Scored 30 on Avoid the Spikes! (World Record)',
                timeAgo: '2h ago',
                icon: '🎯',
              },
              {
                id: 'act-candy',
                text: 'Collected 14 Candy in Pong',
                timeAgo: '1d ago',
                icon: '🍬',
              },
              {
                id: 'act-tron',
                text: 'Cleared Stage 4 in FL Tron Campaign',
                timeAgo: '2d ago',
                icon: '🏍️',
              },
              {
                id: 'act-join',
                text: 'Joined Nixlabs Games arcade',
                timeAgo: 'Aug 2026',
                icon: '✨',
              },
            ]

            sendJson(res, 200, {
              ok: true,
              profile: {
                username: user.username,
                nickname: user.nickname,
                pfpUrl: user.pfpUrl,
                legacyUser: user.legacyUser,
                developer: user.developer,
                flags: user.flags,
                nicknameChangedCount: user.nicknameChangedCount,
                createdOn: user.createdOn,
                totalPlays,
                totalCandy,
                recordsHeld: 1,
                recordsList: ['Avoid the Spikes!'],
                arcadeRating: 'Top 4%',
                title: 'Record Holder',
                activeStreak: 5,
                streakDays: [true, true, true, true, true, false, false],
                badges,
                games,
                recentActivity,
              },
            }, null)
          })
          return
        }

        sendJson(res, 404, { ok: false, error: 'not found' }, null)
      }

      const handleAchievements = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
        await withStore(async (store) => {
          const identity = await identitySignals(req, store)
          const key = identity.id || 'anonymous'
          let playerMap = devAchievementsStore.get(key)
          if (!playerMap) {
            playerMap = new Map()
            devAchievementsStore.set(key, playerMap)
          }

          if (req.method === 'GET') {
            const list = Array.from(playerMap.entries()).map(([id, val]) => ({ id, ...val }))
            sendJson(res, 200, { ok: true, achievements: list }, null)
            return
          }

          if (req.method === 'POST') {
            const body = parseJson(await readBody(req)) as Record<string, unknown> | null
            const rawId = body ? body['id'] : undefined
            const id = typeof rawId === 'string' ? rawId : null
            const rawProgress = body ? body['progress'] : undefined
            const progress = typeof rawProgress === 'number' ? rawProgress : 0
            if (!id) {
              sendJson(res, 400, { ok: false, error: 'missing id' }, null)
              return
            }

            const existing = playerMap.get(id)
            const alreadyUnlocked = existing?.unlockedAt != null
            const now = Math.floor(Date.now() / 1000)
            const updated = {
              progress: Math.max(existing?.progress ?? 0, progress),
              unlockedAt: alreadyUnlocked ? existing!.unlockedAt : now,
            }
            playerMap.set(id, updated)

            sendJson(res, 200, { ok: true, unlockedAt: updated.unlockedAt, alreadyUnlocked }, null)
            return
          }

          sendJson(res, 405, { ok: false, error: 'method not allowed' }, null)
        })
      }

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? ''
        if (url.startsWith('/api/auth/')) {
          try {
            await handleAuth(req, res, url)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown error'
            sendJson(res, 500, { ok: false, error: message }, null)
          }
          return
        }

        if (url.startsWith('/api/users/')) {
          try {
            await handleUsers(req, res, url)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown error'
            sendJson(res, 500, { ok: false, error: message }, null)
          }
          return
        }

        if (url.startsWith('/api/achievements')) {
          try {
            await handleAchievements(req, res)
          } catch (err) {
            const message = err instanceof Error ? err.message : 'unknown error'
            sendJson(res, 500, { ok: false, error: message }, null)
          }
          return
        }

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

