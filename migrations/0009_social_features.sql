-- 1. Friendships
CREATE TABLE IF NOT EXISTS friendships (
  requester_id TEXT NOT NULL REFERENCES users(player_id) ON DELETE CASCADE,
  addressee_id TEXT NOT NULL REFERENCES users(player_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (requester_id, addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON friendships(requester_id, status);

-- 2. Conversations & Messages
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user1_id TEXT NOT NULL REFERENCES users(player_id),
  user2_id TEXT NOT NULL REFERENCES users(player_id),
  last_message_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user2 ON conversations(user2_id);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES users(player_id),
  recipient_id TEXT NOT NULL REFERENCES users(player_id),
  message_type TEXT NOT NULL DEFAULT 'text',
  content TEXT NOT NULL,
  metadata TEXT,
  deleted_by_sender INTEGER NOT NULL DEFAULT 0,
  deleted_by_recipient INTEGER NOT NULL DEFAULT 0,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_convo ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, read_at);

-- 3. Challenges
CREATE TABLE IF NOT EXISTS challenges (
  id TEXT PRIMARY KEY,
  conversation_id TEXT REFERENCES conversations(id),
  game_slug TEXT NOT NULL,
  challenger_id TEXT NOT NULL REFERENCES users(player_id),
  challenged_id TEXT NOT NULL REFERENCES users(player_id),
  target_score INTEGER NOT NULL,
  bounty_candy INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  winner_id TEXT REFERENCES users(player_id),
  created_at INTEGER NOT NULL,
  completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_challenges_challenged ON challenges(challenged_id, status);

-- 4. User Presence
CREATE TABLE IF NOT EXISTS user_presence (
  player_id TEXT PRIMARY KEY REFERENCES users(player_id) ON DELETE CASCADE,
  last_active_at INTEGER NOT NULL,
  state TEXT NOT NULL DEFAULT 'online',
  game_slug TEXT,
  game_started_at INTEGER
);

-- 5. User Privacy Settings
CREATE TABLE IF NOT EXISTS user_privacy_settings (
  player_id TEXT PRIMARY KEY REFERENCES users(player_id) ON DELETE CASCADE,
  hide_friends INTEGER NOT NULL DEFAULT 0,
  show_online INTEGER NOT NULL DEFAULT 1
);

-- 6. Moderation Reports
CREATE TABLE IF NOT EXISTS moderation_reports (
  id TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(player_id),
  reported_user_id TEXT NOT NULL REFERENCES users(player_id),
  message_id TEXT REFERENCES messages(id),
  reason TEXT NOT NULL,
  details TEXT,
  snapshot_context TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  reviewed_by_staff_id TEXT,
  resolution_action TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

-- 7. Update user 'test' to receive TEST_ACCOUNT flag (64)
UPDATE users SET flags = (flags | 64) WHERE username = 'test';
