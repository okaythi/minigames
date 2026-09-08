-- User System & Moderation Notifications
CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES users(player_id) ON DELETE CASCADE,
  type TEXT NOT NULL,          -- 'moderation' | 'warning' | 'account' | 'system'
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_notif_player ON user_notifications(player_id, read_at);

-- User Dismissables / Announcements / Hints
CREATE TABLE IF NOT EXISTS user_dismissables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL REFERENCES users(player_id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  dismissed_at INTEGER NOT NULL,
  UNIQUE(player_id, key)
);
CREATE INDEX IF NOT EXISTS idx_user_dismissables_player ON user_dismissables(player_id);

-- Scheduled Account Deletion Lifecycle Columns
ALTER TABLE users ADD COLUMN scheduled_deletion_at INTEGER;
ALTER TABLE users ADD COLUMN scheduled_deletion_reason TEXT;

-- Drop legacy trigger that prevented updating nickname_changed_count above 1
DROP TRIGGER IF EXISTS heal_nickname_changed_count;
