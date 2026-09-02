import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { users, players, playerGames, gameStats } from '../../../src/db/schema'
import type { UserPublicProfileResponse, UserGameStat, Badge, ActivityItem } from '../../../shared/auth-protocol'
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

  const [playerRow, playerGameRows, globalStatsRows] = await Promise.all([
    db.select().from(players).where(eq(players.id, user.playerId)).get(),
    db.select().from(playerGames).where(eq(playerGames.playerId, user.playerId)).all(),
    db.select().from(gameStats).all(),
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

  const totalCandy = playerRow?.candy ?? 0

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

  // Badges system
  const avoidScore = userGames['avoid-the-spikes']?.highscore ?? 0
  const pongScore = userGames['pong']?.highscore ?? 0
  const tronPlays = userGames['fl-tron-3']?.plays ?? 0

  const badges: Badge[] = [
    {
      id: 'pioneer',
      name: 'Lab Pioneer',
      description: 'Joined Nixlabs in early access phase.',
      icon: '⚡',
      unlocked: user.legacyUser === 1,
    },
    {
      id: 'wall_bouncer',
      name: 'Wall Bouncer',
      description: 'Achieve a score of 25+ on Avoid the Spikes!',
      icon: '🏆',
      unlocked: avoidScore >= 25,
      progress: { current: Math.min(avoidScore, 25), max: 25 },
    },
    {
      id: 'candy_hoarder',
      name: 'Candy Hoarder',
      description: 'Bank 100 or more candies across all games.',
      icon: '🍬',
      unlocked: totalCandy >= 100,
      progress: { current: Math.min(totalCandy, 100), max: 100 },
    },
    {
      id: 'paddle_ace',
      name: 'Paddle Ace',
      description: 'Score 25+ hits in a single rally on Pong.',
      icon: '🏓',
      unlocked: pongScore >= 25,
      progress: { current: Math.min(pongScore, 25), max: 25 },
    },
    {
      id: 'tron_survivor',
      name: 'Tron Survivor',
      description: 'Complete matches on the FL Tron cyber grid.',
      icon: '🏍️',
      unlocked: tronPlays >= 3,
      progress: { current: Math.min(tronPlays, 3), max: 3 },
    },
    {
      id: 'arcade_veteran',
      name: 'Arcade Veteran',
      description: 'Play at least 50 total runs in the Nixlabs catalogue.',
      icon: '🕹️',
      unlocked: totalPlays >= 50,
      progress: { current: Math.min(totalPlays, 50), max: 50 },
    },
  ]

  // Calculate streak & activity days
  const activeStreak = Math.min(Math.max(1, Math.floor((totalPlays / 3) + 1)), 7)
  const streakDays: boolean[] = [true, true, true, true, true, false, false].map((_, i) => i < activeStreak)

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

