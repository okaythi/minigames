import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core'

export const gameStats = sqliteTable('game_stats', {
  slug: text('slug').primaryKey(),
  plays: integer('plays').notNull().default(0),
  highscore: integer('highscore'),
  updatedAt: integer('updated_at').notNull().default(0),
})

export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  syncCode: text('sync_code').unique(),
  fingerprint: text('fingerprint'),
  firstSeen: integer('first_seen').notNull(),
  lastSeen: integer('last_seen').notNull(),
  highscore: integer('highscore'),
  candy: integer('candy').notNull().default(0),
})

export const playerGames = sqliteTable(
  'player_games',
  {
    playerId: text('player_id').notNull(),
    slug: text('slug').notNull(),
    plays: integer('plays').notNull().default(0), // Added for per-match tracking
    highscore: integer('highscore'),
    candy: integer('candy').notNull().default(0),
    updatedAt: integer('updated_at').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.slug] }),
  }),
)

export const seenNonces = sqliteTable('seen_nonces', {
  nonce: text('nonce').primaryKey(),
  seenAt: integer('seen_at').notNull(),
})

export const users = sqliteTable('users', {
  playerId: text('player_id')
    .primaryKey()
    .references(() => players.id),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  passwordSalt: text('password_salt').notNull(),
  nickname: text('nickname'),
  // Constrained in SQL to never exceed 1
  nicknameChangedCount: integer('nickname_changed_count').default(0).notNull(),
  pfpR2Key: text('pfp_r2_key'),
  createdOn: integer('created_on').notNull(),
  lastLoggedIn: integer('last_logged_in'),
  lastLoggedOut: integer('last_logged_out'),
  registeredInCountry: text('registered_in_country'),
  legacyUser: integer('legacy_user').default(0).notNull(),
  passwordLastChanged: integer('password_last_changed'),
  accountLocked: integer('account_locked').default(0).notNull(),
  lastLoginIp: text('last_login_ip'),
  lastLoginIpIsVpn: integer('last_login_ip_is_vpn').default(0).notNull(),
  registeredIp: text('registered_ip'),
  developer: integer('developer').default(0).notNull(),
})

export const systemConfig = sqliteTable('system_config', {
  key: text('key').primaryKey(),
  value: integer('value').notNull(),
})

export const playerAchievements = sqliteTable(
  'player_achievements',
  {
    playerId: text('player_id').notNull(),
    id: text('id').notNull(),
    progress: integer('progress').notNull().default(0),
    /** Unix epoch seconds; null means locked. */
    unlockedAt: integer('unlocked_at'),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.id] }),
  }),
)

export const playerDailyActivity = sqliteTable(
  'player_daily_activity',
  {
    playerId: text('player_id').notNull(),
    /** ISO-8601 date string e.g. '2026-09-02'. */
    utcDay: text('utc_day').notNull(),
    runCount: integer('run_count').notNull().default(1),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.playerId, table.utcDay] }),
  }),
)

