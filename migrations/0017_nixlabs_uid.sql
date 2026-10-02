-- Link ecosystem (SSO) players to their immutable accounts.nixlabs.tech uid, so a
-- username change on accounts no longer orphans the player.
ALTER TABLE users ADD COLUMN nixlabs_uid TEXT;
CREATE UNIQUE INDEX idx_users_nixlabs_uid ON users(nixlabs_uid) WHERE nixlabs_uid IS NOT NULL;
