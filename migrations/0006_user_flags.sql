-- Add flags JSON column to users table
ALTER TABLE users ADD COLUMN flags TEXT NOT NULL DEFAULT '{}';

-- Migrate existing developer and legacy_user column values into the new flags JSON system
UPDATE users SET flags = CASE 
  WHEN developer = 1 AND legacy_user = 1 THEN json_object('USER_DEVELOPER', json_object('enabled', 1), 'USER_PIONEER', json_object('enabled', 1))
  WHEN developer = 1 THEN json_object('USER_DEVELOPER', json_object('enabled', 1))
  WHEN legacy_user = 1 THEN json_object('USER_PIONEER', json_object('enabled', 1))
  ELSE '{}'
END;
