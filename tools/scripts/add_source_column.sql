/**
 * ============================================================================
 * Database Migration: Add Source Tracking for Auto-Population
 * ============================================================================
 *
 * This migration adds support for tracking whether stores were added:
 * - Manually by users (source='user') 🙂
 * - Automatically from Google Places (source='auto') 🙃
 *
 * This allows the commercial product to hide auto-populated stores
 * without affecting manually-added stores.
 */

-- Step 1: Add source column to lojas table
ALTER TABLE lojas
ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'user';

-- Set existing stores as user-added
UPDATE lojas
SET source = 'user'
WHERE source IS NULL;

-- Step 2: Add Google Place ID column (for duplicate prevention)
ALTER TABLE lojas
ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255);

-- Create unique index to prevent duplicate Google places
CREATE UNIQUE INDEX IF NOT EXISTS idx_lojas_google_place_id
ON lojas(google_place_id)
WHERE google_place_id IS NOT NULL;

-- Step 3: Create auto_population_runs tracking table
CREATE TABLE IF NOT EXISTS auto_population_runs (
  id SERIAL PRIMARY KEY,
  run_date TIMESTAMP DEFAULT NOW(),
  stores_added INTEGER NOT NULL DEFAULT 0,
  stores_skipped INTEGER NOT NULL DEFAULT 0,
  total_auto_stores INTEGER NOT NULL DEFAULT 0,
  total_user_stores INTEGER NOT NULL DEFAULT 0,
  api_calls_used INTEGER NOT NULL DEFAULT 0,
  estimated_cost DECIMAL(10, 4) DEFAULT 0.00,
  status VARCHAR(50) DEFAULT 'completed',
  error_message TEXT,
  execution_time_ms INTEGER
);

-- Step 4: Add comments for documentation
COMMENT ON COLUMN lojas.source IS 'Source of store data: user (manual) or auto (Google Places)';
COMMENT ON COLUMN lojas.google_place_id IS 'Google Places API Place ID for duplicate prevention';
COMMENT ON TABLE auto_population_runs IS 'Tracks auto-population execution history and statistics';

-- Step 5: Create view for easy statistics
CREATE OR REPLACE VIEW store_statistics AS
SELECT
  COUNT(*) FILTER (WHERE source = 'user') as user_added_count,
  COUNT(*) FILTER (WHERE source = 'auto') as auto_added_count,
  COUNT(*) as total_stores,
  (SELECT COUNT(*) FROM auto_population_runs WHERE status = 'completed') as successful_runs,
  (SELECT SUM(stores_added) FROM auto_population_runs WHERE status = 'completed') as total_auto_added_all_time
FROM lojas;

COMMENT ON VIEW store_statistics IS 'Quick statistics about user vs auto-added stores';
