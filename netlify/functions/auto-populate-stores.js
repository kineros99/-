/**
 * ============================================================================
 * Auto-Populate Stores from Google Places API
 * ============================================================================
 *
 * This function automatically populates construction material stores from
 * Google Places API across all Rio de Janeiro neighborhoods.
 *
 * Features:
 * - Password-protected (admin only)
 * - Searches up to 111 stores per run
 * - Prevents duplicate API calls by checking existing Place IDs
 * - Marks stores as 'auto' source
 * - Tracks statistics in auto_population_runs table
 *
 * Endpoint: /.netlify/functions/auto-populate-stores
 * Method: POST
 * Body: { password: "your_admin_password" }
 */

import { neon } from '@netlify/neon';
import { searchAllRioZones } from './utils/places_nearby_google.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123'; // Set in Netlify env vars

export const handler = async (event) => {
    const startTime = Date.now();

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { password } = JSON.parse(event.body);

        // Verify admin password
        if (password !== ADMIN_PASSWORD) {
            console.log('[Auto-Populate] ❌ Invalid password attempt');
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Invalid admin password'
                }),
            };
        }

        console.log('[Auto-Populate] ✅ Admin authenticated');
        console.log('[Auto-Populate] Starting auto-population process...\n');

        // ========================================================================
        // STEP 1: Get existing Google Place IDs to prevent duplicates
        // ========================================================================
        console.log('[Auto-Populate] Step 1: Fetching existing Place IDs...');

        const existingStores = await sql`
            SELECT google_place_id
            FROM lojas
            WHERE google_place_id IS NOT NULL
        `;

        const existingPlaceIds = existingStores.map(s => s.google_place_id);
        console.log(`[Auto-Populate] Found ${existingPlaceIds.length} existing Place IDs in database`);

        // ========================================================================
        // STEP 2: Search Google Places across all Rio zones
        // ========================================================================
        console.log('\n[Auto-Populate] Step 2: Searching Google Places API...');

        const searchResult = await searchAllRioZones(111, existingPlaceIds);

        if (!searchResult.success) {
            throw new Error('Failed to search Google Places API');
        }

        const { stores, statistics } = searchResult;

        console.log(`\n[Auto-Populate] Search complete:`);
        console.log(`  - Stores found: ${statistics.storesFound}`);
        console.log(`  - Stores skipped: ${statistics.storesSkipped}`);
        console.log(`  - API calls used: ${statistics.apiCallsUsed}`);
        console.log(`  - Estimated cost: $${statistics.estimatedCost}`);

        // ========================================================================
        // STEP 3: Insert new stores into database
        // ========================================================================
        console.log('\n[Auto-Populate] Step 3: Inserting stores into database...');

        let storesAdded = 0;
        const errors = [];

        for (const store of stores) {
            try {
                await sql`
                    INSERT INTO lojas (
                        user_id,
                        nome,
                        endereco,
                        telefone,
                        website,
                        latitude,
                        longitude,
                        bairro,
                        categoria,
                        source,
                        google_place_id
                    )
                    VALUES (
                        1,
                        ${store.nome},
                        ${store.endereco},
                        ${store.telefone},
                        ${store.website},
                        ${store.latitude},
                        ${store.longitude},
                        ${store.bairro},
                        ${store.categoria},
                        'auto',
                        ${store.google_place_id}
                    )
                    ON CONFLICT (google_place_id) DO NOTHING
                `;
                storesAdded++;
            } catch (error) {
                console.error(`[Auto-Populate] ⚠️  Failed to insert ${store.nome}: ${error.message}`);
                errors.push({ store: store.nome, error: error.message });
            }
        }

        console.log(`[Auto-Populate] ✅ Successfully inserted ${storesAdded} stores`);
        if (errors.length > 0) {
            console.log(`[Auto-Populate] ⚠️  ${errors.length} stores failed to insert`);
        }

        // ========================================================================
        // STEP 4: Get updated statistics
        // ========================================================================
        console.log('\n[Auto-Populate] Step 4: Calculating statistics...');

        const stats = await sql`SELECT * FROM store_statistics`;
        const currentStats = stats[0];

        console.log(`[Auto-Populate] Current totals:`);
        console.log(`  🙂 User-added: ${currentStats.user_added_count}`);
        console.log(`  🙃 Auto-added: ${currentStats.auto_added_count}`);
        console.log(`  📈 Total: ${currentStats.total_stores}`);

        // ========================================================================
        // STEP 5: Log this run to tracking table
        // ========================================================================
        console.log('\n[Auto-Populate] Step 5: Logging run statistics...');

        const executionTime = Date.now() - startTime;

        await sql`
            INSERT INTO auto_population_runs (
                stores_added,
                stores_skipped,
                total_auto_stores,
                total_user_stores,
                api_calls_used,
                estimated_cost,
                status,
                execution_time_ms
            )
            VALUES (
                ${storesAdded},
                ${statistics.storesSkipped},
                ${currentStats.auto_added_count},
                ${currentStats.user_added_count},
                ${statistics.apiCallsUsed},
                ${parseFloat(statistics.estimatedCost)},
                'completed',
                ${executionTime}
            )
        `;

        console.log(`[Auto-Populate] ✅ Run logged successfully`);
        console.log(`[Auto-Populate] Execution time: ${executionTime}ms\n`);

        // ========================================================================
        // STEP 6: Return success response
        // ========================================================================
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: 'Auto-population completed successfully',
                results: {
                    storesAdded: storesAdded,
                    storesSkipped: statistics.storesSkipped,
                    apiCallsUsed: statistics.apiCallsUsed,
                    estimatedCost: `$${statistics.estimatedCost}`,
                    executionTimeMs: executionTime
                },
                statistics: {
                    userAddedCount: currentStats.user_added_count,
                    autoAddedCount: currentStats.auto_added_count,
                    totalStores: currentStats.total_stores
                },
                errors: errors.length > 0 ? errors : null
            }),
        };

    } catch (error) {
        console.error('[Auto-Populate] ❌ Error:', error);

        const executionTime = Date.now() - startTime;

        // Log failed run
        try {
            await sql`
                INSERT INTO auto_population_runs (
                    stores_added,
                    stores_skipped,
                    api_calls_used,
                    status,
                    error_message,
                    execution_time_ms
                )
                VALUES (0, 0, 0, 'failed', ${error.message}, ${executionTime})
            `;
        } catch (logError) {
            console.error('[Auto-Populate] Failed to log error:', logError);
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Auto-population failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
