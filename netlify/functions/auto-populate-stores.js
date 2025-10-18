/**
 * ============================================================================
 * Auto-Populate Stores from Google Places API (with Hierarchical Filters)
 * ============================================================================
 *
 * This function automatically populates construction material stores from
 * Google Places API with optional hierarchical filtering.
 *
 * Features:
 * - Password-protected (admin only)
 * - Hierarchical filters: Country → State → City (all optional)
 * - Searches up to 111 stores per run
 * - Prevents duplicate API calls by checking existing Place IDs
 * - Marks stores as 'auto' source
 * - Tracks statistics in auto_population_runs table
 *
 * Endpoint: /.netlify/functions/auto-populate-stores
 * Method: POST
 * Body: {
 *   password: "your_admin_password",
 *   filters: {
 *     country_code: null | "BR" | "US" | ...,
 *     state: null | "Rio de Janeiro" | "Ceará" | ...,
 *     city_id: null | 1 | 22 | ...
 *   }
 * }
 */

import { neon } from '@netlify/neon';
import { searchNearbyStores } from './utils/places_nearby_google.js';
import { normalizeCountryCode } from './utils/language-detector.js';
import { verifyAdminCredentials } from './utils/admin-auth.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const TIME_BUDGET_MS = 24000; // 24 seconds safe limit (Netlify timeout is 26s)

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
        const { username, password, filters } = JSON.parse(event.body);

        // Verify admin credentials
        if (!verifyAdminCredentials(username, password)) {
            console.log('[Auto-Populate] ❌ Invalid credentials attempt');
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Invalid admin credentials'
                }),
            };
        }

        console.log('[Auto-Populate] ✅ Admin authenticated:', username);
        console.log('[Auto-Populate] Starting auto-population process...\n');

        // ========================================================================
        // STEP 0: Process and log filter configuration
        // ========================================================================
        const appliedFilters = filters || {};
        const { country_code, state, city_id } = appliedFilters;

        console.log('[Auto-Populate] 🎯 Filter Configuration:');
        if (!country_code && !state && !city_id) {
            console.log('   🌍 Mode: GLOBAL (no filters)');
            console.log('   Searching across ALL countries, states, and cities');
        } else if (country_code && !state && !city_id) {
            console.log('   🌍 Mode: COUNTRY FILTER');
            console.log(`   Country Code: ${country_code}`);
        } else if (country_code && state && !city_id) {
            console.log('   🗺️  Mode: STATE FILTER');
            console.log(`   Country Code: ${country_code}`);
            console.log(`   State: ${state}`);
        } else if (country_code && state && city_id) {
            console.log('   🏙️  Mode: CITY FILTER');
            console.log(`   Country Code: ${country_code}`);
            console.log(`   State: ${state}`);
            console.log(`   City ID: ${city_id}`);
        }
        console.log('');

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
        // STEP 2: Query neighborhoods based on filters
        // ========================================================================
        console.log('\n[Auto-Populate] Step 2: Querying neighborhoods based on filters...');

        let neighborhoods;

        if (city_id) {
            // City filter: get neighborhoods for specific city
            neighborhoods = await sql`
                SELECT
                    n.id, n.name, n.center_lat, n.center_lng, n.radius,
                    n.apuration_count, n.city_id,
                    c.name as city_name,
                    c.state,
                    c.country as city_country,
                    c.country_code
                FROM neighborhoods n
                JOIN cities c ON c.id = n.city_id
                WHERE c.id = ${city_id}
                ORDER BY n.name
                LIMIT 30
            `;
        } else if (state) {
            // State filter: get neighborhoods for all cities in state
            neighborhoods = await sql`
                SELECT
                    n.id, n.name, n.center_lat, n.center_lng, n.radius,
                    n.apuration_count, n.city_id,
                    c.name as city_name,
                    c.state,
                    c.country as city_country,
                    c.country_code
                FROM neighborhoods n
                JOIN cities c ON c.id = n.city_id
                WHERE c.state = ${state}
                ORDER BY n.name
                LIMIT 30
            `;
        } else if (country_code) {
            // Country filter: get neighborhoods for all cities in country
            neighborhoods = await sql`
                SELECT
                    n.id, n.name, n.center_lat, n.center_lng, n.radius,
                    n.apuration_count, n.city_id,
                    c.name as city_name,
                    c.state,
                    c.country as city_country,
                    c.country_code
                FROM neighborhoods n
                JOIN cities c ON c.id = n.city_id
                WHERE c.country_code = ${country_code}
                ORDER BY n.name
                LIMIT 30
            `;
        } else {
            // No filter: get neighborhoods from all countries
            neighborhoods = await sql`
                SELECT
                    n.id, n.name, n.center_lat, n.center_lng, n.radius,
                    n.apuration_count, n.city_id,
                    c.name as city_name,
                    c.state,
                    c.country as city_country,
                    c.country_code
                FROM neighborhoods n
                JOIN cities c ON c.id = n.city_id
                ORDER BY n.name
                LIMIT 30
            `;
        }

        if (neighborhoods.length === 0) {
            console.log('[Auto-Populate] ⚠️  No neighborhoods found matching the filters');

            // Provide helpful guidance based on filter type
            let message = 'No neighborhoods match the specified filters.';
            let suggestion = 'Please use the Scoped Auto-Population page (admin-scoped.html) to discover geographic data first.';

            if (country_code) {
                const countryQuery = await sql`SELECT name FROM countries WHERE country_code = ${country_code} LIMIT 1`;
                const countryName = countryQuery.length > 0 ? countryQuery[0].name : country_code;
                message = `No neighborhoods found for ${countryName} (${country_code}).`;
                suggestion = `Please use admin-scoped.html to:\n1. Select ${countryName}\n2. Click "Descobrir Estados" to discover states\n3. Click "Descobrir Cidades" to discover cities\n4. Discover neighborhoods for each city\n\nThen return here to run auto-population.`;
            } else if (state) {
                message = `No neighborhoods found for state: ${state}.`;
                suggestion = 'Please use admin-scoped.html to discover cities and neighborhoods for this state first.';
            }

            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'No neighborhoods found',
                    message: message,
                    suggestion: suggestion,
                    workflow: 'Use admin-scoped.html for discovery, then admin.html for filtered auto-population'
                }),
            };
        }

        console.log(`[Auto-Populate] Found ${neighborhoods.length} neighborhoods to search`);

        // ========================================================================
        // STEP 3: Search Google Places for each neighborhood
        // ========================================================================
        console.log('\n[Auto-Populate] Step 3: Searching Google Places API...\n');

        const allStores = [];
        let totalApiCalls = 0;
        let totalStoresSkipped = 0;
        let totalStoresFound = 0;
        const neighborhoodResults = [];
        let timeoutPrevented = false;

        const searchStartTime = Date.now();

        for (const neighborhood of neighborhoods) {
            // Check time budget
            const elapsedTime = Date.now() - searchStartTime;
            const remainingTime = TIME_BUDGET_MS - elapsedTime;

            if (elapsedTime > TIME_BUDGET_MS) {
                console.log(`\n[Auto-Populate] ⏱️  TIME BUDGET EXCEEDED (${(elapsedTime / 1000).toFixed(1)}s / 24s)`);
                console.log(`[Auto-Populate] Returning partial results to prevent timeout`);
                console.log(`[Auto-Populate] Completed: ${neighborhoodResults.length}/${neighborhoods.length} neighborhoods`);
                timeoutPrevented = true;
                break;
            }

            console.log(`[Auto-Populate] ⏱️  Time remaining: ${(remainingTime / 1000).toFixed(1)}s`);
            console.log(`\n[Auto-Populate] Searching ${neighborhood.city_name} / ${neighborhood.name}...`);
            console.log(`[Auto-Populate]   Radius: ${neighborhood.radius}m`);

            // Use country_code from database or normalize country name
            const countryCode = neighborhood.country_code
                ? neighborhood.country_code
                : normalizeCountryCode(neighborhood.city_country || 'Brasil');
            console.log(`[Auto-Populate]   Country: ${neighborhood.city_country} (${countryCode})`);

            // Search this neighborhood with language-aware keywords
            const result = await searchNearbyStores(
                parseFloat(neighborhood.center_lat),
                parseFloat(neighborhood.center_lng),
                neighborhood.radius,
                20, // Max 20 per call
                countryCode, // Country code for language-aware keywords
                null // No category filter (search all categories)
            );

            totalApiCalls++;

            if (!result.success) {
                console.error(`[Auto-Populate] ⚠️  Failed to search ${neighborhood.name}: ${result.message}`);
                neighborhoodResults.push({
                    neighborhood_id: neighborhood.id,
                    neighborhood_name: neighborhood.name,
                    stores_added: 0,
                    stores_skipped: 0,
                    api_calls: 1,
                    error: result.message
                });
                continue;
            }

            if (result.found === 0) {
                console.log(`[Auto-Populate] No stores found in ${neighborhood.name}`);
                neighborhoodResults.push({
                    neighborhood_id: neighborhood.id,
                    neighborhood_name: neighborhood.name,
                    stores_added: 0,
                    stores_skipped: 0,
                    api_calls: 1
                });
                continue;
            }

            totalStoresFound += result.found;

            // Filter out duplicates
            let skippedForNeighborhood = 0;
            const newStores = result.stores.filter(store => {
                const isDuplicate = existingPlaceIds.includes(store.google_place_id);
                if (isDuplicate) {
                    skippedForNeighborhood++;
                    totalStoresSkipped++;
                    existingPlaceIds.push(store.google_place_id);
                }
                return !isDuplicate;
            });

            // Add neighborhood info to stores
            newStores.forEach(store => {
                store.bairro = neighborhood.name;
                store.neighborhood_id = neighborhood.id;
            });

            allStores.push(...newStores);

            console.log(`[Auto-Populate] ${neighborhood.name}: Found ${result.found}, New: ${newStores.length}, Skipped: ${skippedForNeighborhood}`);

            neighborhoodResults.push({
                neighborhood_id: neighborhood.id,
                neighborhood_name: neighborhood.name,
                stores_added: newStores.length,
                stores_skipped: skippedForNeighborhood,
                api_calls: 1
            });

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n[Auto-Populate] Search complete:`);
        console.log(`  - Total stores found: ${totalStoresFound}`);
        console.log(`  - Total stores to add: ${allStores.length}`);
        console.log(`  - Total stores skipped: ${totalStoresSkipped}`);
        console.log(`  - Total API calls: ${totalApiCalls}`);
        console.log(`  - Total neighborhoods searched: ${neighborhoodResults.length}/${neighborhoods.length}`);

        // ========================================================================
        // STEP 4: Insert new stores into database (BATCH INSERT)
        // ========================================================================
        console.log('\n[Auto-Populate] Step 4: Inserting stores into database...');

        let storesAdded = 0;
        const errors = [];

        if (allStores.length > 0) {
            try {
                // Use batch insert for better performance
                const BATCH_SIZE = 100;
                const batches = [];

                for (let i = 0; i < allStores.length; i += BATCH_SIZE) {
                    batches.push(allStores.slice(i, i + BATCH_SIZE));
                }

                console.log(`[Auto-Populate] Inserting ${allStores.length} stores in ${batches.length} batches...`);

                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];

                    const batchPromises = batch.map(store =>
                        sql`
                            INSERT INTO lojas (
                                user_id, nome, endereco, telefone, website,
                                latitude, longitude, bairro, categoria,
                                source, google_place_id, user_verified
                            )
                            VALUES (
                                1, ${store.nome}, ${store.endereco}, ${store.telefone}, ${store.website},
                                ${store.latitude}, ${store.longitude}, ${store.bairro}, ${store.categoria},
                                'auto', ${store.google_place_id}, false
                            )
                            ON CONFLICT (google_place_id) DO NOTHING
                        `.then(() => ({ success: true, store: store.nome }))
                          .catch(err => ({ success: false, store: store.nome, error: err.message }))
                    );

                    const results = await Promise.all(batchPromises);
                    const successes = results.filter(r => r.success).length;
                    const failures = results.filter(r => !r.success);

                    storesAdded += successes;

                    if (failures.length > 0) {
                        failures.forEach(f => {
                            console.error(`[Auto-Populate] Failed to insert ${f.store}: ${f.error}`);
                            errors.push({ store: f.store, error: f.error });
                        });
                    }

                    console.log(`[Auto-Populate]   ✓ Batch ${batchIndex + 1}/${batches.length}: ${successes}/${batch.length} stores inserted`);
                }

                console.log(`[Auto-Populate] ✅ Successfully inserted ${storesAdded} stores`);

            } catch (error) {
                console.error(`[Auto-Populate] ⚠️  Batch insert error: ${error.message}`);
                errors.push({ operation: 'batch_insert', error: error.message });
            }
        } else {
            console.log(`[Auto-Populate] No stores to insert`);
        }

        if (errors.length > 0) {
            console.log(`[Auto-Populate] ⚠️  ${errors.length} errors occurred during insertion`);
        }

        // ========================================================================
        // STEP 5: Get updated statistics
        // ========================================================================
        console.log('\n[Auto-Populate] Step 5: Calculating statistics...');

        const stats = await sql`SELECT * FROM store_statistics`;
        const currentStats = stats[0];

        console.log(`[Auto-Populate] Current totals:`);
        console.log(`  🙂 User-added: ${currentStats.user_added_count}`);
        console.log(`  🙃 Auto-added: ${currentStats.auto_added_count}`);
        console.log(`  📈 Total: ${currentStats.total_stores}`);

        // ========================================================================
        // STEP 6: Log this run to tracking table
        // ========================================================================
        console.log('\n[Auto-Populate] Step 6: Logging run statistics...');

        const executionTime = Date.now() - startTime;
        const estimatedCost = (totalApiCalls * 0.032).toFixed(4);

        await sql`
            INSERT INTO auto_population_runs (
                stores_added,
                stores_skipped,
                total_auto_stores,
                total_user_stores,
                api_calls_used,
                estimated_cost,
                status,
                execution_time_ms,
                scope_type
            )
            VALUES (
                ${storesAdded},
                ${totalStoresSkipped},
                ${currentStats.auto_added_count},
                ${currentStats.user_added_count},
                ${totalApiCalls},
                ${parseFloat(estimatedCost)},
                'completed',
                ${executionTime},
                'filtered'
            )
        `;

        console.log(`[Auto-Populate] ✅ Run logged successfully`);
        console.log(`[Auto-Populate] Execution time: ${executionTime}ms\n`);

        // ========================================================================
        // STEP 7: Return success response
        // ========================================================================
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: timeoutPrevented
                    ? 'Auto-population completed with partial results (time budget reached)'
                    : 'Auto-population completed successfully',
                results: {
                    storesFoundByGoogle: totalStoresFound,
                    storesAdded: storesAdded,
                    storesSkipped: totalStoresSkipped,
                    neighborhoodsSearched: neighborhoodResults.length,
                    totalNeighborhoods: neighborhoods.length,
                    remainingNeighborhoods: neighborhoods.length - neighborhoodResults.length,
                    moreAvailable: neighborhoods.length > neighborhoodResults.length,
                    apiCallsUsed: totalApiCalls,
                    estimatedCost: `$${estimatedCost}`,
                    executionTimeMs: executionTime
                },
                statistics: {
                    userAddedCount: currentStats.user_added_count,
                    autoAddedCount: currentStats.auto_added_count,
                    totalStores: currentStats.total_stores
                },
                neighborhoods: neighborhoodResults,
                metadata: {
                    timeout_prevented: timeoutPrevented,
                    time_budget_ms: TIME_BUDGET_MS,
                    filters_applied: appliedFilters
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
                    execution_time_ms,
                    scope_type
                )
                VALUES (0, 0, 0, 'failed', ${error.message}, ${executionTime}, 'filtered')
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
