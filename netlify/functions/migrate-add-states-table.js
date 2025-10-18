/**
 * ============================================================================
 * Migration: Add States Table
 * ============================================================================
 *
 * Creates a dedicated `states` table to store state/province/region data
 * for all countries. This enables proper hierarchical data:
 * Country → State → City → Neighborhood
 *
 * Benefits:
 * - Decouples states from cities (no need for cities to extract states)
 * - Enables state-level discovery before cities are added
 * - Supports bulk operations and caching
 * - Improves query performance
 *
 * Endpoint: /.netlify/functions/migrate-add-states-table
 * Method: GET or POST
 * Run once to create the table
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async () => {
    try {
        console.log('[Migration] Starting states table migration...\n');

        // ====================================================================
        // Step 1: Create states table
        // ====================================================================
        console.log('[Migration] Step 1: Creating states table...');

        await sql`
            CREATE TABLE IF NOT EXISTS states (
                id SERIAL PRIMARY KEY,
                country_code VARCHAR(2) NOT NULL REFERENCES countries(country_code) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                state_code VARCHAR(10),
                center_lat DECIMAL(10, 7),
                center_lng DECIMAL(10, 7),
                bounds_ne_lat DECIMAL(10, 7),
                bounds_ne_lng DECIMAL(10, 7),
                bounds_sw_lat DECIMAL(10, 7),
                bounds_sw_lng DECIMAL(10, 7),
                city_count INTEGER DEFAULT 0,
                population BIGINT,
                area_km2 DECIMAL(12, 2),
                geonames_id INTEGER,
                osm_id BIGINT,
                source VARCHAR(50) DEFAULT 'geonames',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(country_code, name)
            )
        `;

        console.log('[Migration] ✓ States table created');

        // ====================================================================
        // Step 2: Create indexes for performance
        // ====================================================================
        console.log('\n[Migration] Step 2: Creating indexes...');

        await sql`
            CREATE INDEX IF NOT EXISTS idx_states_country_code
            ON states(country_code)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_states_geonames_id
            ON states(geonames_id)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_states_name
            ON states(name)
        `;

        console.log('[Migration] ✓ Indexes created');

        // ====================================================================
        // Step 3: Add index to cities table for faster state queries
        // ====================================================================
        console.log('\n[Migration] Step 3: Adding indexes to cities table...');

        await sql`
            CREATE INDEX IF NOT EXISTS idx_cities_country_code_state
            ON cities(country_code, state)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_cities_state
            ON cities(state)
        `;

        console.log('[Migration] ✓ Cities indexes created');

        // ====================================================================
        // Step 4: Populate states table from existing cities (Brazil only)
        // ====================================================================
        console.log('\n[Migration] Step 4: Populating states from existing cities...');

        // Get unique states from existing Brazilian cities
        const brazilStates = await sql`
            SELECT DISTINCT
                country_code,
                state,
                MIN(center_lat) as min_lat,
                MAX(center_lat) as max_lat,
                MIN(center_lng) as min_lng,
                MAX(center_lng) as max_lng,
                COUNT(*) as city_count
            FROM cities
            WHERE country_code = 'BR'
                AND state IS NOT NULL
                AND state != ''
            GROUP BY country_code, state
        `;

        console.log(`[Migration] Found ${brazilStates.length} Brazilian states in cities table`);

        // Brazilian state codes mapping
        const BR_STATE_CODES = {
            'Acre': 'AC',
            'Alagoas': 'AL',
            'Amapá': 'AP',
            'Amazonas': 'AM',
            'Bahia': 'BA',
            'Ceará': 'CE',
            'Distrito Federal': 'DF',
            'Espírito Santo': 'ES',
            'Goiás': 'GO',
            'Maranhão': 'MA',
            'Mato Grosso': 'MT',
            'Mato Grosso do Sul': 'MS',
            'Minas Gerais': 'MG',
            'Pará': 'PA',
            'Paraíba': 'PB',
            'Paraná': 'PR',
            'Pernambuco': 'PE',
            'Piauí': 'PI',
            'Rio de Janeiro': 'RJ',
            'Rio Grande do Norte': 'RN',
            'Rio Grande do Sul': 'RS',
            'Rondônia': 'RO',
            'Roraima': 'RR',
            'Santa Catarina': 'SC',
            'São Paulo': 'SP',
            'Sergipe': 'SE',
            'Tocantins': 'TO'
        };

        let inserted = 0;
        for (const state of brazilStates) {
            const stateCode = BR_STATE_CODES[state.state] || state.state.substring(0, 2).toUpperCase();
            const centerLat = (parseFloat(state.min_lat) + parseFloat(state.max_lat)) / 2;
            const centerLng = (parseFloat(state.min_lng) + parseFloat(state.max_lng)) / 2;

            await sql`
                INSERT INTO states (
                    country_code,
                    name,
                    state_code,
                    center_lat,
                    center_lng,
                    bounds_ne_lat,
                    bounds_ne_lng,
                    bounds_sw_lat,
                    bounds_sw_lng,
                    city_count,
                    source
                ) VALUES (
                    ${state.country_code},
                    ${state.state},
                    ${stateCode},
                    ${centerLat},
                    ${centerLng},
                    ${state.max_lat},
                    ${state.max_lng},
                    ${state.min_lat},
                    ${state.min_lng},
                    ${state.city_count},
                    'cities_table_extraction'
                )
                ON CONFLICT (country_code, name) DO NOTHING
            `;
            inserted++;
            console.log(`[Migration] ✓ Inserted: ${state.state} (${stateCode}) - ${state.city_count} cities`);
        }

        console.log(`[Migration] ✓ Inserted ${inserted} Brazilian states`);

        // ====================================================================
        // Step 5: Migration complete
        // ====================================================================
        console.log('\n[Migration] ===============================================');
        console.log('[Migration] ✅ MIGRATION COMPLETE');
        console.log('[Migration] ===============================================');
        console.log('[Migration] States table created and populated');
        console.log('[Migration] Indexes created for performance');
        console.log(`[Migration] ${inserted} Brazilian states imported`);
        console.log('[Migration] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: 'States table migration completed successfully',
                statistics: {
                    brazilianStatesImported: inserted,
                    tablesCreated: ['states'],
                    indexesCreated: 5
                },
                nextSteps: [
                    'Run discover-states function to populate states for other countries',
                    'States can now be queried independently of cities',
                    'Ready for state-level discovery'
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
