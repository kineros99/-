/**
 * Migration: Add store_category column to lojas table
 *
 * This migration adds a new column to categorize stores by type:
 * - paint: Paint stores (Tintas)
 * - lumber: Lumber/wood stores (Madeira)
 * - plumbing: Plumbing supplies (Hidráulica)
 * - hardware: Hardware/tools stores (Ferragens)
 * - general: General construction stores (Geral)
 * - unknown: Uncategorized stores
 *
 * Endpoint: /.netlify/functions/migrate-add-store-category
 * Method: GET
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async () => {
    try {
        console.log('[Migration] Adding store_category column to lojas table...');

        // Add the store_category column with default value 'unknown'
        await sql`
            ALTER TABLE lojas
            ADD COLUMN IF NOT EXISTS store_category VARCHAR(50) DEFAULT 'unknown'
        `;

        console.log('[Migration] ✅ Column added successfully');

        // Update existing stores to 'general' if they don't have a category
        await sql`
            UPDATE lojas
            SET store_category = 'general'
            WHERE store_category IS NULL OR store_category = 'unknown'
        `;

        console.log('[Migration] ✅ Updated existing stores to "general"');

        // Get count of stores by category
        const categoryCounts = await sql`
            SELECT store_category, COUNT(*) as count
            FROM lojas
            GROUP BY store_category
            ORDER BY count DESC
        `;

        console.log('[Migration] Category distribution:', categoryCounts);

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: true,
                message: 'Migration completed successfully',
                categoryCounts: categoryCounts
            }),
        };

    } catch (error) {
        console.error('[Migration] ❌ Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Migration failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
