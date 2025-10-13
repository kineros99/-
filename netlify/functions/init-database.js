/**
 * ============================================================================
 * Comprehensive Database Initialization - Netlify Function
 * ============================================================================
 *
 * This function initializes ALL required database tables, columns, indexes,
 * constraints, and views for the Encarregado multi-country auto-population system.
 *
 * Features:
 * - Idempotent (safe to run multiple times)
 * - Creates all tables with proper constraints
 * - Creates all indexes for performance
 * - Creates views for statistics
 * - Uses IF NOT EXISTS for safety
 * - Proper foreign keys with CASCADE/SET NULL
 * - Comments for documentation
 *
 * Endpoint: /.netlify/functions/init-database
 * Method: GET or POST
 */

import { neon } from '@netlify/neon';

const sql = neon();

export const handler = async () => {
    try {
        console.log('[Database Init] Starting comprehensive database initialization...\n');

        // ====================================================================
        // STEP 1: Create users table
        // ====================================================================
        console.log('[Database Init] Step 1: Creating users table...');

        await sql`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT NOW()
            )
        `;

        await sql`
            COMMENT ON TABLE users IS 'Application users who can add stores'
        `;

        await sql`
            COMMENT ON COLUMN users.role IS 'User role: admin, user, etc.'
        `;

        console.log('[Database Init] ✓ Users table ready');

        // ====================================================================
        // STEP 2: Create lojas table with all columns
        // ====================================================================
        console.log('\n[Database Init] Step 2: Creating lojas table...');

        await sql`
            CREATE TABLE IF NOT EXISTS lojas (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE SET NULL,
                nome TEXT NOT NULL,
                endereco TEXT,
                telefone TEXT,
                website TEXT,
                latitude NUMERIC NOT NULL,
                longitude NUMERIC NOT NULL,
                bairro TEXT,
                categoria TEXT,
                source VARCHAR(20) DEFAULT 'user',
                google_place_id VARCHAR(255),
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            )
        `;

        // Add google_place_id column if it doesn't exist (for existing databases)
        await sql`
            ALTER TABLE lojas
            ADD COLUMN IF NOT EXISTS google_place_id VARCHAR(255)
        `;

        // Add source column if it doesn't exist (for existing databases)
        await sql`
            ALTER TABLE lojas
            ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'user'
        `;

        // Create unique index on google_place_id (only for non-null values)
        await sql`
            CREATE UNIQUE INDEX IF NOT EXISTS idx_lojas_google_place_id
            ON lojas(google_place_id)
            WHERE google_place_id IS NOT NULL
        `;

        // Create indexes for performance
        await sql`
            CREATE INDEX IF NOT EXISTS idx_lojas_bairro ON lojas(bairro)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_lojas_source ON lojas(source)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_lojas_user_id ON lojas(user_id)
        `;

        await sql`
            COMMENT ON TABLE lojas IS 'Construction material stores from users and Google Places API'
        `;

        await sql`
            COMMENT ON COLUMN lojas.source IS 'Source of store data: user (manual) or auto (Google Places)'
        `;

        await sql`
            COMMENT ON COLUMN lojas.google_place_id IS 'Google Places API Place ID for duplicate prevention'
        `;

        console.log('[Database Init] ✓ Lojas table ready with all columns and indexes');

        // ====================================================================
        // STEP 3: Create cities table (for multi-country support)
        // ====================================================================
        console.log('\n[Database Init] Step 3: Creating cities table...');

        await sql`
            CREATE TABLE IF NOT EXISTS cities (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                state VARCHAR(100) NOT NULL,
                country VARCHAR(100) NOT NULL DEFAULT 'Brasil',
                center_lat NUMERIC(10, 7) NOT NULL,
                center_lng NUMERIC(10, 7) NOT NULL,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(name, state, country)
            )
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_cities_country ON cities(country)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_cities_name ON cities(name)
        `;

        await sql`
            COMMENT ON TABLE cities IS 'Cities available for scoped auto-population (any country)'
        `;

        await sql`
            COMMENT ON COLUMN cities.country IS 'Country name (case-insensitive matched)'
        `;

        console.log('[Database Init] ✓ Cities table ready');

        // ====================================================================
        // STEP 4: Create neighborhoods table
        // ====================================================================
        console.log('\n[Database Init] Step 4: Creating neighborhoods table...');

        await sql`
            CREATE TABLE IF NOT EXISTS neighborhoods (
                id SERIAL PRIMARY KEY,
                city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                center_lat NUMERIC(10, 7) NOT NULL,
                center_lng NUMERIC(10, 7) NOT NULL,
                radius INTEGER NOT NULL DEFAULT 3000,
                apuration_count INTEGER NOT NULL DEFAULT 0,
                last_apuration_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT NOW(),
                UNIQUE(city_id, name)
            )
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_id ON neighborhoods(city_id)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_neighborhoods_apuration_count ON neighborhoods(apuration_count)
        `;

        await sql`
            COMMENT ON TABLE neighborhoods IS 'Neighborhoods/zones within cities for scoped search'
        `;

        await sql`
            COMMENT ON COLUMN neighborhoods.apuration_count IS 'Number of times this neighborhood has been searched (determines store limit)'
        `;

        await sql`
            COMMENT ON COLUMN neighborhoods.radius IS 'Search radius in meters for Google Places API'
        `;

        console.log('[Database Init] ✓ Neighborhoods table ready');

        // ====================================================================
        // STEP 5: Create auto_population_runs table
        // ====================================================================
        console.log('\n[Database Init] Step 5: Creating auto_population_runs table...');

        await sql`
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
                execution_time_ms INTEGER,
                neighborhood_id INTEGER REFERENCES neighborhoods(id) ON DELETE SET NULL,
                city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL,
                scope_type VARCHAR(50) DEFAULT 'global'
            )
        `;

        // Add new columns if they don't exist (for existing databases)
        await sql`
            ALTER TABLE auto_population_runs
            ADD COLUMN IF NOT EXISTS neighborhood_id INTEGER REFERENCES neighborhoods(id) ON DELETE SET NULL
        `;

        await sql`
            ALTER TABLE auto_population_runs
            ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL
        `;

        await sql`
            ALTER TABLE auto_population_runs
            ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) DEFAULT 'global'
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_auto_population_runs_neighborhood_id
            ON auto_population_runs(neighborhood_id)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_auto_population_runs_city_id
            ON auto_population_runs(city_id)
        `;

        await sql`
            CREATE INDEX IF NOT EXISTS idx_auto_population_runs_run_date
            ON auto_population_runs(run_date DESC)
        `;

        await sql`
            COMMENT ON TABLE auto_population_runs IS 'Tracks auto-population execution history and statistics'
        `;

        await sql`
            COMMENT ON COLUMN auto_population_runs.scope_type IS 'Type of run: global (all zones) or scoped (specific city/neighborhood)'
        `;

        console.log('[Database Init] ✓ Auto_population_runs table ready');

        // ====================================================================
        // STEP 6: Create store_statistics view
        // ====================================================================
        console.log('\n[Database Init] Step 6: Creating store_statistics view...');

        await sql`
            CREATE OR REPLACE VIEW store_statistics AS
            SELECT
                COUNT(*) FILTER (WHERE source = 'user') as user_added_count,
                COUNT(*) FILTER (WHERE source = 'auto') as auto_added_count,
                COUNT(*) as total_stores,
                (SELECT COUNT(*) FROM auto_population_runs WHERE status = 'completed') as successful_runs,
                (SELECT SUM(stores_added) FROM auto_population_runs WHERE status = 'completed') as total_auto_added_all_time
            FROM lojas
        `;

        await sql`
            COMMENT ON VIEW store_statistics IS 'Quick statistics about user vs auto-added stores'
        `;

        console.log('[Database Init] ✓ Store_statistics view ready');

        // ====================================================================
        // STEP 7: Create default admin user if not exists
        // ====================================================================
        console.log('\n[Database Init] Step 7: Creating default user...');

        const existingUsers = await sql`
            SELECT id FROM users WHERE username = 'admin' LIMIT 1
        `;

        if (existingUsers.length === 0) {
            await sql`
                INSERT INTO users (username, role)
                VALUES ('admin', 'admin')
                ON CONFLICT (username) DO NOTHING
            `;
            console.log('[Database Init] ✓ Default admin user created');
        } else {
            console.log('[Database Init] ✓ Admin user already exists');
        }

        // ====================================================================
        // STEP 8: Get database statistics
        // ====================================================================
        console.log('\n[Database Init] Step 8: Gathering statistics...');

        const stats = await sql`
            SELECT
                (SELECT COUNT(*) FROM users) as user_count,
                (SELECT COUNT(*) FROM lojas) as store_count,
                (SELECT COUNT(*) FROM cities) as city_count,
                (SELECT COUNT(*) FROM neighborhoods) as neighborhood_count,
                (SELECT COUNT(*) FROM auto_population_runs) as run_count
        `;

        const dbStats = stats[0];

        console.log('\n[Database Init] ===============================================');
        console.log('[Database Init] ✅ DATABASE INITIALIZATION COMPLETE');
        console.log('[Database Init] ===============================================');
        console.log(`[Database Init] Users: ${dbStats.user_count}`);
        console.log(`[Database Init] Stores: ${dbStats.store_count}`);
        console.log(`[Database Init] Cities: ${dbStats.city_count}`);
        console.log(`[Database Init] Neighborhoods: ${dbStats.neighborhood_count}`);
        console.log(`[Database Init] Population Runs: ${dbStats.run_count}`);
        console.log('[Database Init] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: 'Database initialized successfully',
                statistics: {
                    users: parseInt(dbStats.user_count),
                    stores: parseInt(dbStats.store_count),
                    cities: parseInt(dbStats.city_count),
                    neighborhoods: parseInt(dbStats.neighborhood_count),
                    populationRuns: parseInt(dbStats.run_count)
                },
                tables: [
                    'users',
                    'lojas',
                    'cities',
                    'neighborhoods',
                    'auto_population_runs'
                ],
                views: [
                    'store_statistics'
                ]
            }),
        };

    } catch (error) {
        console.error('[Database Init] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Database initialization failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
