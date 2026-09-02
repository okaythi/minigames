import { drizzle } from 'drizzle-orm/d1'
import { eq, sql } from 'drizzle-orm'
import { users, players, playerGames, gameStats, playerAchievements, playerDailyActivity } from '../../../src/db/schema'
import type { UserPublicProfileResponse, UserGameStat, Badge, ActivityItem } from '../../../shared/auth-protocol'
import { ACHIEVEMENT_DEFS } from '../../../shared/achievement-defs'
import { badRequest, jsonResponse } from '../stats/respond'
import type { StatsEnv } from '../stats/store-for'

interface PagesContext {
  readonly request: Request
  readonly env: StatsEnv & { NIXLABS_DB: D1Database }
  readonly params: { username: string }
}

const KNOWN_GAMES: Record<string, string> = {
  'avoid-the-spikes': 'Avoid the Spikes!',
  'pong': 'Pong',
  'fl-tron-3': 'FL Tron 3.0',
}

export const onRequestGet = async ({ env, params }: PagesContext): Promise<Response> => {
  const db = drizzle(env.NIXLABS_DB)
  const username = params.username.toLowerCase()

  const user = await db.select().from(users).where(eq(users.username, username)).get()
  
  if (!user) {
    return badRequest('user not found')
  }

  const [playerRow, playerGameRows, globalStatsRows, achievementRows, dailyActivityRows] = await Promise.all([
    db.select().from(players).where(eq(players.id, user.playerId)).get(),
    db.select().from(playerGames).where(eq(playerGames.playerId, user.playerId)).all(),
    db.select().from(gameStats).all(),
    db.select().from(playerAchievements).where(eq(playerAchievements.playerId, user.playerId)).all(),
    db.select().from(playerDailyActivity).where(eq(playerDailyActivity.playerId, user.playerId)).orderBy(sql`${playerDailyActivity.utcDay} DESC`).limit(14).all(),
  ])

  const globalStatsMap = new Map<string, { plays: number; highscore: number | null }>()
  for (const gs of globalStatsRows) {
    globalStatsMap.set(gs.slug, { plays: gs.plays, highscore: gs.highscore })
  }

  const userGames: Record<string, UserGameStat> = {}
  let totalPlays = 0
  let recordsHeld = 0
  const recordsList: string[] = []

  const playerGameMap = new Map<string, typeof playerGameRows[number]>()
  for (const pg of playerGameRows) {
    playerGameMap.set(pg.slug, pg)
    totalPlays += pg.plays || 0
  }

  for (const [slug, title] of Object.entries(KNOWN_GAMES)) {
    const pg = playerGameMap.get(slug)
    const gs = globalStatsMap.get(slug)
    const userBest = pg?.highscore ?? null
    const globalBest = gs?.highscore ?? null
    const plays = pg?.plays ?? 0
    const candy = pg?.candy ?? 0
    const updatedAt = pg?.updatedAt ?? user.createdOn

    let isRecordHolder = false
    if (userBest !== null && userBest > 0 && globalBest !== null && userBest >= globalBest) {
      isRecordHolder = true
      recordsHeld += 1
      recordsList.push(title)
    }

    let percentile = 'Top 50%'
    if (isRecordHolder) {
      percentile = 'Top 1%'
    } else if (userBest !== null && globalBest !== null && globalBest > 0) {
      const ratio = userBest / globalBest
      if (ratio >= 0.8) percentile = 'Top 5%'
      else if (ratio >= 0.6) percentile = 'Top 15%'
      else if (ratio >= 0.4) percentile = 'Top 25%'
      else percentile = 'Top 40%'
    } else if (plays > 0) {
      percentile = 'Top 35%'
    }

    userGames[slug] = {
      slug,
      title,
      plays,
      highscore: userBest,
      candy,
      globalHighscore: globalBest,
      isRecordHolder,
      percentile,
      updatedAt,
    }
  }

  const sumGamesCandy = playerGameRows.reduce((sum, pg) => sum + (pg.candy || 0), 0)
  const totalCandy = Math.max(playerRow?.candy ?? 0, sumGamesCandy)

  // Derive arcade rating
  let arcadeRating = 'Novice'
  if (recordsHeld > 0) {
    arcadeRating = 'Top 1%'
  } else if (totalPlays >= 100 || totalCandy >= 100) {
    arcadeRating = 'Top 4%'
  } else if (totalPlays >= 30 || totalCandy >= 30) {
    arcadeRating = 'Top 12%'
  } else if (totalPlays >= 10) {
    arcadeRating = 'Top 25%'
  }

  // Derive title
  let primaryTitle = 'Lab Recruit'
  if (user.legacyUser === 1) {
    primaryTitle = 'Lab Pioneer'
  } else if (recordsHeld > 0) {
    primaryTitle = 'Record Holder'
  } else if (totalPlays >= 50) {
    primaryTitle = 'Arcade Veteran'
  } else if (totalCandy >= 100) {
    primaryTitle = 'Candy Hoarder'
  }

  // Build full 80 badges from the canonical definitions merged with player achievements
  const achievementMap = new Map<string, typeof achievementRows[number]>()
  for (const ar of achievementRows) {
    achievementMap.set(ar.id, ar)
  }

  const avoidScore = userGames['avoid-the-spikes']?.highscore ?? 0
  const pongScore = userGames['pong']?.highscore ?? 0

  const badges: Badge[] = ACHIEVEMENT_DEFS.map((def) => {
    const row = achievementMap.get(def.id)
    let unlocked = row?.unlockedAt !== null && row?.unlockedAt !== undefined
    let currentProgress = row?.progress ?? 0

    // Auto-fallback checks for platform legacy & basic milestones if row missing
    if (def.id === 'identity_lab_pioneer' && user.legacyUser === 1) {
      unlocked = true
    } else if (def.id === 'candy_sweet_tooth' && totalCandy >= 10) {
      unlocked = true
      currentProgress = Math.max(currentProgress, Math.min(totalCandy, 10))
    } else if (def.id === 'candy_hoarder' && totalCandy >= 100) {
      unlocked = true
      currentProgress = Math.max(currentProgress, Math.min(totalCandy, 100))
    } else if (def.id === 'runs_first_quarter' && totalPlays >= 5) {
      unlocked = true
      currentProgress = Math.max(currentProgress, Math.min(totalPlays, 5))
    } else if (def.id === 'runs_arcade_regular' && totalPlays >= 50) {
      unlocked = true
      currentProgress = Math.max(currentProgress, Math.min(totalPlays, 50))
    } else if (def.id === 'runs_arcade_veteran' && totalPlays >= 200) {
      unlocked = true
      currentProgress = Math.max(currentProgress, Math.min(totalPlays, 200))
    }

    return {
      id: def.id,
      pillar: def.pillar,
      track: def.track,
      name: def.name,
      description: def.description,
      icon: def.icon,
      unlocked,
      unlockedAt: row?.unlockedAt ?? null,
      progress: def.maxProgress !== null ? { current: currentProgress, max: def.maxProgress } : undefined,
    }
  })

  // Calculate streak & activity days from player_daily_activity
  const todayUtc = new Date().toISOString().slice(0, 10)
  const activeDaysSet = new Set(dailyActivityRows.map((r) => r.utcDay))
  
  let activeStreak = 0
  let checkDay = todayUtc
  for (let i = 0; i < 30; i++) {
    if (activeDaysSet.has(checkDay)) {
      activeStreak += 1
      const d = new Date(checkDay + 'T00:00:00Z')
      d.setUTCDate(d.getUTCDate() - 1)
      checkDay = d.toISOString().slice(0, 10)
    } else {
      break
    }
  }
  if (activeStreak === 0 && totalPlays > 0) {
    activeStreak = 1
  }

  // Generate 7-day punch card (last 7 days)
  const streakDays: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    streakDays.push(activeDaysSet.has(dayStr) || (i === 0 && totalPlays > 0))
  }

  // Recent activity feed
  const recentActivity: ActivityItem[] = []
  if (avoidScore > 0) {
    recentActivity.push({
      id: 'act-avoid',
      text: `Scored ${avoidScore} on Avoid the Spikes!`,
      timeAgo: 'Recently',
      icon: '🎯',
    })
  }
  if (pongScore > 0) {
    recentActivity.push({
      id: 'act-pong',
      text: `Rallied ${pongScore} hits on Pong`,
      timeAgo: 'Recently',
      icon: '🏓',
    })
  }
  if (totalCandy > 0) {
    recentActivity.push({
      id: 'act-candy',
      text: `Collected ${totalCandy} Candies into the bank`,
      timeAgo: 'Recently',
      icon: '🍬',
    })
  }
  recentActivity.push({
    id: 'act-join',
    text: `Joined Nixlabs Games arcade`,
    timeAgo: formatJoinDate(user.createdOn),
    icon: '✨',
  })

  const profileResponse: UserPublicProfileResponse = {
    username: user.username,
    nickname: user.nickname,
    pfpUrl: user.pfpR2Key ? `/api/assets/pfp/${user.pfpR2Key}` : null,
    legacyUser: user.legacyUser === 1,
    nicknameChangedCount: user.nicknameChangedCount,
    createdOn: user.createdOn,
    totalPlays,
    totalCandy,
    recordsHeld,
    recordsList,
    arcadeRating,
    title: primaryTitle,
    activeStreak,
    streakDays,
    badges,
    games: userGames,
    recentActivity,
  }

  return jsonResponse(200, {
    ok: true,
    profile: profileResponse,
  })
}

function formatJoinDate(timestampSeconds: number): string {
  if (!timestampSeconds) return 'Recently'
  const date = new Date(timestampSeconds * 1000)
  const month = date.toLocaleString('default', { month: 'short' })
  const year = date.getFullYear()
  return `${month} ${year}`
}

