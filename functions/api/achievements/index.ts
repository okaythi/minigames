/**
 * GET  /api/achievements  — returns the authenticated player's achievement states.
 * POST /api/achievements  — unlocks or bumps progress on a specific achievement.
 *
 * One file, two verbs, no business logic: all logic lives in evaluator.ts
 * and d1-achievements.ts.
 */

import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, playerGames, gameStats } from '../../../src/db/schema'
import { jsonResponse, badRequest } from '../stats/respond'
import { identifyPlayer } from '../stats/identity'
import { storeFor, type StatsEnv } from '../stats/store-for'
import {
  loadPlayerAchievements,
  upsertAchievement,
  recordDailyActivity,
} from './d1-achievements'
import { evaluatePlatformAchievements } from './evaluator'
import type { AchievementId } from '../../../shared/achievements-protocol'
import { ACHIEVEMENT_DEFS } from '../../../shared/achievement-defs'
import { isRecordOfStats, readField } from '../../../shared/stats-protocol'
import { parseFlags } from '../../../shared/flags'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

const VALID_ACHIEVEMENT_IDS = new Set<string>(ACHIEVEMENT_DEFS.map((def) => def.id))


export const onRequestGet = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const db = drizzle(env.NIXLABS_DB)
  const existing = await loadPlayerAchievements(db, playerId)

  // Also run platform evaluator to auto-sync any newly earned platform badges
  const [user, playerRow, playerGameRows, globalStatsRows] = await Promise.all([
    db.select().from(users).where(eq(users.playerId, playerId)).get(),
    db.select().from(players).where(eq(players.id, playerId)).get(),
    db.select().from(playerGames).where(eq(playerGames.playerId, playerId)).all(),
    db.select().from(gameStats).all(),
  ])

  if (user) {
    const globalStatsMap = new Map(globalStatsRows.map((gs) => [gs.slug, gs]))
    const totalPlays = playerGameRows.reduce((sum, pg) => sum + (pg.plays || 0), 0)
    const sumGamesCandy = playerGameRows.reduce((sum, pg) => sum + (pg.candy || 0), 0)
    const totalCandy = playerRow?.candy ?? sumGamesCandy
    const gamesPlayedSlugs = playerGameRows
      .filter((pg) => (pg.plays || 0) > 0)
      .map((pg) => pg.slug)

    let arcadeRatingPercent = 100
    let recordsHeld = 0
    for (const pg of playerGameRows) {
      if (pg.slug === 'card-jitsu') continue
      const gs = globalStatsMap.get(pg.slug)
      let userBest = pg.highscore
      let globalBest = gs?.highscore ?? null
      if (pg.slug === 'fl-tron-3') {
        if (userBest !== null && userBest <= 1000) userBest = null
        if (globalBest !== null && globalBest <= 1000) globalBest = null
      }
      if (userBest !== null && globalBest !== null &&
          userBest > 0 && userBest >= globalBest) {
        recordsHeld++
      }
    }
    if (recordsHeld > 0) arcadeRatingPercent = 1
    else if (totalPlays >= 100 || totalCandy >= 100) arcadeRatingPercent = 4
    else if (totalPlays >= 30 || totalCandy >= 30) arcadeRatingPercent = 12
    else if (totalPlays >= 10) arcadeRatingPercent = 25

    const todayUtc = new Date().toISOString().slice(0, 10)
    const streakDays = await recordDailyActivity(db, playerId, todayUtc)

    const updates = evaluatePlatformAchievements(
      {
        totalCandy,
        totalPlays,
        streakDays,
        legacyUser: user.legacyUser === 1,
        developer: user.developer === 1,
        flags: parseFlags(user.flags),
        hasPfp: user.pfpR2Key !== null,
        hasNickname: user.nickname !== null,
        arcadeRatingPercent,
        gamesPlayedSlugs,
        allGameSlugs: ['avoid-the-spikes', 'pong', 'fl-tron-3', 'card-jitsu'],
      },
      existing,
    )

    const now = Math.floor(Date.now() / 1000)
    for (const update of updates) {
      await upsertAchievement(
        db,
        playerId,
        update.id,
        update.progress,
        update.shouldUnlock ? now : null,
      )
    }
  }

  // Re-load after potential updates
  const fresh = await loadPlayerAchievements(db, playerId)
  return jsonResponse(200, { ok: true, achievements: fresh })
}

export const onRequestPost = async ({ request, env }: PagesContext): Promise<Response> => {
  const store = storeFor(env)
  const { playerId } = await identifyPlayer(request, store)
  if (!playerId) {
    return badRequest('unauthorized')
  }

  const json: unknown = await request.json()
  if (!isRecordOfStats(json)) {
    return badRequest('invalid payload')
  }

  const idRaw = readField(json, 'id')
  if (typeof idRaw !== 'string' || !VALID_ACHIEVEMENT_IDS.has(idRaw)) {
    return badRequest('unknown achievement id')
  }

  const id = idRaw as AchievementId
  const progressRaw = readField(json, 'progress')
  const progress = typeof progressRaw === 'number' && Number.isFinite(progressRaw)
    ? Math.max(0, Math.floor(progressRaw))
    : 0

  const db = drizzle(env.NIXLABS_DB)

  // Guard: do not re-unlock already-unlocked achievements
  const existing = await loadPlayerAchievements(db, playerId)
  const prevState = existing.find((a) => a.id === id)
  if (prevState?.unlockedAt !== null && prevState?.unlockedAt !== undefined) {
    return jsonResponse(200, { ok: true, alreadyUnlocked: true })
  }

  const now = Math.floor(Date.now() / 1000)
  await upsertAchievement(db, playerId, id, progress, now)

  return jsonResponse(200, { ok: true, unlockedAt: now })
}
