-- ============================================================================
-- Create Cities and Neighborhoods Tables for Scoped Auto-Population
-- ============================================================================
-- This migration creates the infrastructure for scoped auto-population
-- allowing admins to target specific cities and neighborhoods
-- ============================================================================

-- Cities table
CREATE TABLE IF NOT EXISTS cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Brasil',
    center_lat NUMERIC(10, 7) NOT NULL,
    center_lng NUMERIC(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, state, country)
);

-- Neighborhoods table
CREATE TABLE IF NOT EXISTS neighborhoods (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    center_lat NUMERIC(10, 7) NOT NULL,
    center_lng NUMERIC(10, 7) NOT NULL,
    radius INTEGER NOT NULL DEFAULT 3000, -- Search radius in meters
    apuration_count INTEGER NOT NULL DEFAULT 0, -- Number of times this neighborhood has been apurated
    last_apuration_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(city_id, name)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_id ON neighborhoods(city_id);
CREATE INDEX IF NOT EXISTS idx_neighborhoods_apuration_count ON neighborhoods(apuration_count);

-- Update auto_population_runs table to track neighborhood-specific runs
ALTER TABLE auto_population_runs
ADD COLUMN IF NOT EXISTS neighborhood_id INTEGER REFERENCES neighborhoods(id) ON DELETE SET NULL;

ALTER TABLE auto_population_runs
ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL;

ALTER TABLE auto_population_runs
ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) DEFAULT 'global';
-- scope_type can be: 'global' (old 550 store runs) or 'scoped' (city/neighborhood specific)

-- Create index for scoped runs
CREATE INDEX IF NOT EXISTS idx_auto_population_runs_neighborhood_id
ON auto_population_runs(neighborhood_id);

CREATE INDEX IF NOT EXISTS idx_auto_population_runs_city_id
ON auto_population_runs(city_id);
