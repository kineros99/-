/**
 * ============================================================================
 * Scoped Auto-Populate - Netlify Function
 * ============================================================================
 *
 * Executes auto-population for specific neighborhoods with dynamic store limits
 * based on apuration count.
 *
 * Store Limits Logic:
 * - 1st apuration: 666 stores
 * - 2nd apuration: 666 stores
 * - 3rd-6th apurations: 20 stores
 * - 7th+ apurations: 18 stores
 *
 * Endpoint: /.netlify/functions/scoped-auto-populate
 * Method: POST
 * Body: {
 *   password: "admin_password",
 *   neighborhood_ids: [1, 2, 3]
 * }
 */

import { neon } from '@netlify/neon';
import { searchNearbyStores } from './utils/places_nearby_google.js';
import { normalizeCountryCode } from './utils/language-detector.js';
import { searchPlaces as searchFoursquarePlaces } from './utils/foursquare-integration.js';
import { verifyAdminCredentials } from './utils/admin-auth.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const TIME_BUDGET_MS = 24000; // 24 seconds safe limit (Netlify timeout is 26s)

/**
 * Calculate the store limit based on apuration count
 */
function calculateStoreLimit(apurationCount) {
    if (apurationCount === 0) return 666;   // First run
    if (apurationCount === 1) return 666;   // Second run (extended from 20 to 666)
    if (apurationCount >= 2 && apurationCount <= 5) return 20;  // 3rd-6th runs
    if (apurationCount >= 6) return 18;     // 7th+ runs
    return 666; // Default fallback
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}

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
        const { username, password, neighborhood_ids, store_categories } = JSON.parse(event.body);

        // ========================================================================
        // STEP 1: Verify admin credentials
        // ========================================================================
        if (!verifyAdminCredentials(username, password)) {
            console.log('[Scoped Auto-Populate] ❌ Invalid credentials attempt');
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Invalid admin credentials'
                }),
            };
        }

        if (!neighborhood_ids || !Array.isArray(neighborhood_ids) || neighborhood_ids.length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Invalid request',
                    message: 'neighborhood_ids must be a non-empty array'
                }),
            };
        }

        console.log('[Scoped Auto-Populate] ✅ Admin authenticated:', username);
        console.log(`[Scoped Auto-Populate] Starting apuration for ${neighborhood_ids.length} neighborhoods...`);

        if (store_categories && store_categories.length > 0) {
            console.log(`[Scoped Auto-Populate] 🎯 Category filter: ${store_categories.join(', ')}`);
        } else {
            console.log(`[Scoped Auto-Populate] 📦 Using default categories (general, plumbing, hardware)`);
        }
        console.log('');

        // ========================================================================
        // STEP 2: Get existing stores to prevent duplicates
        // ========================================================================
        console.log('[Scoped Auto-Populate] Step 1: Fetching existing stores...');

        const existingStores = await sql`
            SELECT google_place_id, nome, latitude, longitude, source
            FROM lojas
        `;

        const existingPlaceIds = existingStores
            .filter(s => s.google_place_id)
            .map(s => s.google_place_id);
        console.log(`[Scoped Auto-Populate] Found ${existingPlaceIds.length} existing Place IDs in database`);

        // ========================================================================
        // STEP 3: Get neighborhood details and calculate limits
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 2: Loading neighborhood data...');

        const neighborhoods = await sql`
            SELECT
                n.id,
                n.name,
                n.center_lat,
                n.center_lng,
                n.radius,
                n.apuration_count,
                n.city_id,
                c.name as city_name,
                c.country as city_country,
                c.country_code
            FROM neighborhoods n
            JOIN cities c ON c.id = n.city_id
            WHERE n.id = ANY(${neighborhood_ids})
        `;

        if (neighborhoods.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'No neighborhoods found',
                    message: 'None of the provided neighborhood IDs exist'
                }),
            };
        }

        console.log(`[Scoped Auto-Populate] Loaded ${neighborhoods.length} neighborhoods:`);
        neighborhoods.forEach(n => {
            const limit = calculateStoreLimit(n.apuration_count);
            console.log(`  - ${n.city_name} / ${n.name}: Apuration #${n.apuration_count + 1} (limit: ${limit} stores)`);
        });

        // ========================================================================
        // STEP 4: Search Google Places for each neighborhood
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 3: Searching Google Places API...\n');

        const allStores = [];
        let totalApiCalls = 0;
        let totalStoresSkipped = 0;
        const neighborhoodResults = [];
        let timeoutPrevented = false;

        const searchStartTime = Date.now();

        for (const neighborhood of neighborhoods) {
            // Check time budget before processing each neighborhood
            const elapsedTime = Date.now() - searchStartTime;
            const remainingTime = TIME_BUDGET_MS - elapsedTime;

            if (elapsedTime > TIME_BUDGET_MS) {
                console.log(`\n[Scoped Auto-Populate] ⏱️  TIME BUDGET EXCEEDED (${(elapsedTime / 1000).toFixed(1)}s / 24s)`);
                console.log(`[Scoped Auto-Populate] Returning partial results to prevent timeout`);
                console.log(`[Scoped Auto-Populate] Completed: ${neighborhoodResults.length}/${neighborhoods.length} neighborhoods`);
                timeoutPrevented = true;
                break;
            }

            console.log(`[Scoped Auto-Populate] ⏱️  Time remaining: ${(remainingTime / 1000).toFixed(1)}s`);
            const limit = calculateStoreLimit(neighborhood.apuration_count);
            let storesForNeighborhood = [];
            let apiCallsForNeighborhood = 0;
            let skippedForNeighborhood = 0;

            console.log(`\n[Scoped Auto-Populate] Searching ${neighborhood.name}...`);
            console.log(`[Scoped Auto-Populate]   Limit: ${limit} stores`);
            console.log(`[Scoped Auto-Populate]   Radius: ${neighborhood.radius}m`);

            // Use country_code from countries table if available, otherwise normalize country name
            const countryCode = neighborhood.country_code
                ? neighborhood.country_code
                : normalizeCountryCode(neighborhood.city_country || 'Brasil');
            console.log(`[Scoped Auto-Populate]   Country: ${neighborhood.city_country} (${countryCode})`);

            // Log category selection for transparency
            const categoriesUsed = store_categories && store_categories.length > 0
                ? store_categories
                : ['general', 'plumbing', 'hardware'];
            console.log(`[Scoped Auto-Populate]   Categories: ${categoriesUsed.join(', ')}`);
            console.log(`[Scoped Auto-Populate]   Language-aware search: Keywords will be in local language`);

            // Search this neighborhood with language-aware keywords
            const result = await searchNearbyStores(
                parseFloat(neighborhood.center_lat),
                parseFloat(neighborhood.center_lng),
                neighborhood.radius,
                Math.min(20, limit), // Google API max is 20 per call
                countryCode, // Pass country code for language-aware keyword selection
                store_categories || null // Pass category filter (optional)
            );

            apiCallsForNeighborhood++;
            totalApiCalls++;

            if (!result.success) {
                console.error(`[Scoped Auto-Populate] ⚠️  Failed to search ${neighborhood.name}: ${result.message}`);
                neighborhoodResults.push({
                    neighborhood_id: neighborhood.id,
                    neighborhood_name: neighborhood.name,
                    stores_added: 0,
                    stores_skipped: 0,
                    api_calls: apiCallsForNeighborhood,
                    error: result.message
                });
                continue;
            }

            if (result.found === 0) {
                console.log(`[Scoped Auto-Populate] No stores found in ${neighborhood.name}`);
                neighborhoodResults.push({
                    neighborhood_id: neighborhood.id,
                    neighborhood_name: neighborhood.name,
                    stores_added: 0,
                    stores_skipped: 0,
                    api_calls: apiCallsForNeighborhood
                });
                continue;
            }

            // Filter out duplicates
            const newStores = result.stores.filter(store => {
                const isDuplicate = existingPlaceIds.includes(store.google_place_id);
                if (isDuplicate) {
                    skippedForNeighborhood++;
                    totalStoresSkipped++;
                    existingPlaceIds.push(store.google_place_id); // Mark as existing for next iterations
                }
                return !isDuplicate;
            });

            // ============================================================
            // FOURSQUARE BACKUP: Dynamic threshold based on search scope
            // - Neighborhood-level (radius < 5km): Trigger if <10 stores
            // - City-level or above (radius >= 5km): Trigger if <45 stores
            // ============================================================
            const iscityLevel = neighborhood.radius >= 5000; // 5km+ = city-level search
            const foursquareThreshold = iscityLevel ? 45 : 10;

            let foursquareStores = [];
            if (newStores.length < foursquareThreshold) {
                const scope = iscityLevel ? 'city-level' : 'neighborhood-level';
                console.log(`[Scoped Auto-Populate] 🟡 Google found ${newStores.length} < ${foursquareThreshold} stores (${scope}), triggering Foursquare backup...`);

                try {
                    // Search Foursquare for stores
                    const foursquarePlaces = await searchFoursquarePlaces(
                        'store shop market',
                        parseFloat(neighborhood.center_lat),
                        parseFloat(neighborhood.center_lng),
                        neighborhood.radius,
                        30 // Request up to 30 results to compensate for Google's lack
                    );

                    apiCallsForNeighborhood++;
                    totalApiCalls++;

                    console.log(`[Scoped Auto-Populate] Foursquare found ${foursquarePlaces.length} places`);

                    // Transform Foursquare results to our store format
                    const transformedFoursquare = foursquarePlaces.map(place => ({
                        nome: place.name,
                        endereco: place.address || 'Address not available',
                        telefone: null, // Foursquare doesn't provide phone in basic search
                        website: null,
                        latitude: place.lat,
                        longitude: place.lng,
                        categoria: 'general',
                        google_place_id: null, // Foursquare results don't have Google Place IDs
                        foursquare_id: place.id, // Store Foursquare ID for reference
                        source: 'foursquare'
                    }));

                    // Deduplicate Foursquare results against:
                    // 1. Google results from current search
                    // 2. Existing stores in database
                    // (check for name similarity + proximity within 50m)
                    const deduplicatedFoursquare = transformedFoursquare.filter(fsqStore => {
                        // Check against Google results from current search
                        const duplicateInGoogle = newStores.some(googleStore => {
                            const nameSimilar = googleStore.nome.toLowerCase() === fsqStore.nome.toLowerCase();
                            const distance = calculateDistance(
                                googleStore.latitude,
                                googleStore.longitude,
                                fsqStore.latitude,
                                fsqStore.longitude
                            );
                            return nameSimilar || distance < 50;
                        });

                        // Check against existing stores in database
                        const duplicateInDatabase = existingStores.some(existingStore => {
                            const nameSimilar = existingStore.nome.toLowerCase() === fsqStore.nome.toLowerCase();
                            const distance = calculateDistance(
                                existingStore.latitude,
                                existingStore.longitude,
                                fsqStore.latitude,
                                fsqStore.longitude
                            );
                            return nameSimilar || distance < 50;
                        });

                        return !duplicateInGoogle && !duplicateInDatabase;
                    });

                    foursquareStores = deduplicatedFoursquare;
                    console.log(`[Scoped Auto-Populate] Foursquare: ${foursquarePlaces.length} found, ${deduplicatedFoursquare.length} unique (after dedup)`);

                } catch (fsqError) {
                    console.warn(`[Scoped Auto-Populate] ⚠️  Foursquare backup failed: ${fsqError.message}`);
                    // Don't throw - continue with Google results only
                }
            }

            // Combine Google + Foursquare results
            const combinedStores = [...newStores, ...foursquareStores];

            // Apply limit
            const limitedStores = combinedStores.slice(0, limit);

            // Add neighborhood info to stores
            limitedStores.forEach(store => {
                store.bairro = neighborhood.name;
                store.neighborhood_id = neighborhood.id;
            });

            storesForNeighborhood = limitedStores;
            allStores.push(...limitedStores);

            // Log results with source breakdown
            if (foursquareStores.length > 0) {
                console.log(`[Scoped Auto-Populate] ${neighborhood.name}: Google ${newStores.length} + Foursquare ${foursquareStores.length} = ${combinedStores.length} total, Added: ${limitedStores.length}, Skipped: ${skippedForNeighborhood}`);
            } else {
                console.log(`[Scoped Auto-Populate] ${neighborhood.name}: Found ${result.found}, New: ${newStores.length}, Added: ${limitedStores.length}, Skipped: ${skippedForNeighborhood}`);
            }

            neighborhoodResults.push({
                neighborhood_id: neighborhood.id,
                neighborhood_name: neighborhood.name,
                stores_added: limitedStores.length,
                stores_skipped: skippedForNeighborhood,
                api_calls: apiCallsForNeighborhood
            });

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        console.log(`\n[Scoped Auto-Populate] Search complete:`);
        console.log(`  - Total stores to add: ${allStores.length}`);
        console.log(`  - Total stores skipped: ${totalStoresSkipped}`);
        console.log(`  - Total API calls: ${totalApiCalls}`);

        // ========================================================================
        // STEP 5: Insert new stores into database (BATCH INSERT)
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 4: Inserting stores into database...');
        console.log(`[Scoped Auto-Populate] Using batch insert for ${allStores.length} stores...`);

        let storesAdded = 0;
        const errors = [];

        if (allStores.length > 0) {
            try {
                // Build batch INSERT statement
                // Split into chunks of 100 to avoid query size limits
                const BATCH_SIZE = 100;
                const batches = [];

                for (let i = 0; i < allStores.length; i += BATCH_SIZE) {
                    batches.push(allStores.slice(i, i + BATCH_SIZE));
                }

                console.log(`[Scoped Auto-Populate] Inserting ${allStores.length} stores in ${batches.length} batches...`);

                for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                    const batch = batches[batchIndex];

                    // Use Promise.allSettled to insert all stores in this batch concurrently
                    // This allows all inserts to complete even if some fail
                    const batchPromises = batch.map(store =>
                        sql`
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
                                user_verified
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
                                false
                            )
                            ON CONFLICT (google_place_id) DO NOTHING
                        `.then(() => ({ success: true, store: store.nome }))
                          .catch(err => ({ success: false, store: store.nome, error: err.message }))
                    );

                    // Wait for all inserts in this batch to complete
                    const results = await Promise.all(batchPromises);

                    // Count successes and failures
                    const successes = results.filter(r => r.success).length;
                    const failures = results.filter(r => !r.success);

                    storesAdded += successes;

                    if (failures.length > 0) {
                        failures.forEach(f => {
                            console.error(`[Scoped Auto-Populate] Failed to insert ${f.store}: ${f.error}`);
                            errors.push({ store: f.store, error: f.error });
                        });
                    }

                    console.log(`[Scoped Auto-Populate]   ✓ Batch ${batchIndex + 1}/${batches.length}: ${successes}/${batch.length} stores inserted`);
                }

                console.log(`[Scoped Auto-Populate] ✅ Successfully inserted ${storesAdded} stores`);

            } catch (error) {
                console.error(`[Scoped Auto-Populate] ⚠️  Batch insert error: ${error.message}`);
                errors.push({ operation: 'batch_insert', error: error.message });

                // Fallback to individual inserts if batch fails
                console.log(`[Scoped Auto-Populate] Falling back to individual inserts...`);

                for (const store of allStores) {
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
                                user_verified
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
                                false
                            )
                            ON CONFLICT (google_place_id) DO NOTHING
                        `;
                        storesAdded++;
                    } catch (insertError) {
                        console.error(`[Scoped Auto-Populate] ⚠️  Failed to insert ${store.nome}: ${insertError.message}`);
                        errors.push({ store: store.nome, error: insertError.message });
                    }
                }
            }
        }

        if (errors.length > 0) {
            console.log(`[Scoped Auto-Populate] ⚠️  ${errors.length} errors occurred during insertion`);
        }

        // ========================================================================
        // STEP 6: Update apuration counts for each neighborhood
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 5: Updating neighborhood apuration counts...');

        for (const neighborhood of neighborhoods) {
            await sql`
                UPDATE neighborhoods
                SET
                    apuration_count = apuration_count + 1,
                    last_apuration_date = NOW()
                WHERE id = ${neighborhood.id}
            `;
            console.log(`  ✓ ${neighborhood.name}: apuration_count = ${neighborhood.apuration_count + 1}`);
        }

        // ========================================================================
        // STEP 7: Get updated statistics
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 6: Calculating statistics...');

        const stats = await sql`SELECT * FROM store_statistics`;
        const currentStats = stats[0];

        console.log(`[Scoped Auto-Populate] Current totals:`);
        console.log(`  🙂 User-added: ${currentStats.user_added_count}`);
        console.log(`  🙃 Auto-added: ${currentStats.auto_added_count}`);
        console.log(`  📈 Total: ${currentStats.total_stores}`);

        // ========================================================================
        // STEP 8: Log this run to tracking table
        // ========================================================================
        console.log('\n[Scoped Auto-Populate] Step 7: Logging run statistics...');

        const executionTime = Date.now() - startTime;
        const cityId = neighborhoods[0].city_id;

        // Log overall run
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
                scope_type,
                city_id
            )
            VALUES (
                ${storesAdded},
                ${totalStoresSkipped},
                ${currentStats.auto_added_count},
                ${currentStats.user_added_count},
                ${totalApiCalls},
                ${(totalApiCalls * 0.032).toFixed(4)},
                'completed',
                ${executionTime},
                'scoped',
                ${cityId}
            )
        `;

        console.log(`[Scoped Auto-Populate] ✅ Run logged successfully`);
        console.log(`[Scoped Auto-Populate] Execution time: ${executionTime}ms\n`);

        // ========================================================================
        // STEP 9: Return success response
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
                    ? 'Scoped auto-population completed with partial results (time budget reached)'
                    : 'Scoped auto-population completed successfully',
                summary: {
                    neighborhoods_searched: neighborhoods.length,
                    stores_added: storesAdded,
                    stores_skipped: totalStoresSkipped,
                    api_calls_used: totalApiCalls,
                    estimated_cost: `$${(totalApiCalls * 0.032).toFixed(4)}`,
                    execution_time_ms: executionTime
                },
                neighborhoods: neighborhoodResults,
                statistics: {
                    user_added_count: currentStats.user_added_count,
                    auto_added_count: currentStats.auto_added_count,
                    total_stores: currentStats.total_stores
                },
                metadata: {
                    timeout_prevented: timeoutPrevented,
                    neighborhoods_completed: neighborhoodResults.length,
                    neighborhoods_total: neighborhoods.length,
                    time_budget_ms: TIME_BUDGET_MS,
                    execution_time_ms: executionTime
                },
                errors: errors.length > 0 ? errors : null
            }),
        };

    } catch (error) {
        console.error('[Scoped Auto-Populate] ❌ Error:', error);

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
                VALUES (0, 0, 0, 'failed', ${error.message}, ${executionTime}, 'scoped')
            `;
        } catch (logError) {
            console.error('[Scoped Auto-Populate] Failed to log error:', logError);
        }

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Scoped auto-population failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
