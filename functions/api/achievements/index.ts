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
import { isRecordOfStats, readField } from '../../../shared/stats-protocol'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
}

const VALID_ACHIEVEMENT_IDS = new Set<string>([
  'candy_sweet_tooth', 'candy_hoarder', 'candy_sugar_maniac', 'candy_confectionery_tycoon',
  'runs_first_quarter', 'runs_arcade_regular', 'runs_arcade_veteran', 'runs_living_legend',
  'streak_double_play', 'streak_workweek_warrior', 'streak_full_week_punch', 'streak_fortnight_fortitude',
  'identity_claimed', 'identity_picture_perfect', 'identity_lab_pioneer',
  'social_passport_stamp', 'social_gauntlet_thrown', 'social_top_bracket',
  'explore_grand_tour', 'explore_terminal_velocity',
  'avoid_wall_tapper', 'avoid_wall_bouncer', 'avoid_spike_hopper', 'avoid_century_flyer',
  'avoid_candy_snack', 'avoid_candy_mid_air', 'avoid_candy_sweet_flight', 'avoid_candy_gem_swarm',
  'avoid_mover_moving_teeth', 'avoid_mover_slalom_pilot', 'avoid_mover_chaos_navigator',
  'avoid_graze_razor', 'avoid_graze_danger_dancer', 'avoid_graze_needle_threader',
  'avoid_edge_ceiling_skimmer', 'avoid_edge_floor_sweeper', 'avoid_edge_oblivion',
  'avoid_flap_one_tap', 'avoid_flap_quick_turnaround', 'avoid_flap_veteran_grazer',
  'pong_rally_opener', 'pong_paddle_ace', 'pong_kinetic_maestro', 'pong_infinite_volley',
  'pong_novice_shifter', 'pong_calculated_return', 'pong_precision_veteran', 'pong_grandmasters_end',
  'pong_kinematic_anomaly', 'pong_algorithm_slayer',
  'pong_solid_defense', 'pong_total_shutout', 'pong_flawless_hard',
  'pong_loaded_paddle', 'pong_tactical_triad', 'pong_full_arsenal', 'pong_max_loadout',
  'pong_magnetic_trap', 'pong_glass_savior', 'pong_turbo_smash',
  'tron_grid_initiate', 'tron_vector_hunter', 'tron_tactical_nemesis', 'tron_master_core_overload',
  'tron_nitro_ignition', 'tron_turbo_cut', 'tron_triple_burner', 'tron_pure_kinetic',
  'tron_closed_grid', 'tron_iron_coil', 'tron_claustrophobia',
  'tron_dominant_round', 'tron_clean_sweep', 'tron_immortal_cycle',
  'tron_buffered_90', 'tron_hairpin_double', 'tron_razor_corridor',
  'tron_five_second_blitz', 'tron_three_second_flash', 'tron_master_speedrunner',
])

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
    const totalCandy = playerRow?.candy ?? 0
    const gamesPlayedSlugs = playerGameRows
      .filter((pg) => (pg.plays || 0) > 0)
      .map((pg) => pg.slug)

    let arcadeRatingPercent = 100
    let recordsHeld = 0
    for (const pg of playerGameRows) {
      const gs = globalStatsMap.get(pg.slug)
      if (pg.highscore !== null && gs?.highscore !== null && gs?.highscore !== undefined &&
          pg.highscore > 0 && pg.highscore >= (gs.highscore ?? 0)) {
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
        hasPfp: user.pfpR2Key !== null,
        hasNickname: user.nickname !== null,
        arcadeRatingPercent,
        gamesPlayedSlugs,
        allGameSlugs: ['avoid-the-spikes', 'pong', 'fl-tron-3'],
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
