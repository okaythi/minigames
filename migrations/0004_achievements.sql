-- Nixlabs Games: Achievement system tables
-- Migration 0004 — player_achievements

-- One row per (player, achievement). Updated on every progress bump.
-- `unlocked_at` is set once (the first time progress hits the threshold) and
-- never overwritten; the CHECK in the trigger enforces this.
CREATE TABLE IF NOT EXISTS player_achievements (
  player_id   TEXT    NOT NULL REFERENCES players(id),
  id          TEXT    NOT NULL,
  progress    INTEGER NOT NULL DEFAULT 0,
  unlocked_at INTEGER,             -- Unix epoch (seconds); NULL = locked
  PRIMARY KEY (player_id, id)
);

CREATE INDEX IF NOT EXISTS player_achievements_player_idx
  ON player_achievements (player_id);

-- Prevent overwriting unlocked_at once it has been set.
CREATE TRIGGER IF NOT EXISTS lock_achievement_unlock
BEFORE UPDATE ON player_achievements
FOR EACH ROW
WHEN OLD.unlocked_at IS NOT NULL AND NEW.unlocked_at IS NULL
BEGIN
  SELECT RAISE(IGNORE);
END;

-- Daily activity ledger — one row per player per UTC calendar day.
-- Used to compute streaks accurately instead of deriving them from play counts.
CREATE TABLE IF NOT EXISTS player_daily_activity (
  player_id TEXT    NOT NULL REFERENCES players(id),
  utc_day   TEXT    NOT NULL, -- ISO 8601 date string e.g. '2026-09-02'
  run_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (player_id, utc_day)
);

CREATE INDEX IF NOT EXISTS player_daily_activity_player_idx
  ON player_daily_activity (player_id, utc_day DESC);
