import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { users } from './schema'

export const moderationActions = sqliteTable('moderation_actions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetPlayerId: text('target_player_id')
    .notNull()
    .references(() => users.playerId),
  actorPlayerId: text('actor_player_id')
    .notNull()
    .references(() => users.playerId),
  actionType: text('action_type').notNull(), // 'ban' | 'mute' | 'friends_block' | 'warn'
  reason: text('reason').notNull(),
  expiresAt: integer('expires_at'),
  revokedAt: integer('revoked_at'),
  revokedBy: text('revoked_by').references(() => users.playerId),
  createdAt: integer('created_at').notNull(),
})

export const staffNotes = sqliteTable('staff_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  targetPlayerId: text('target_player_id')
    .notNull()
    .references(() => users.playerId),
  authorPlayerId: text('author_player_id')
    .notNull()
    .references(() => users.playerId),
  body: text('body').notNull(),
  createdAt: integer('created_at').notNull(),
})

export const auditLog = sqliteTable('audit_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorPlayerId: text('actor_player_id')
    .notNull()
    .references(() => users.playerId),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(), // 'user' | 'game' | 'platform'
  targetId: text('target_id'),
  reason: text('reason'),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
})

export const gameOverrides = sqliteTable('game_overrides', {
  slug: text('slug').primaryKey(),
  status: text('status').notNull().default('published'), // 'published' | 'maintenance' | 'hidden'
  flags: integer('flags').notNull().default(0),
  updatedBy: text('updated_by').references(() => users.playerId),
  updatedAt: integer('updated_at').notNull(),
})

export const platformMetadata = sqliteTable('platform_metadata', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedBy: text('updated_by').references(() => users.playerId),
  updatedAt: integer('updated_at').notNull(),
})

export const sessions = sqliteTable('sessions', {
  token: text('token').primaryKey(),
  playerId: text('player_id')
    .notNull()
    .references(() => users.playerId),
  createdAt: integer('created_at').notNull(),
  expiresAt: integer('expires_at').notNull(),
  revokedAt: integer('revoked_at'),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'),
})

export const creatorRegistry = sqliteTable('creator_registry', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  label: text('label').notNull().unique(),
  createdAt: integer('created_at').notNull(),
})

export const userNotifications = sqliteTable('user_notifications', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: text('player_id')
    .notNull()
    .references(() => users.playerId, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'moderation' | 'warning' | 'account' | 'system'
  title: text('title').notNull(),
  body: text('body').notNull(),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull(),
})

export const userDismissables = sqliteTable('user_dismissables', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  playerId: text('player_id')
    .notNull()
    .references(() => users.playerId, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  dismissedAt: integer('dismissed_at').notNull(),
})
