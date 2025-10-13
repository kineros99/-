/**
 * Verify google_place_id constraint exists
 */

import { neon } from '@netlify/neon';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '../../.env');
dotenv.config({ path: envPath });

const sql = neon(process.env.NETLIFY_DATABASE_URL);

async function verifyConstraint() {
    console.log('[Verify] Checking database constraints...');

    // Check column exists
    const column = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'lojas'
        AND column_name = 'google_place_id'
    `;

    console.log('\n[Column Info]');
    console.log(column);

    // Check constraints
    const constraints = await sql`
        SELECT constraint_name, constraint_type
        FROM information_schema.table_constraints
        WHERE table_name = 'lojas'
        AND constraint_type = 'UNIQUE'
    `;

    console.log('\n[UNIQUE Constraints on lojas table]');
    console.log(constraints);

    // Check specific constraint
    const specificConstraint = await sql`
        SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = 'lojas'
        AND tc.constraint_type = 'UNIQUE'
        AND kcu.column_name = 'google_place_id'
    `;

    console.log('\n[google_place_id UNIQUE Constraint]');
    if (specificConstraint.length > 0) {
        console.log('✅ Constraint EXISTS:');
        console.log(specificConstraint);
    } else {
        console.log('❌ Constraint NOT FOUND');
    }
}

verifyConstraint()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
