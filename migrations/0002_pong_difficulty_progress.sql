-- Persist the Pong difficulty wins that unlock Very Hard for one player.
-- Only the three public difficulties are unlockable; Very Hard is never needed
-- to unlock itself.
CREATE TABLE IF NOT EXISTS player_pong_difficulties (
  player_id TEXT NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('easy', 'normal', 'hard')),
  completed_at INTEGER NOT NULL,
  PRIMARY KEY (player_id, difficulty)
);

CREATE INDEX IF NOT EXISTS player_pong_difficulties_player_idx
  ON player_pong_difficulties (player_id);
