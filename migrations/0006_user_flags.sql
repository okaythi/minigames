-- Add flags bitmask vector column to users table
ALTER TABLE users ADD COLUMN flags INTEGER NOT NULL DEFAULT 0;

-- Migrate existing developer (Bit 0 = 1) and legacy_user (Bit 1 = 2) into flags bitmask
UPDATE users SET flags = (
  (CASE WHEN developer = 1 THEN 1 ELSE 0 END) |
  (CASE WHEN legacy_user = 1 THEN 2 ELSE 0 END)
);
