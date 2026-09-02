-- Add developer flag to users table (0 = regular user, 1 = developer)
ALTER TABLE users ADD COLUMN developer INTEGER DEFAULT 0 NOT NULL;
