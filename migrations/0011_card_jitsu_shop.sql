-- Card-Jitsu Dojo Shop schema: unlocked penguin colors per user
CREATE TABLE IF NOT EXISTS cj_ninja_colors (
  user_id TEXT NOT NULL REFERENCES users(player_id) ON DELETE CASCADE,
  color_id INTEGER NOT NULL,
  unlocked_at TEXT NOT NULL,
  PRIMARY KEY (user_id, color_id)
);
