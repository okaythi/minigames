-- Reason + expiry wrapper around the restriction primitives that already
-- exist (accountLocked, USER_FRIENDS_BLOCKED, USER_MESSAGES_BLOCKED).
CREATE TABLE moderation_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_player_id TEXT NOT NULL REFERENCES users(player_id),
  actor_player_id TEXT NOT NULL REFERENCES users(player_id),
  action_type TEXT NOT NULL,      -- 'ban' | 'mute' | 'friends_block' | 'warn'
  reason TEXT NOT NULL,
  expires_at INTEGER,             -- null = permanent
  revoked_at INTEGER,
  revoked_by TEXT REFERENCES users(player_id),
  created_at INTEGER NOT NULL
);

CREATE TABLE staff_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_player_id TEXT NOT NULL REFERENCES users(player_id),
  author_player_id TEXT NOT NULL REFERENCES users(player_id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Append-only. Every admin-panel mutation writes here.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_player_id TEXT NOT NULL REFERENCES users(player_id),
  action TEXT NOT NULL,           -- 'user.ban', 'game.flags_update', ...
  target_type TEXT NOT NULL,      -- 'user' | 'game' | 'platform'
  target_id TEXT,
  reason TEXT,
  metadata TEXT,                  -- JSON diff of before/after
  created_at INTEGER NOT NULL
);
CREATE INDEX idx_audit_actor  ON audit_log(actor_player_id);
CREATE INDEX idx_audit_target ON audit_log(target_type, target_id);

-- Live, no-deploy overrides for the statically-registered games.
-- Runtime reads shared/game-registry.json as the base, then merges this
-- row (if present) for status/flags — code stays the source of truth for
-- what a game *is*, this table controls whether it's live.
CREATE TABLE game_overrides (
  slug TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'published', -- 'published' | 'maintenance' | 'hidden'
  flags INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(player_id),
  updated_at INTEGER NOT NULL
);

-- systemConfig (existing stub) is integer-value-only — fine for toggles,
-- not for text metadata like banner copy. Add a companion table rather
-- than overload it.
CREATE TABLE platform_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_by TEXT REFERENCES users(player_id),
  updated_at INTEGER NOT NULL
);
