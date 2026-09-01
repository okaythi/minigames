-- Nixlabs Games - Cloudflare D1 schema (binding: NIXLABS_DB, database: nix-minigames).
--
-- Apply locally:  npm run db:init
-- Apply online:   npm run db:migrate
--
-- Three tables, one per question the site answers:
--   game_stats     "how many people played this, and what was the best score?"
--   players        "who is this, and what have *they* banked?"  (unique players = COUNT)
--   seen_nonces    "have I already applied this event?"

CREATE TABLE IF NOT EXISTS game_stats (
  slug TEXT PRIMARY KEY,
  plays INTEGER NOT NULL DEFAULT 0,
  highscore INTEGER,
  updated_at INTEGER NOT NULL DEFAULT 0
);

-- One row per anonymous player, keyed by the uuid in the httpOnly cookie.
-- `highscore` is the best score across every game - the number the site shows -
-- and `candy` is the global bank. Both are mirrored per game in `player_games`.
CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  sync_code TEXT UNIQUE,
  fingerprint TEXT,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  highscore INTEGER,
  candy INTEGER NOT NULL DEFAULT 0
);

-- Last-resort identity anchor: only consulted when the cookie and the local
-- id are both gone, which is also how Incognito returns. Not unique, because
-- two identical devices on one network can hash to one fingerprint: the lookup
-- takes the most recently seen match and lets the fingerprint stay shared.
CREATE INDEX IF NOT EXISTS players_fingerprint_idx ON players (fingerprint, last_seen DESC);

CREATE TABLE IF NOT EXISTS player_games (
  player_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  highscore INTEGER,
  candy INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, slug)
);

-- Idempotency guard: a client may retry an event after a dropped response.
-- The nonce is inserted with INSERT OR IGNORE, so a retry changes 0 rows.
CREATE TABLE IF NOT EXISTS seen_nonces (
  nonce TEXT PRIMARY KEY,
  seen_at INTEGER NOT NULL
);
