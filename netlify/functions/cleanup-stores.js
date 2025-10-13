/**
 * Cleanup Stores - Keep only 5 stores per neighborhood
 *
 * This function removes excess stores, keeping only 5 stores per neighborhood.
 * Useful for cleaning up the database before re-running auto-population.
 *
 * Endpoint: /.netlify/functions/cleanup-stores
 * Method: GET (add ?confirm=true to actually delete)
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async (event) => {
    const confirm = event.queryStringParameters?.confirm === 'true';

    try {
        console.log('[Cleanup] Starting cleanup process...');

        // Step 1: Get all unique neighborhoods
        const neighborhoods = await sql`
            SELECT DISTINCT bairro
            FROM lojas
            WHERE bairro IS NOT NULL AND bairro != ''
            ORDER BY bairro
        `;

        console.log(`[Cleanup] Found ${neighborhoods.length} neighborhoods`);

        // Step 2: Preview what will be deleted
        let totalToDelete = 0;
        let totalToKeep = 0;
        const preview = [];

        for (const { bairro } of neighborhoods) {
            const storesInBairro = await sql`
                SELECT COUNT(*) as count
                FROM lojas
                WHERE bairro = ${bairro}
            `;

            const count = parseInt(storesInBairro[0].count);
            const toDelete = Math.max(0, count - 5);
            const toKeep = Math.min(5, count);

            totalToDelete += toDelete;
            totalToKeep += toKeep;

            if (toDelete > 0) {
                preview.push({
                    bairro,
                    current: count,
                    toKeep: toKeep,
                    toDelete: toDelete
                });
            }
        }

        console.log(`[Cleanup] Total to keep: ${totalToKeep}`);
        console.log(`[Cleanup] Total to delete: ${totalToDelete}`);

        // Step 3: If confirm=true, actually delete
        let deleted = 0;
        if (confirm) {
            console.log('[Cleanup] CONFIRM=TRUE - Proceeding with deletion...');

            for (const { bairro } of neighborhoods) {
                // Get IDs to keep (first 5 by ID)
                const toKeep = await sql`
                    SELECT id
                    FROM lojas
                    WHERE bairro = ${bairro}
                    ORDER BY id
                    LIMIT 5
                `;

                const keepIds = toKeep.map(r => r.id);

                if (keepIds.length > 0) {
                    // Delete everything else in this neighborhood
                    // Use a subquery instead of IN array
                    const result = await sql`
                        DELETE FROM lojas
                        WHERE bairro = ${bairro}
                        AND id NOT IN (
                            SELECT id FROM lojas
                            WHERE bairro = ${bairro}
                            ORDER BY id
                            LIMIT 5
                        )
                    `;

                    deleted += result.count || 0;
                    console.log(`[Cleanup] ${bairro}: Kept ${keepIds.length}, deleted ${result.count || 0}`);
                }
            }

            console.log(`[Cleanup] ✅ Cleanup complete! Deleted ${deleted} stores`);

            // Get final count
            const finalCount = await sql`SELECT COUNT(*) as count FROM lojas`;

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Cleanup completed',
                    deleted: deleted,
                    remaining: parseInt(finalCount[0].count),
                    neighborhoods: neighborhoods.length
                })
            };
        } else {
            // Just preview
            console.log('[Cleanup] PREVIEW MODE - No deletion performed');

            return {
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Preview mode - add ?confirm=true to actually delete',
                    preview: {
                        totalNeighborhoods: neighborhoods.length,
                        totalStores: totalToKeep + totalToDelete,
                        toKeep: totalToKeep,
                        toDelete: totalToDelete,
                        byNeighborhood: preview
                    }
                })
            };
        }

    } catch (error) {
        console.error('[Cleanup] Error:', error);
        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Cleanup failed',
                message: error.message
            })
        };
    }
};
