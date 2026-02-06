-- Migration: 002_theme_system
-- Expand theme column to support named themes and add font columns

-- Migrate existing theme values to new names
UPDATE settings SET theme = 'default-light' WHERE theme = 'light';
UPDATE settings SET theme = 'default-dark' WHERE theme = 'dark';
-- 'system' stays as 'system'

-- Add font override columns
ALTER TABLE settings ADD COLUMN font_family_ui TEXT;
ALTER TABLE settings ADD COLUMN font_family_code TEXT;
