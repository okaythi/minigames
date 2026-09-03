-- Migration 0008: Wipe legacy non-full-run records for FL Tron 3.0
UPDATE game_stats SET highscore = NULL WHERE slug = 'fl-tron-3';
UPDATE player_games SET highscore = NULL WHERE slug = 'fl-tron-3';
