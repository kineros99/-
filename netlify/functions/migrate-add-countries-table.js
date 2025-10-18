/**
 * ============================================================================
 * Database Migration - Add Countries Table for Phase 2
 * ============================================================================
 *
 * Creates the countries table for caching language/region data
 * This enables Phase 2: Database Caching Layer
 *
 * Endpoint: /.netlify/functions/migrate-add-countries-table
 * Method: GET or POST
 *
 * Run once to add the table, safe to run multiple times (idempotent)
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async () => {
    try {
        console.log('[Migration] Starting countries table migration...\n');

        // ====================================================================
        // STEP 1: Create countries table
        // ====================================================================
        console.log('[Migration] Step 1: Creating countries table...');

        await sql`
            CREATE TABLE IF NOT EXISTS countries (
                id SERIAL PRIMARY KEY,
                country_code VARCHAR(2) UNIQUE NOT NULL,
                name VARCHAR(255) NOT NULL,
                continent VARCHAR(50),
                primary_language VARCHAR(10) NOT NULL,
                full_language_code VARCHAR(10) NOT NULL,
                alternative_languages JSONB DEFAULT '[]',
                currency VARCHAR(3),
                distance_unit VARCHAR(5) DEFAULT 'km',
                neighborhood_terms JSONB NOT NULL,
                search_templates JSONB NOT NULL,
                regional_languages JSONB,
                use_zip_codes BOOLEAN DEFAULT false,
                use_postcodes BOOLEAN DEFAULT false,
                administrative_structure JSONB,
                data_sources JSONB,
                data_source VARCHAR(50) DEFAULT 'static_map',
                last_updated TIMESTAMP DEFAULT NOW(),
                created_at TIMESTAMP DEFAULT NOW(),
                CONSTRAINT valid_country_code CHECK (LENGTH(country_code) = 2)
            )
        `;

        await sql`
            COMMENT ON TABLE countries IS 'Country metadata for international language detection and localization'
        `;

        await sql`
            COMMENT ON COLUMN countries.country_code IS 'ISO 3166-1 alpha-2 country code (e.g., BR, US, JP)'
        `;

        await sql`
            COMMENT ON COLUMN countries.data_source IS 'Source of data: static_map, geonames, osm, google'
        `;

        console.log('[Migration] ✓ Countries table created');

        // ====================================================================
        // STEP 2: Create indexes for performance
        // ====================================================================
        console.log('\n[Migration] Step 2: Creating indexes...');

        await sql`
            CREATE INDEX IF NOT EXISTS idx_countries_country_code
            ON countries(country_code)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_countries_continent
            ON countries(continent)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_countries_last_updated
            ON countries(last_updated DESC)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_countries_data_source
            ON countries(data_source)
        `;

        console.log('[Migration] ✓ Indexes created');

        // ====================================================================
        // STEP 3: Add country_code column to cities table (if not exists)
        // ====================================================================
        console.log('\n[Migration] Step 3: Updating cities table...');

        await sql`
            ALTER TABLE cities
            ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) REFERENCES countries(country_code) ON DELETE SET NULL
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_cities_country_code
            ON cities(country_code)
        `;

        await sql`
            COMMENT ON COLUMN cities.country_code IS 'ISO 3166-1 alpha-2 country code linking to countries table'
        `;

        console.log('[Migration] ✓ Cities table updated');

        // ====================================================================
        // STEP 4: Add language columns to neighborhoods table
        // ====================================================================
        console.log('\n[Migration] Step 4: Updating neighborhoods table...');

        await sql`
            ALTER TABLE neighborhoods
            ADD COLUMN IF NOT EXISTS language VARCHAR(10)
        `;

        await sql`
            ALTER TABLE neighborhoods
            ADD COLUMN IF NOT EXISTS local_name VARCHAR(255)
        `;

        await sql`
            ALTER TABLE neighborhoods
            ADD COLUMN IF NOT EXISTS alternative_names JSONB
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_neighborhoods_language
            ON neighborhoods(language)
        `;

        await sql`
            COMMENT ON COLUMN neighborhoods.language IS 'Language code for this neighborhood (e.g., pt, en, ca for regional variations)'
        `;

        await sql`
            COMMENT ON COLUMN neighborhoods.local_name IS 'Neighborhood name in local language'
        `;

        await sql`
            COMMENT ON COLUMN neighborhoods.alternative_names IS 'JSON array of names in different languages'
        `;

        console.log('[Migration] ✓ Neighborhoods table updated');

        // ====================================================================
        // STEP 5: Add country_code to lojas table
        // ====================================================================
        console.log('\n[Migration] Step 5: Updating lojas table...');

        await sql`
            ALTER TABLE lojas
            ADD COLUMN IF NOT EXISTS country_code VARCHAR(2)
        `;

        await sql`
            ALTER TABLE lojas
            ADD COLUMN IF NOT EXISTS language VARCHAR(10)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_lojas_country_code
            ON lojas(country_code)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_lojas_language
            ON lojas(language)
        `;

        console.log('[Migration] ✓ Lojas table updated');

        // ====================================================================
        // STEP 6: Get statistics
        // ====================================================================
        console.log('\n[Migration] Step 6: Gathering statistics...');

        const stats = await sql`
            SELECT
                (SELECT COUNT(*) FROM countries) as country_count,
                (SELECT COUNT(*) FROM cities) as city_count,
                (SELECT COUNT(*) FROM neighborhoods) as neighborhood_count,
                (SELECT COUNT(*) FROM lojas) as store_count
        `;

        const dbStats = stats[0];

        console.log('\n[Migration] ===============================================');
        console.log('[Migration] ✅ MIGRATION COMPLETE');
        console.log('[Migration] ===============================================');
        console.log(`[Migration] Countries: ${dbStats.country_count}`);
        console.log(`[Migration] Cities: ${dbStats.city_count}`);
        console.log(`[Migration] Neighborhoods: ${dbStats.neighborhood_count}`);
        console.log(`[Migration] Stores: ${dbStats.store_count}`);
        console.log('[Migration] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: 'Countries table migration completed successfully',
                statistics: {
                    countries: parseInt(dbStats.country_count),
                    cities: parseInt(dbStats.city_count),
                    neighborhoods: parseInt(dbStats.neighborhood_count),
                    stores: parseInt(dbStats.store_count)
                },
                tablesCreated: ['countries'],
                tablesModified: ['cities', 'neighborhoods', 'lojas'],
                indexesCreated: 6,
                phase: 2,
                nextSteps: [
                    'Run /seed-countries-table to populate with static data',
                    'Run /test-phase-2-caching to validate caching',
                    'Enable Phase 3 API integrations (GeoNames, OSM)'
                ]
            }),
        };

    } catch (error) {
        console.error('[Migration] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Migration failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
