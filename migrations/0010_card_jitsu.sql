-- Card-Jitsu server-authoritative state schema
-- Mirrors Houdini ninja_rank, ninja_progress, penguin_card semantics

CREATE TABLE cj_ninja (
  user_id TEXT PRIMARY KEY,
  rank INTEGER NOT NULL DEFAULT 0,          -- houdini penguin.ninja_rank 0..10
  progress INTEGER NOT NULL DEFAULT 0,      -- houdini penguin.ninja_progress, absolute exp
  matches_won INTEGER NOT NULL DEFAULT 0,   -- houdini penguin.ninja_matches_won
  color_id INTEGER NOT NULL DEFAULT 1,
  intro_seen INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE cj_card (                      -- houdini penguin_card
  user_id TEXT NOT NULL,
  card_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  member_quantity INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, card_id)
);

CREATE TABLE cj_match (
  id TEXT PRIMARY KEY,                      -- client nonce, idempotent
  user_id TEXT NOT NULL,
  opponent TEXT NOT NULL,
  mode TEXT NOT NULL,
  winner TEXT NOT NULL,
  rounds INTEGER NOT NULL,
  win_method TEXT NOT NULL,
  flawless INTEGER NOT NULL,
  full_dojo INTEGER NOT NULL,
  sensei_card INTEGER NOT NULL,
  rank_before INTEGER NOT NULL,
  rank_after INTEGER NOT NULL,
  progress_before INTEGER NOT NULL,
  progress_after INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX cj_match_user ON cj_match(user_id, opponent);
