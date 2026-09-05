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
  flags: integer('flags').default(0).notNull(),
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

export const updateReleases = sqliteTable('update_releases', {
  id: text('id').primaryKey(),
  globalVersion: text('global_version').notNull(),
  title: text('title').notNull(),
  headline: text('headline').notNull(),
  status: text('status').notNull(), // 'draft' | 'review' | 'published' | 'archived'
  releaseDate: text('release_date').notNull(),
  authorUsername: text('author_username'),
  publishedAt: integer('published_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const updateRationales = sqliteTable('update_rationales', {
  releaseId: text('release_id')
    .primaryKey()
    .references(() => updateReleases.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  authorUsername: text('author_username'),
  updatedAt: integer('updated_at').notNull(),
})

export const updateItems = sqliteTable('update_items', {
  id: text('id').primaryKey(),
  releaseId: text('release_id')
    .notNull()
    .references(() => updateReleases.id, { onDelete: 'cascade' }),
  scopeType: text('scope_type').notNull(), // 'game' | 'engine' | 'platform'
  scopeTargetId: text('scope_target_id').notNull(),
  scopeEntityName: text('scope_entity_name'),
  tag: text('tag').notNull(), // 'Balance' | 'New' | 'Fix' | 'Feature' | 'Polish'
  itemVersion: text('item_version'),
  subject: text('subject'),
  description: text('description').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

export const friendships = sqliteTable(
  'friendships',
  {
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.playerId, { onDelete: 'cascade' }),
    addresseeId: text('addressee_id')
      .notNull()
      .references(() => users.playerId, { onDelete: 'cascade' }),
    status: text('status').notNull().default('pending'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.requesterId, table.addresseeId] }),
  }),
)

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  user1Id: text('user1_id')
    .notNull()
    .references(() => users.playerId),
  user2Id: text('user2_id')
    .notNull()
    .references(() => users.playerId),
  lastMessageAt: integer('last_message_at').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: text('sender_id')
    .notNull()
    .references(() => users.playerId),
  recipientId: text('recipient_id')
    .notNull()
    .references(() => users.playerId),
  messageType: text('message_type').notNull().default('text'),
  content: text('content').notNull(),
  metadata: text('metadata'),
  deletedBySender: integer('deleted_by_sender').notNull().default(0),
  deletedByRecipient: integer('deleted_by_recipient').notNull().default(0),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull(),
})

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id),
  gameSlug: text('game_slug').notNull(),
  challengerId: text('challenger_id')
    .notNull()
    .references(() => users.playerId),
  challengedId: text('challenged_id')
    .notNull()
    .references(() => users.playerId),
  targetScore: integer('target_score').notNull(),
  bountyCandy: integer('bounty_candy').notNull().default(0),
  status: text('status').notNull().default('pending'),
  winnerId: text('winner_id').references(() => users.playerId),
  createdAt: integer('created_at').notNull(),
  completedAt: integer('completed_at'),
})

export const userPresence = sqliteTable('user_presence', {
  playerId: text('player_id')
    .primaryKey()
    .references(() => users.playerId, { onDelete: 'cascade' }),
  lastActiveAt: integer('last_active_at').notNull(),
  state: text('state').notNull().default('online'),
  gameSlug: text('game_slug'),
  gameStartedAt: integer('game_started_at'),
})

export const userPrivacySettings = sqliteTable('user_privacy_settings', {
  playerId: text('player_id')
    .primaryKey()
    .references(() => users.playerId, { onDelete: 'cascade' }),
  hideFriends: integer('hide_friends').notNull().default(0),
  showOnline: integer('show_online').notNull().default(1),
})

export const moderationReports = sqliteTable('moderation_reports', {
  id: text('id').primaryKey(),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => users.playerId),
  reportedUserId: text('reported_user_id')
    .notNull()
    .references(() => users.playerId),
  messageId: text('message_id').references(() => messages.id),
  reason: text('reason').notNull(),
  details: text('details'),
  snapshotContext: text('snapshot_context'),
  status: text('status').notNull().default('open'),
  reviewedByStaffId: text('reviewed_by_staff_id'),
  resolutionAction: text('resolution_action'),
  createdAt: integer('created_at').notNull(),
  resolvedAt: integer('resolved_at'),
})
export const cjNinja = sqliteTable('cj_ninja', {
  userId: text('user_id').primaryKey(),
  rank: integer('rank').notNull().default(0),
  progress: integer('progress').notNull().default(0),
  matchesWon: integer('matches_won').notNull().default(0),
  colorId: integer('color_id').notNull().default(1),
  introSeen: integer('intro_seen').notNull().default(0),
  packsPurchased: integer('packs_purchased').notNull().default(0),
  updatedAt: text('updated_at').notNull(),
})

export const cjCard = sqliteTable(
  'cj_card',
  {
    userId: text('user_id').notNull(),
    cardId: integer('card_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    memberQuantity: integer('member_quantity').notNull().default(0),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.cardId] }),
  }),
)

export const cjMatch = sqliteTable('cj_match', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  opponent: text('opponent').notNull(),
  mode: text('mode').notNull(),
  winner: text('winner').notNull(),
  rounds: integer('rounds').notNull(),
  winMethod: text('win_method').notNull(),
  flawless: integer('flawless').notNull(),
  fullDojo: integer('full_dojo').notNull(),
  senseiCard: integer('sensei_card').notNull(),
  rankBefore: integer('rank_before').notNull(),
  rankAfter: integer('rank_after').notNull(),
  progressBefore: integer('progress_before').notNull(),
  progressAfter: integer('progress_after').notNull(),
  createdAt: text('created_at').notNull(),
})

export const cjNinjaColors = sqliteTable(
  'cj_ninja_colors',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.playerId, { onDelete: 'cascade' }),
    colorId: integer('color_id').notNull(),
    unlockedAt: text('unlocked_at').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.colorId] }),
  }),
)

