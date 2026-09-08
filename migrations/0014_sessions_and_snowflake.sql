-- Real, revocable, expiring sessions — replaces "the whole auth story is an
-- unsigned player_id cookie."
CREATE TABLE sessions (
  token TEXT PRIMARY KEY,              -- opaque random UUID
  player_id TEXT NOT NULL REFERENCES users(player_id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER,
  user_agent TEXT,
  ip_hash TEXT                         -- SHA-256 hash
);
CREATE INDEX idx_sessions_player ON sessions(player_id);

-- Who/what minted a given snowflake ID (lookup table to preserve bit budget).
CREATE TABLE creator_registry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,  -- must stay < 1024 (10-bit budget)
  label TEXT NOT NULL UNIQUE,            -- 'self_registration', 'staff:alice', 'legacy_import'
  created_at INTEGER NOT NULL
);
INSERT INTO creator_registry (id, label, created_at) VALUES
  (0, 'self_registration', unixepoch() * 1000),
  (1, 'legacy_import', unixepoch() * 1000);

-- TEXT, not INTEGER — zero-padded 19-digit decimal string to prevent D1 64-bit precision loss.
ALTER TABLE users ADD COLUMN snowflake_id TEXT;
CREATE UNIQUE INDEX idx_users_snowflake ON users(snowflake_id);

-- Seed admin flags for accounts 'thy' and 'test':
-- STAFF (4) | USERS_ADMIN (256) | GAMES_ADMIN (512) | PLATFORM_ADMIN (1024) = 1796
UPDATE users SET flags = (flags | 1796) WHERE username IN ('thy', 'test');
