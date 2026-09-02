import { z } from 'zod'

const usernameRegex = /^[a-z_]([a-z0-9_\.]*[a-z0-9_])?$/

export const UsernameSchema = z
  .string()
  .min(3)
  .max(30)
  .toLowerCase()
  .regex(usernameRegex, 'Username must start with a letter or underscore, cannot end with a period, and only contain letters, numbers, underscores, and periods.')

export const PasswordSchema = z.string().min(8).max(100)

export const UserRegisterSchema = z.object({
  username: UsernameSchema,
  password: PasswordSchema,
})

export type UserRegisterPayload = z.infer<typeof UserRegisterSchema>

export const UserLoginSchema = z.object({
  username: UsernameSchema,
  password: z.string(),
})

export type UserLoginPayload = z.infer<typeof UserLoginSchema>

export const UserProfileUpdateSchema = z.object({
  nickname: z.string().min(1).max(50),
})

export type UserProfileUpdatePayload = z.infer<typeof UserProfileUpdateSchema>

export interface UserProfileResponse {
  username: string
  nickname: string | null
  pfpUrl: string | null
  legacyUser: boolean
  developer: boolean
  nicknameChangedCount: number
  createdOn: number
}

export interface UserGameStat {
  slug: string
  title: string
  plays: number
  highscore: number | null
  candy: number
  globalHighscore: number | null
  isRecordHolder: boolean
  percentile: string
  updatedAt: number
}

export interface Badge {
  id: string
  pillar?: string | undefined
  track?: string | undefined
  name: string
  description: string
  icon: string
  unlocked: boolean
  unlockedAt?: number | null | undefined
  progress?: { current: number; max: number } | undefined
}

export interface ActivityItem {
  id: string
  text: string
  timeAgo: string
  icon: string
}

export interface UserPublicProfileResponse {
  username: string
  nickname: string | null
  pfpUrl: string | null
  legacyUser: boolean
  developer: boolean
  nicknameChangedCount: number
  createdOn: number
  totalPlays: number
  totalCandy: number
  recordsHeld: number
  recordsList: string[]
  arcadeRating: string
  title: string
  activeStreak: number
  streakDays: boolean[]
  badges: Badge[]
  games: Record<string, UserGameStat>
  recentActivity: ActivityItem[]
}

