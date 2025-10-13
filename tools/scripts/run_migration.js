/**
 * Run database migration to add source tracking
 */

import { neon } from '@netlify/neon';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load .env file
dotenv.config({ path: join(dirname(fileURLToPath(import.meta.url)), '../../.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (!process.env.NETLIFY_DATABASE_URL) {
    console.error('❌ NETLIFY_DATABASE_URL not found in .env file');
    process.exit(1);
}

const sql = neon(process.env.NETLIFY_DATABASE_URL);

async function runMigration() {
    try {
        console.log('📊 Starting database migration...\n');

        // Add source column
        try {
            await sql`ALTER TABLE lojas ADD COLUMN source VARCHAR(20) DEFAULT 'user'`;
            console.log('✅ Added source column');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('⏭️  source column already exists');
            } else {
                throw e;
            }
        }

        // Update existing stores
        await sql`UPDATE lojas SET source = 'user' WHERE source IS NULL`;
        console.log('✅ Updated existing stores to user source');

        // Add google_place_id column
        try {
            await sql`ALTER TABLE lojas ADD COLUMN google_place_id VARCHAR(255)`;
            console.log('✅ Added google_place_id column');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('⏭️  google_place_id column already exists');
            } else {
                throw e;
            }
        }

        // Create unique index
        try {
            await sql`CREATE UNIQUE INDEX idx_lojas_google_place_id ON lojas(google_place_id) WHERE google_place_id IS NOT NULL`;
            console.log('✅ Created unique index on google_place_id');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('⏭️  index already exists');
            } else {
                throw e;
            }
        }

        // Create tracking table
        try {
            await sql`
                CREATE TABLE auto_population_runs (
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
                )
            `;
            console.log('✅ Created auto_population_runs table');
        } catch (e) {
            if (e.message.includes('already exists')) {
                console.log('⏭️  auto_population_runs table already exists');
            } else {
                throw e;
            }
        }

        // Create view
        try {
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
            console.log('✅ Created store_statistics view');
        } catch (e) {
            console.error('⚠️  Failed to create view:', e.message);
        }

        // Verify migration
        console.log('\n🔍 Verifying migration...');

        const result = await sql`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'lojas'
            AND column_name IN ('source', 'google_place_id')
            ORDER BY column_name
        `;

        console.log('\n✅ Columns added to lojas table:');
        result.forEach(col => {
            console.log(`   - ${col.column_name} (${col.data_type})`);
        });

        // Check statistics
        const stats = await sql`SELECT * FROM store_statistics`;
        console.log('\n📊 Current statistics:');
        console.log(`   🙂 User-added stores: ${stats[0].user_added_count}`);
        console.log(`   🙃 Auto-added stores: ${stats[0].auto_added_count}`);
        console.log(`   📈 Total stores: ${stats[0].total_stores}`);

        console.log('\n🎉 Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
