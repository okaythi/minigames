-- Migration 0007: Update Notes Engine Tables (Starts completely empty)
CREATE TABLE IF NOT EXISTS update_releases (
  id TEXT PRIMARY KEY,
  global_version TEXT NOT NULL,
  title TEXT NOT NULL,
  headline TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'review', 'published', 'archived')),
  release_date TEXT NOT NULL,
  author_username TEXT,
  published_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CONSTRAINT chk_headline_length CHECK (length(headline) <= 80)
);

CREATE INDEX IF NOT EXISTS idx_update_releases_status ON update_releases(status, published_at);
CREATE INDEX IF NOT EXISTS idx_update_releases_version ON update_releases(global_version);

CREATE TABLE IF NOT EXISTS update_rationales (
  release_id TEXT PRIMARY KEY REFERENCES update_releases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  author_username TEXT,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS update_items (
  id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES update_releases(id) ON DELETE CASCADE,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('game', 'engine', 'platform')),
  scope_target_id TEXT NOT NULL,
  scope_entity_name TEXT,
  tag TEXT NOT NULL CHECK (tag IN ('Balance', 'New', 'Fix', 'Feature', 'Polish')),
  item_version TEXT,
  subject TEXT,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_update_items_release_order ON update_items(release_id, sort_order);
