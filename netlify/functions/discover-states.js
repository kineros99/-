/**
 * ============================================================================
 * Discover States - Netlify Function
 * ============================================================================
 *
 * Discovers all states/provinces/regions for a given country using:
 * - Geonames API (primary source)
 * - OSM Nominatim API (fallback)
 *
 * This function enables dynamic state discovery without manual database entry.
 *
 * Endpoint: /.netlify/functions/discover-states
 * Method: POST
 *
 * Body:
 * {
 *   "countryCode": "US"  // ISO 3166-1 alpha-2 country code
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "states": [...],
 *   "count": 50,
 *   "source": "geonames",
 *   "message": "50 states discovered for United States"
 * }
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'demo'; // You need to register at geonames.org

// Geonames API: Administrative divisions
const GEONAMES_API_URL = 'http://api.geonames.org/childrenJSON';

// OSM Nominatim API (fallback)
const OSM_NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/**
 * Discover states using Geonames API
 */
async function discoverStatesGeonames(countryCode, countryName) {
    console.log(`[Discover States] Using Geonames API for ${countryCode} (${countryName})...`);

    try {
        // Get country geonameId first - search by name for better accuracy
        const countrySearchUrl = `http://api.geonames.org/searchJSON?name=${encodeURIComponent(countryName)}&featureCode=PCLI&maxRows=5&username=${GEONAMES_USERNAME}`;
        const countryResponse = await fetch(countrySearchUrl);
        const countryData = await countryResponse.json();

        if (!countryData.geonames || countryData.geonames.length === 0) {
            throw new Error('Country not found in Geonames');
        }

        // Find the correct country by matching country code
        let countryMatch = countryData.geonames.find(c => c.countryCode === countryCode);

        // Fallback to first result if no exact match
        if (!countryMatch) {
            console.warn(`[Discover States] No exact match for ${countryCode}, using first result`);
            countryMatch = countryData.geonames[0];
        }

        const countryGeonameId = countryMatch.geonameId;
        console.log(`[Discover States] Country: ${countryMatch.name} (${countryMatch.countryCode})`);
        console.log(`[Discover States] Country geonameId: ${countryGeonameId}`);

        // Get states (admin level 1)
        const statesUrl = `${GEONAMES_API_URL}?geonameId=${countryGeonameId}&username=${GEONAMES_USERNAME}`;
        const statesResponse = await fetch(statesUrl);
        const statesData = await statesResponse.json();

        if (!statesData.geonames || statesData.geonames.length === 0) {
            console.log(`[Discover States] No states found via Geonames`);
            return { success: false, states: [] };
        }

        console.log(`[Discover States] Found ${statesData.geonames.length} states via Geonames`);

        const states = statesData.geonames
            .filter(state =>
                state.fcode === 'ADM1' || // Administrative division level 1
                state.fcode === 'PRSH' ||  // Parish (for countries like Portugal)
                state.fcode === 'TERR'     // Territory
            )
            .map(state => ({
                name: state.name,
                state_code: state.adminCode1 || state.name.substring(0, 2).toUpperCase(),
                center_lat: parseFloat(state.lat),
                center_lng: parseFloat(state.lng),
                bounds_ne_lat: state.bbox ? parseFloat(state.bbox.north) : null,
                bounds_ne_lng: state.bbox ? parseFloat(state.bbox.east) : null,
                bounds_sw_lat: state.bbox ? parseFloat(state.bbox.south) : null,
                bounds_sw_lng: state.bbox ? parseFloat(state.bbox.west) : null,
                population: state.population || null,
                geonames_id: state.geonameId,
                source: 'geonames'
            }));

        return {
            success: true,
            states: states,
            source: 'geonames'
        };

    } catch (error) {
        console.error(`[Discover States] Geonames API error: ${error.message}`);
        return { success: false, states: [], error: error.message };
    }
}

/**
 * Discover states using OSM Nominatim API (fallback)
 */
async function discoverStatesOSM(countryCode, countryName) {
    console.log(`[Discover States] Using OSM Nominatim API for ${countryCode}...`);

    try {
        const url = `${OSM_NOMINATIM_URL}?` + new URLSearchParams({
            country: countryCode,
            featuretype: 'state',
            format: 'json',
            limit: 100,
            addressdetails: 1
        });

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Encarregado-App/1.0' // OSM requires User-Agent
            }
        });

        const data = await response.json();

        if (!data || data.length === 0) {
            console.log(`[Discover States] No states found via OSM Nominatim`);
            return { success: false, states: [] };
        }

        console.log(`[Discover States] Found ${data.length} results via OSM Nominatim`);

        // Filter to only state-level results
        const states = data
            .filter(place => {
                const type = place.type || '';
                const addressType = place.addresstype || '';
                return (
                    type.includes('administrative') ||
                    type === 'state' ||
                    addressType === 'state'
                );
            })
            .map(place => ({
                name: place.display_name.split(',')[0].trim(),
                state_code: null, // OSM doesn't provide state codes
                center_lat: parseFloat(place.lat),
                center_lng: parseFloat(place.lon),
                bounds_ne_lat: place.boundingbox ? parseFloat(place.boundingbox[1]) : null,
                bounds_ne_lng: place.boundingbox ? parseFloat(place.boundingbox[3]) : null,
                bounds_sw_lat: place.boundingbox ? parseFloat(place.boundingbox[0]) : null,
                bounds_sw_lng: place.boundingbox ? parseFloat(place.boundingbox[2]) : null,
                population: null,
                osm_id: place.osm_id || null,
                source: 'osm'
            }));

        // Remove duplicates by name
        const uniqueStates = Array.from(
            new Map(states.map(s => [s.name.toLowerCase(), s])).values()
        );

        return {
            success: true,
            states: uniqueStates,
            source: 'osm'
        };

    } catch (error) {
        console.error(`[Discover States] OSM Nominatim API error: ${error.message}`);
        return { success: false, states: [], error: error.message };
    }
}

