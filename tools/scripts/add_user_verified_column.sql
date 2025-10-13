-- ============================================================================
-- Add user_verified column to lojas table
-- ============================================================================
-- This migration adds support for tracking when an auto-added store
-- is manually verified/claimed by a user
--
-- When a user registers a store that was previously auto-added:
-- - source changes from 'auto' to 'verified'
-- - user_verified is set to true
-- - Displays 🧵 (blue thread emoji) in the UI
-- ============================================================================

ALTER TABLE lojas
ADD COLUMN IF NOT EXISTS user_verified BOOLEAN DEFAULT false;

-- Update existing stores to set user_verified based on current source
UPDATE lojas
SET user_verified = false
WHERE source IN ('auto', 'user');

-- Create index for faster queries on verified stores
CREATE INDEX IF NOT EXISTS idx_lojas_user_verified
ON lojas(user_verified);

-- Add verified source value check (optional constraint)
ALTER TABLE lojas
DROP CONSTRAINT IF EXISTS check_lojas_source;

ALTER TABLE lojas
ADD CONSTRAINT check_lojas_source
CHECK (source IN ('user', 'auto', 'verified'));
