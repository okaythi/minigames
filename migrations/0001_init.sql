-- Nixlabs Games - Cloudflare D1 schema (binding: NIXLABS_DB).
--
-- Apply locally:  npm run db:init
-- Apply online:   npm run db:migrate
--
-- `game_stats` is one row per game and backs the card counters; `players` is
-- one row per anonymous visitor (a uuid kept in localStorage) and backs the
-- "unique players" number on the home page.

CREATE TABLE IF NOT EXISTS game_stats (
  slug TEXT PRIMARY KEY,
  plays INTEGER NOT NULL DEFAULT 0,
  highscore INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER
);

-- Idempotency guard: a client may retry an event after a dropped response.
-- The nonce is inserted with INSERT OR IGNORE, so a retry changes 0 rows.
CREATE TABLE IF NOT EXISTS seen_nonces (
  nonce TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS players_last_seen_idx ON players (last_seen DESC);