export const handler = async (event) => {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { countryCode } = JSON.parse(event.body);

        if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid country code. Must be a 2-letter ISO code (e.g., "US", "BR")'
                }),
            };
        }

        const normalizedCode = countryCode.toUpperCase();
        console.log(`\n[Discover States] Starting state discovery for ${normalizedCode}...`);

        // ====================================================================
        // Step 1: Check if states already exist in database
        // ====================================================================
        console.log('[Discover States] Step 1: Checking existing states...');

        const existingStates = await sql`
            SELECT id, name, state_code, center_lat, center_lng, source
            FROM states
            WHERE country_code = ${normalizedCode}
            ORDER BY name
        `;

        if (existingStates.length > 0) {
            console.log(`[Discover States] Found ${existingStates.length} existing states in database`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    states: existingStates,
                    count: existingStates.length,
                    message: `${existingStates.length} states already exist in database`,
                    alreadyExists: true,
                    source: 'database'
                }),
            };
        }

        // ====================================================================
        // Step 2: Get country information
        // ====================================================================
        console.log('[Discover States] Step 2: Getting country information...');

        const countryResult = await sql`
            SELECT country_code, name
            FROM countries
            WHERE country_code = ${normalizedCode}
            LIMIT 1
        `;

        if (countryResult.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Country not found',
                    message: `Country code ${normalizedCode} not found in database`
                }),
            };
        }

        const country = countryResult[0];
        console.log(`[Discover States] Country: ${country.name} (${country.country_code})`);

        // ====================================================================
        // Step 3: Discover states using Geonames API (primary)
        // ====================================================================
        console.log('[Discover States] Step 3: Discovering states via Geonames...');

        let discoveryResult = await discoverStatesGeonames(normalizedCode, country.name);

        // ====================================================================
        // Step 4: Fallback to OSM Nominatim if Geonames fails
        // ====================================================================
        if (!discoveryResult.success || discoveryResult.states.length === 0) {
            console.log('[Discover States] Step 4: Falling back to OSM Nominatim...');
            discoveryResult = await discoverStatesOSM(normalizedCode, country.name);
        }

        if (!discoveryResult.success || discoveryResult.states.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'No states found',
                    message: `Could not discover states for ${country.name} using any API`
                }),
            };
        }

        const discoveredStates = discoveryResult.states;
        console.log(`[Discover States] Discovered ${discoveredStates.length} states via ${discoveryResult.source}`);

        // ====================================================================
        // Step 5: Insert discovered states into database
        // ====================================================================
        console.log('[Discover States] Step 5: Saving states to database...');

        const insertedStates = [];
        const errors = [];

        for (const state of discoveredStates) {
            try {
                const inserted = await sql`
                    INSERT INTO states (
                        country_code,
                        name,
                        state_code,
                        center_lat,
                        center_lng,
                        bounds_ne_lat,
                        bounds_ne_lng,
                        bounds_sw_lat,
                        bounds_sw_lng,
                        population,
                        geonames_id,
                        osm_id,
                        source
                    ) VALUES (
                        ${normalizedCode},
                        ${state.name},
                        ${state.state_code},
                        ${state.center_lat},
                        ${state.center_lng},
                        ${state.bounds_ne_lat},
                        ${state.bounds_ne_lng},
                        ${state.bounds_sw_lat},
                        ${state.bounds_sw_lng},
                        ${state.population},
                        ${state.geonames_id || null},
                        ${state.osm_id || null},
                        ${state.source}
                    )
                    ON CONFLICT (country_code, name)
                    DO UPDATE SET
                        center_lat = EXCLUDED.center_lat,
                        center_lng = EXCLUDED.center_lng,
                        bounds_ne_lat = EXCLUDED.bounds_ne_lat,
                        bounds_ne_lng = EXCLUDED.bounds_ne_lng,
                        bounds_sw_lat = EXCLUDED.bounds_sw_lat,
                        bounds_sw_lng = EXCLUDED.bounds_sw_lng,
                        updated_at = NOW()
                    RETURNING id, name, state_code, center_lat, center_lng, source
                `;

                insertedStates.push(inserted[0]);
                console.log(`[Discover States] ✓ ${state.name} (${state.state_code || 'N/A'})`);

            } catch (error) {
                console.error(`[Discover States] ✗ Error inserting ${state.name}: ${error.message}`);
                errors.push({ name: state.name, error: error.message });
            }
        }

        console.log(`[Discover States] ✓ Successfully saved ${insertedStates.length} states`);

        // ====================================================================
        // Step 6: Return success response
        // ====================================================================
        console.log('[Discover States] ===============================================');
        console.log(`[Discover States] ✅ DISCOVERY COMPLETE`);
        console.log(`[Discover States] ${insertedStates.length} states saved for ${country.name}`);
        console.log(`[Discover States] Source: ${discoveryResult.source}`);
        console.log('[Discover States] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                states: insertedStates,
                count: insertedStates.length,
                source: discoveryResult.source,
                message: `${insertedStates.length} states discovered and saved for ${country.name}`,
                errors: errors.length > 0 ? errors : undefined
            }),
        };

    } catch (error) {
        console.error('[Discover States] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Failed to discover states',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
