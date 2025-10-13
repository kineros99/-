/**
 * ============================================================================
 * Database Migration: Add UNIQUE Constraint to google_place_id
 * ============================================================================
 *
 * This script adds a UNIQUE constraint to the lojas.google_place_id column
 * to enable duplicate prevention in the auto-population system.
 *
 * Usage:
 *   node tools/scripts/add_place_id_constraint.js
 *
 * Prerequisites:
 *   - NETLIFY_DATABASE_URL environment variable must be set
 */

import { neon } from '@netlify/neon';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const sql = neon(process.env.NETLIFY_DATABASE_URL);

async function addConstraint() {
    console.log('[Migration] Starting database migration...');
    console.log('[Migration] Adding UNIQUE constraint to lojas.google_place_id');

    try {
        // First, check if the column exists
        const columnCheck = await sql`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'lojas'
            AND column_name = 'google_place_id'
        `;

        if (columnCheck.length === 0) {
            console.log('[Migration] ⚠️  Column google_place_id does not exist. Creating it first...');

            await sql`
                ALTER TABLE lojas
                ADD COLUMN google_place_id VARCHAR(255)
            `;

            console.log('[Migration] ✅ Column google_place_id created');
        } else {
            console.log('[Migration] ✓ Column google_place_id exists');
        }

        // Check if constraint already exists
        const constraintCheck = await sql`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_name = 'lojas'
            AND constraint_name = 'lojas_google_place_id_unique'
        `;

        if (constraintCheck.length > 0) {
            console.log('[Migration] ⚠️  Constraint already exists. Skipping...');
            return;
        }

        // Add the UNIQUE constraint
        await sql`
            ALTER TABLE lojas
            ADD CONSTRAINT lojas_google_place_id_unique
            UNIQUE (google_place_id)
        `;

        console.log('[Migration] ✅ UNIQUE constraint added successfully');
        console.log('[Migration] The ON CONFLICT (google_place_id) clause will now work properly');

        // Verify the constraint
        const verification = await sql`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_name = 'lojas'
            AND constraint_name = 'lojas_google_place_id_unique'
        `;

        if (verification.length > 0) {
            console.log('[Migration] ✅ Constraint verified:', verification[0]);
        }

    } catch (error) {
        console.error('[Migration] ❌ Error:', error.message);
        console.error('[Migration] Full error:', error);
        process.exit(1);
    }
}

// Run the migration
addConstraint()
    .then(() => {
        console.log('[Migration] ✅ Migration completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('[Migration] ❌ Migration failed:', error);
        process.exit(1);
    });
