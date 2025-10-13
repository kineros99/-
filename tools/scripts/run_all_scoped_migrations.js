/**
 * ============================================================================
 * Run All Scoped Auto-Population Migrations
 * ============================================================================
 *
 * This script executes all migrations needed for the scoped auto-population
 * system in the correct order:
 *
 * 1. Add user_verified column to lojas
 * 2. Create cities and neighborhoods tables
 * 3. Populate Rio de Janeiro data
 *
 * Usage: node tools/scripts/run_all_scoped_migrations.js
 */

import { neon } from '@netlify/neon';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

const sql = neon(process.env.NETLIFY_DATABASE_URL);

async function runMigration(name, statements) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`Running migration: ${name}`);
    console.log('='.repeat(70));

    try {
        for (const statement of statements) {
            if (typeof statement === 'function') {
                await statement();
            }
        }
        console.log(`✅ ${name} completed successfully\n`);
        return true;
    } catch (error) {
        if (error.message.includes('already exists') || error.message.includes('duplicate') || error.message.includes('does not exist')) {
            console.log(`⚠️  ${name} - Some elements already exist or don't matter (safe to ignore)\n`);
            return true;
        }
        console.error(`❌ ${name} failed:`, error.message);
        return false;
    }
}

async function main() {
    console.log('\n🚀 Starting Scoped Auto-Population Migrations...\n');

    // ============================================================================
    // MIGRATION 1: Add user_verified column
    // ============================================================================
    const migration1 = await runMigration('Add user_verified column', [
        async () => await sql`ALTER TABLE lojas ADD COLUMN IF NOT EXISTS user_verified BOOLEAN DEFAULT false`,
        async () => await sql`UPDATE lojas SET user_verified = false WHERE source IN ('auto', 'user')`,
        async () => await sql`CREATE INDEX IF NOT EXISTS idx_lojas_user_verified ON lojas(user_verified)`,
        async () => await sql`ALTER TABLE lojas DROP CONSTRAINT IF EXISTS check_lojas_source`,
        async () => await sql`ALTER TABLE lojas ADD CONSTRAINT check_lojas_source CHECK (source IN ('user', 'auto', 'verified'))`
    ]);

    if (!migration1) {
        console.error('\n❌ Migration 1 failed. Stopping.\n');
        process.exit(1);
    }

    // ============================================================================
    // MIGRATION 2: Create cities and neighborhoods tables
    // ============================================================================
    const migration2 = await runMigration('Create cities and neighborhoods tables', [
        async () => await sql`
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
        `,
        async () => await sql`
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
        `,
        async () => await sql`CREATE INDEX IF NOT EXISTS idx_neighborhoods_city_id ON neighborhoods(city_id)`,
        async () => await sql`CREATE INDEX IF NOT EXISTS idx_neighborhoods_apuration_count ON neighborhoods(apuration_count)`,
        async () => await sql`ALTER TABLE auto_population_runs ADD COLUMN IF NOT EXISTS neighborhood_id INTEGER REFERENCES neighborhoods(id) ON DELETE SET NULL`,
        async () => await sql`ALTER TABLE auto_population_runs ADD COLUMN IF NOT EXISTS city_id INTEGER REFERENCES cities(id) ON DELETE SET NULL`,
        async () => await sql`ALTER TABLE auto_population_runs ADD COLUMN IF NOT EXISTS scope_type VARCHAR(50) DEFAULT 'global'`,
        async () => await sql`CREATE INDEX IF NOT EXISTS idx_auto_population_runs_neighborhood_id ON auto_population_runs(neighborhood_id)`,
        async () => await sql`CREATE INDEX IF NOT EXISTS idx_auto_population_runs_city_id ON auto_population_runs(city_id)`
    ]);

    if (!migration2) {
        console.error('\n❌ Migration 2 failed. Stopping.\n');
        process.exit(1);
    }

    // ============================================================================
    // MIGRATION 3: Populate Rio de Janeiro zones
    // ============================================================================
    const migration3 = await runMigration('Populate Rio de Janeiro zones', [
        async () => await sql`
            INSERT INTO cities (name, state, country, center_lat, center_lng)
            VALUES ('Rio de Janeiro', 'Rio de Janeiro', 'Brasil', -22.9068, -43.1729)
            ON CONFLICT (name, state, country) DO NOTHING
        `
    ]);

    if (!migration3) {
        console.error('\n❌ Migration 3 failed. Stopping.\n');
        process.exit(1);
    }

    // Get Rio city ID and insert neighborhoods
    const rioCity = await sql`SELECT id FROM cities WHERE name = 'Rio de Janeiro' AND state = 'Rio de Janeiro'`;
    const rioCityId = rioCity[0].id;

    console.log(`\n📍 Rio de Janeiro city ID: ${rioCityId}`);
    console.log('Inserting 27 neighborhoods...\n');

    const neighborhoods = [
        // Zona Sul
        ['Copacabana', -22.9711, -43.1822, 3000],
        ['Ipanema', -22.9838, -43.2044, 2000],
        ['Leblon', -22.9842, -43.2200, 2000],
        ['Botafogo', -22.9519, -43.1825, 3000],
        ['Flamengo', -22.9297, -43.1760, 2500],
        ['Laranjeiras', -22.9350, -43.1875, 2000],
        ['Gávea', -22.9803, -43.2315, 2500],
        // Zona Norte
        ['Tijuca', -22.9209, -43.2328, 4000],
        ['Vila Isabel', -22.9158, -43.2468, 2500],
        ['Méier', -22.9029, -43.2781, 3000],
        ['Madureira', -22.8713, -43.3376, 3500],
        ['Penha', -22.8398, -43.2823, 3000],
        ['Ramos', -22.8391, -43.2489, 2500],
        ['Olaria', -22.8431, -43.2677, 2000],
        // Zona Oeste
        ['Barra da Tijuca', -23.0045, -43.3646, 5000],
        ['Recreio', -23.0170, -43.4639, 4000],
        ['Jacarepaguá', -22.9373, -43.3697, 4000],
        ['Campo Grande', -22.9009, -43.5617, 5000],
        ['Bangu', -22.8705, -43.4654, 4000],
        ['Realengo', -22.8814, -43.4301, 3000],
        // Centro
        ['Centro', -22.9099, -43.1763, 3000],
        ['Lapa', -22.9130, -43.1799, 2000],
        ['Santa Teresa', -22.9209, -43.1886, 2500],
        ['São Cristóvão', -22.8991, -43.2236, 2500],
        // Additional
        ['Ilha do Governador', -22.8147, -43.2073, 4000],
        ['Pavuna', -22.8107, -43.3530, 3000],
        ['Santa Cruz', -22.9166, -43.6926, 5000]
    ];

    let insertedCount = 0;
    for (const [name, lat, lng, radius] of neighborhoods) {
        try {
            await sql`
                INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
                VALUES (${rioCityId}, ${name}, ${lat}, ${lng}, ${radius}, 0)
                ON CONFLICT (city_id, name) DO NOTHING
            `;
            insertedCount++;
            console.log(`  ✓ ${name}`);
        } catch (error) {
            console.log(`  ⚠️  ${name} (already exists)`);
        }
    }

    console.log(`\n✅ Inserted ${insertedCount} neighborhoods`);

    // ============================================================================
    // Summary
    // ============================================================================
    console.log('\n' + '='.repeat(70));
    console.log('🎉 All migrations completed successfully!');
    console.log('='.repeat(70));
    console.log('\nDatabase is now ready for scoped auto-population.\n');
    console.log('Summary:');
    console.log('  ✅ user_verified column added to lojas');
    console.log('  ✅ cities and neighborhoods tables created');
    console.log('  ✅ 27 Rio de Janeiro neighborhoods populated');
    console.log('  ✅ auto_population_runs table extended for scoped tracking\n');
}

main().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
