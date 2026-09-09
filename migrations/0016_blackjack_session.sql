-- Blackjack 21 Server-Authoritative Table Session & Wallet Schema
CREATE TABLE IF NOT EXISTS blackjack_sessions (
  player_id TEXT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  bankroll INTEGER NOT NULL DEFAULT 500,
  bonus_eur INTEGER NOT NULL DEFAULT 500,
  deposited_eur INTEGER NOT NULL DEFAULT 0,
  initial_total_eur INTEGER NOT NULL DEFAULT 500,
  first_time_granted INTEGER NOT NULL DEFAULT 1,
  difficulty TEXT NOT NULL DEFAULT 'normal',
  companion_count INTEGER NOT NULL DEFAULT 2,
  updated_at INTEGER NOT NULL
);
