/**
 * ============================================================================
 * Auto-Populate Stores for Specific City - Netlify Function
 * ============================================================================
 *
 * This function automatically populates construction material stores from
 * Google Places API for a specific city (any country).
 *
 * Features:
 * - Password-protected (admin only)
 * - Searches up to 111 stores per run
 * - Works with any city in any country
 * - Auto-discovers neighborhoods if not present
 * - Prevents duplicate API calls by checking existing Place IDs
 * - Marks stores as 'auto' source
 * - Tracks statistics in auto_population_runs table
 *
 * Endpoint: /.netlify/functions/auto-populate-city
 * Method: POST
 * Body: {
 *   password: "your_admin_password",
 *   cityId: 2,
 *   countryName: "Brasil" (optional)
 * }
 */

import { neon } from '@netlify/neon';
import { searchAllZones } from './utils/places_nearby_google.js';
import { verifyAdminCredentials } from './utils/admin-auth.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
        const { username, password, cityId } = JSON.parse(event.body);

        // Verify admin credentials
        if (!verifyAdminCredentials(username, password)) {
            console.log('[Auto-Populate City] ❌ Invalid credentials attempt');
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Invalid admin credentials'
                }),
            };
        }

        if (!cityId || typeof cityId !== 'number') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid city ID provided'
                }),
            };
        }

        console.log('[Auto-Populate City] ✅ Admin authenticated:', username);
        console.log(`[Auto-Populate City] Starting auto-population for city ID: ${cityId}\n`);

        // ========================================================================
        // STEP 1: Get city information
        // ========================================================================
        console.log('[Auto-Populate City] Step 1: Fetching city information...');

        const cityResult = await sql`
            SELECT id, name, state, country, center_lat, center_lng
            FROM cities
            WHERE id = ${cityId}
            LIMIT 1
        `;

        if (cityResult.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'City not found'
                }),
            };
        }

        const city = cityResult[0];
        console.log(`[Auto-Populate City] City: ${city.name}, ${city.state}, ${city.country}`);

        // ========================================================================
        // STEP 2: Get or discover neighborhoods for this city
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 2: Getting neighborhoods...');

        let neighborhoods = await sql`
            SELECT id, name, center_lat, center_lng, radius
            FROM neighborhoods
            WHERE city_id = ${cityId}
        `;

        if (neighborhoods.length === 0) {
            console.log('[Auto-Populate City] No neighborhoods found. Auto-discovering...');

            // Auto-discover neighborhoods for this city
            const discoverResponse = await fetch(`${process.env.URL || 'http://localhost:8888'}/.netlify/functions/discover-neighborhoods`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityId })
            });

            if (!discoverResponse.ok) {
                throw new Error('Failed to discover neighborhoods');
            }

            const discoverResult = await discoverResponse.json();
            neighborhoods = discoverResult.neighborhoods || [];
            console.log(`[Auto-Populate City] ✓ Discovered ${neighborhoods.length} neighborhoods`);
        } else {
            console.log(`[Auto-Populate City] Found ${neighborhoods.length} existing neighborhoods`);
        }

        if (neighborhoods.length === 0) {
            throw new Error('No neighborhoods available for this city');
        }

        // ========================================================================
        // STEP 3: Get existing Google Place IDs to prevent duplicates
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 3: Fetching existing Place IDs...');

        const existingStores = await sql`
            SELECT google_place_id
            FROM lojas
            WHERE google_place_id IS NOT NULL
        `;

        const existingPlaceIds = existingStores.map(s => s.google_place_id);
        console.log(`[Auto-Populate City] Found ${existingPlaceIds.length} existing Place IDs in database`);

        // ========================================================================
        // STEP 4: Search Google Places across all neighborhoods
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 4: Searching Google Places API...');

        // Use the generic search function with this city's neighborhoods
        // Limit to 3 neighborhoods per run to prevent timeout (3 keywords × 3 neighborhoods × ~1s = ~9s total, safe under 30s limit)
        const searchResult = await searchAllZones(111, existingPlaceIds, neighborhoods, city.country, 3);

        if (!searchResult.success) {
            throw new Error('Failed to search Google Places API');
        }

        const { stores, statistics } = searchResult;

        console.log(`\n[Auto-Populate City] Search complete:`);
        console.log(`  - Stores found: ${statistics.storesFound}`);
        console.log(`  - Stores skipped: ${statistics.storesSkipped}`);
        console.log(`  - Neighborhoods searched: ${statistics.zonesSearched}/${statistics.totalZones}`);
        console.log(`  - Remaining neighborhoods: ${statistics.remainingZones}`);
        console.log(`  - API calls used: ${statistics.apiCallsUsed}`);
        console.log(`  - Estimated cost: $${statistics.estimatedCost}`);

        // ========================================================================
        // STEP 5: Insert new stores into database
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 5: Inserting stores into database...');

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
                        google_place_id,
                        store_category
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
                        ${store.google_place_id},
                        ${store.store_category || 'unknown'}
                    )
                    ON CONFLICT (google_place_id) DO NOTHING
                `;
                storesAdded++;
            } catch (error) {
                console.error(`[Auto-Populate City] ⚠️  Failed to insert ${store.nome}: ${error.message}`);
                errors.push({ store: store.nome, error: error.message });
            }
        }

        console.log(`[Auto-Populate City] ✅ Successfully inserted ${storesAdded} stores`);
        if (errors.length > 0) {
            console.log(`[Auto-Populate City] ⚠️  ${errors.length} stores failed to insert`);
        }

        // ========================================================================
        // STEP 6: Get updated statistics
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 6: Calculating statistics...');

        const stats = await sql`SELECT * FROM store_statistics`;
        const currentStats = stats[0];

        console.log(`[Auto-Populate City] Current totals:`);
        console.log(`  🙂 User-added: ${currentStats.user_added_count}`);
        console.log(`  🙃 Auto-added: ${currentStats.auto_added_count}`);
        console.log(`  📈 Total: ${currentStats.total_stores}`);

        // ========================================================================
        // STEP 7: Log this run to tracking table
        // ========================================================================
        console.log('\n[Auto-Populate City] Step 7: Logging run statistics...');

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

        console.log(`[Auto-Populate City] ✅ Run logged successfully`);
        console.log(`[Auto-Populate City] Execution time: ${executionTime}ms\n`);

        // ========================================================================
        // STEP 8: Return success response
        // ========================================================================
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: `Auto-population completed for ${city.name}, ${city.state}`,
                city: {
                    id: city.id,
                    name: city.name,
                    state: city.state,
                    country: city.country
                },
                results: {
                    storesAdded: storesAdded,
                    storesSkipped: statistics.storesSkipped,
                    storesFoundByGoogle: statistics.storesFound,
                    neighborhoodsSearched: statistics.zonesSearched,
                    totalNeighborhoods: statistics.totalZones,
                    remainingNeighborhoods: statistics.remainingZones,
                    hitNeighborhoodLimit: statistics.hitNeighborhoodLimit,
                    moreAvailable: statistics.remainingZones > 0,
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
        console.error('[Auto-Populate City] ❌ Error:', error);

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
            console.error('[Auto-Populate City] Failed to log error:', logError);
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
