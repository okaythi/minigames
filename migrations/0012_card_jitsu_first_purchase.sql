-- Add packs_purchased tracking to cj_ninja for first purchase promotion
ALTER TABLE cj_ninja ADD COLUMN packs_purchased INTEGER NOT NULL DEFAULT 0;
