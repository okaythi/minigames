-- Users table mapped to Drizzle schema
CREATE TABLE IF NOT EXISTS users (
  player_id TEXT PRIMARY KEY REFERENCES players(id),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  nickname TEXT,
  nickname_changed_count INTEGER DEFAULT 0 NOT NULL,
  pfp_r2_key TEXT,
  created_on INTEGER NOT NULL,
  last_logged_in INTEGER,
  last_logged_out INTEGER,
  registered_in_country TEXT,
  legacy_user INTEGER DEFAULT 0 NOT NULL,
  password_last_changed INTEGER,
  account_locked INTEGER DEFAULT 0 NOT NULL,
  last_login_ip TEXT,
  last_login_ip_is_vpn INTEGER DEFAULT 0 NOT NULL,
  registered_ip TEXT,
  CONSTRAINT chk_nickname_changed_count CHECK (nickname_changed_count <= 1)
);

CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);

-- System config table
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

-- Self-healing trigger: If an update attempts to set nickname_changed_count > 1, silently ignore the update 
-- (SQLite RAISE(IGNORE) skips the row update entirely)
CREATE TRIGGER IF NOT EXISTS heal_nickname_changed_count
BEFORE UPDATE ON users
FOR EACH ROW
WHEN NEW.nickname_changed_count > 1
BEGIN
  SELECT RAISE(IGNORE);
END;

-- Add `plays` column to `player_games`
ALTER TABLE player_games ADD COLUMN plays INTEGER NOT NULL DEFAULT 0;
