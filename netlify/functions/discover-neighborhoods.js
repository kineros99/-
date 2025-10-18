/**
 * ============================================================================
 * Discover Neighborhoods - Netlify Function
 * ============================================================================
 *
 * Discovers neighborhoods for a city using Google Places API Text Search
 * and adds them to the database automatically.
 *
 * Endpoint: /.netlify/functions/discover-neighborhoods
 * Method: POST
 *
 * Body:
 * {
 *   "cityId": 2
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "neighborhoods": [...],
 *   "count": 25,
 *   "message": "25 neighborhoods discovered for Fortaleza"
 * }
 */

import { neon } from '@netlify/neon';
import {
    getLanguageForCity,
    getLocalizedNeighborhoodQuery,
    buildGooglePlacesParams,
    getNeighborhoodTerminology,
    normalizeCountryCode,
    logLanguageDetection
} from './utils/language-detector.js';
import {
    queryOverpassNeighborhoods,
    searchAdminBoundaries
} from './utils/osm-nominatim-integration.js';
import {
    discoverNeighborhoodsGrid
} from './utils/opencage-integration.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';

/**
 * Calculate appropriate radius based on place types
 */
function calculateRadius(types) {
    // Large areas: 5km radius
    if (types.includes('administrative_area_level_3') ||
        types.includes('sublocality_level_1')) {
        return 5000;
    }
    // Medium areas: 3km radius
    if (types.includes('sublocality') ||
        types.includes('neighborhood')) {
        return 3000;
    }
    // Small areas: 2km radius
    return 2000;
}

/**
 * ============================================================================
 * Deduplication Logic - Multi-Layer Support
 * ============================================================================
 */

/**
 * Deduplicate neighborhoods by name similarity and proximity
 *
 * Removes:
 * - Exact name matches (case insensitive)
 * - Similar names (>80% similarity)
 * - Very close coordinates (<500m apart) with similar names (>60%)
 *
 * @param {Array} existing - Array of existing neighborhoods
 * @param {Array} newResults - Array of new neighborhoods to check
 * @returns {Array} Unique neighborhoods that don't duplicate existing ones
 */
function deduplicateNeighborhoods(existing, newResults) {
    const unique = [];

    for (const newNbh of newResults) {
        let isDuplicate = false;

        // Get coordinates (handle different property names from different sources)
        const newLat = newNbh.lat || newNbh.center_lat;
        const newLng = newNbh.lon || newNbh.lng || newNbh.center_lng;

        for (const existingNbh of existing) {
            const existingLat = existingNbh.lat || existingNbh.center_lat;
            const existingLng = existingNbh.lon || existingNbh.lng || existingNbh.center_lng;

            // Check name similarity
            const nameSimilarity = calculateSimilarity(
                newNbh.name.toLowerCase(),
                existingNbh.name.toLowerCase()
            );

            // Check distance (if both have coordinates)
            let distance = Infinity;
            if (newLat && newLng && existingLat && existingLng) {
                distance = calculateDistance(newLat, newLng, existingLat, existingLng);
            }

            // Duplicate if:
            // 1. Very similar names (>80% similarity), OR
            // 2. Moderately similar names (>60%) AND close proximity (<500m)
            if (nameSimilarity > 0.8 || (nameSimilarity > 0.6 && distance < 500)) {
                isDuplicate = true;
                break;
            }
        }

        if (!isDuplicate) {
            unique.push(newNbh);
        }
    }

    return unique;
}

/**
 * Calculate string similarity using Levenshtein distance
 *
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Similarity score (0-1, where 1 is identical)
 */
function calculateSimilarity(s1, s2) {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) {
        return 1.0;
    }

    const editDistance = levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 *
 * @param {string} s1 - First string
 * @param {string} s2 - Second string
 * @returns {number} Edit distance
 */
function levenshteinDistance(s1, s2) {
    const costs = [];

    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) {
            costs[s2.length] = lastValue;
        }
    }

    return costs[s2.length];
}

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
}

/**
 * Generate geometric grid of neighborhoods (fallback)
 *
 * Creates 9 neighborhoods in a 3x3 grid pattern:
 * - Centro (center)
 * - 4 cardinal directions (Norte, Sul, Leste, Oeste)
 * - 4 diagonal directions (Nordeste, Noroeste, Sudeste, Sudoeste)
 *
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Array} Array of grid neighborhoods
 */
function generateGridNeighborhoods(lat, lng, radiusKm) {
    // Approximate conversion: 1 degree ≈ 111 km at equator
    const offset = radiusKm / 111;

    const directions = [
        { name: 'Centro', lat: 0, lng: 0, radius: 3000 },
        { name: 'Norte', lat: offset, lng: 0, radius: 5000 },
        { name: 'Sul', lat: -offset, lng: 0, radius: 5000 },
        { name: 'Leste', lat: 0, lng: offset, radius: 5000 },
        { name: 'Oeste', lat: 0, lng: -offset, radius: 5000 },
        { name: 'Nordeste', lat: offset/2, lng: offset/2, radius: 4000 },
        { name: 'Noroeste', lat: offset/2, lng: -offset/2, radius: 4000 },
        { name: 'Sudeste', lat: -offset/2, lng: offset/2, radius: 4000 },
        { name: 'Sudoeste', lat: -offset/2, lng: -offset/2, radius: 4000 }
    ];

    return directions.map(d => ({
        name: d.name,
        center_lat: lat + d.lat,
        center_lng: lng + d.lng,
        radius: d.radius,
        source: 'grid_fallback'
    }));
}

/**
 * ============================================================================
 * Main Handler
 * ============================================================================
 */

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
        const { cityId } = JSON.parse(event.body);

        if (!cityId || typeof cityId !== 'number') {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid city ID provided'
                }),
            };
        }

        console.log(`[Discover Neighborhoods] Fetching city with ID: ${cityId}`);

        // Get city information
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
                    success: false,
                    error: 'City not found'
                }),
            };
        }

        const city = cityResult[0];
        console.log(`[Discover Neighborhoods] City: ${city.name}, ${city.state}, ${city.country}`);

        if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
            return {
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Google Maps API key not configured'
                }),
            };
        }

        // ====================================================================
        // LANGUAGE DETECTION & LOCALIZED SEARCH
        // ====================================================================

        // Detect country code from city.country field (e.g., "Brasil" → "BR")
        const countryCode = normalizeCountryCode(city.country || 'Brasil');
        console.log(`[Discover Neighborhoods] Country code: ${countryCode}`);

        // Get language info for this city (handles regional languages like Catalan)
        const languageInfo = getLanguageForCity(city.name, countryCode);

        // Log language detection for monitoring
        logLanguageDetection(city.name, countryCode, 'static_map');

        // Generate localized search query
        const query = getLocalizedNeighborhoodQuery(
            city.name,
            city.state,
            countryCode
        );
        console.log(`[Discover Neighborhoods] Localized search query: "${query}"`);
        console.log(`[Discover Neighborhoods] Language: ${languageInfo.full} (${languageInfo.primary})`);
        console.log(`[Discover Neighborhoods] Terminology: ${getNeighborhoodTerminology(countryCode)}`);

        // Build Google Places API parameters with proper localization
        const placesParams = buildGooglePlacesParams(query, countryCode);

        // Collect all results with pagination support
        let allResults = [];
        let nextPageToken = null;
        let pageCount = 0;
        const MAX_PAGES = 3; // Google typically allows up to 3 pages (60 results)

        do {
            pageCount++;
            console.log(`[Discover Neighborhoods] Fetching page ${pageCount}${nextPageToken ? ' (with token)' : ''}...`);

            const params = new URLSearchParams({
                query: placesParams.query,
                key: GOOGLE_API_KEY,
                language: placesParams.language, // Localized (e.g., "pt-BR", "en-US", "ja-JP")
                region: placesParams.region      // Country code (e.g., "br", "us", "jp")
            });

            // Add pagetoken if this is not the first page
            if (nextPageToken) {
                params.set('pagetoken', nextPageToken);
            }

            const url = `${GOOGLE_PLACES_TEXT_SEARCH_URL}?${params.toString()}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Google Places API error: ${response.status}`);
            }

            const data = await response.json();

            if (data.status === 'INVALID_REQUEST' && nextPageToken) {
                console.log(`[Discover Neighborhoods] Invalid page token, stopping pagination`);
                break;
            }

            if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
                throw new Error(`Google Places API returned status: ${data.status}`);
            }

            if (data.results && data.results.length > 0) {
                console.log(`[Discover Neighborhoods] Page ${pageCount}: Found ${data.results.length} results`);
                allResults.push(...data.results);
            } else {
                console.log(`[Discover Neighborhoods] Page ${pageCount}: No results`);
            }

            // Check for next page token
            nextPageToken = data.next_page_token || null;

            // Google requires a short delay (2 seconds) before requesting next page
            if (nextPageToken && pageCount < MAX_PAGES) {
                console.log(`[Discover Neighborhoods] Waiting 2s for next page...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

        } while (nextPageToken && pageCount < MAX_PAGES);

        console.log(`[Discover Neighborhoods] ===== LAYER 1 COMPLETE: Google Places =====`);
        console.log(`[Discover Neighborhoods] Total results from ${pageCount} pages: ${allResults.length}`);

        // Log all types for debugging
        if (allResults.length > 0) {
            console.log(`[Discover Neighborhoods] Sample result types:`, allResults[0].types);
        }

        // Filter Google Places results - NEGATIVE filter (exclude clearly wrong types)
        // Accept most results except cities, countries, airports, etc.
        const excludedTypes = ['country', 'administrative_area_level_1', 'administrative_area_level_2',
                               'locality', 'political', 'airport', 'route', 'street_address'];

        const googleNeighborhoods = allResults
            .filter(result => {
                if (!result.types) return false;

                // Exclude if result is ONLY political or locality (these are usually cities)
                const onlyPoliticalOrLocality = result.types.length <= 2 &&
                    result.types.every(t => t === 'political' || t === 'locality');
                if (onlyPoliticalOrLocality) return false;

                // Exclude if it has any of the excluded types as PRIMARY type
                const primaryType = result.types[0];
                if (excludedTypes.includes(primaryType)) {
                    console.log(`[Discover Neighborhoods] Filtering out "${result.name}" - primary type: ${primaryType}`);
                    return false;
                }

                return true; // Accept everything else
            })
            .map(result => ({
                name: result.name,
                center_lat: result.geometry.location.lat,
                center_lng: result.geometry.location.lng,
                radius: calculateRadius(result.types),
                source: 'google_places',
                types: result.types // Keep for debugging
            }));

        console.log(`[Discover Neighborhoods] Layer 1: ${googleNeighborhoods.length} neighborhoods from Google (${allResults.length - googleNeighborhoods.length} filtered out)`);

        // ====================================================================
        // MULTI-LAYER NEIGHBORHOOD DISCOVERY
        // ====================================================================

        let allDiscoveredNeighborhoods = [...googleNeighborhoods];
        const layerStats = {
            google: googleNeighborhoods.length,
            osm: 0,
            nominatim: 0,
            opencage: 0,
            grid: 0
        };

        // ====================================================================
        // LAYER 2: OSM Overpass (if Google found <20 neighborhoods)
        // ====================================================================
        if (allDiscoveredNeighborhoods.length < 20) {
            console.log(`\n[Discover Neighborhoods] ===== LAYER 2: OSM Overpass =====`);
            console.log(`[Discover Neighborhoods] Google found ${allDiscoveredNeighborhoods.length} < 20, searching OSM...`);

            try {
                const osmResults = await queryOverpassNeighborhoods(city.name, countryCode);

                console.log(`[Discover Neighborhoods] OSM returned ${osmResults.length} results, filtering by distance...`);

                // CONSERVATIVE: Filter to only neighborhoods within 30km of city center
                // (prevents including entire regions)
                const cityLat = parseFloat(city.center_lat);
                const cityLng = parseFloat(city.center_lng);
                const MAX_DISTANCE_KM = 30; // Conservative radius for city neighborhoods

                const osmNeighborhoods = osmResults
                    .filter(osm => {
                        const distance = calculateDistance(cityLat, cityLng, osm.lat, osm.lon) / 1000; // Convert to km
                        return distance <= MAX_DISTANCE_KM;
                    })
                    .map(osm => ({
                        name: osm.name,
                        center_lat: osm.lat,
                        center_lng: osm.lon,
                        radius: 3000, // Default 3km radius
                        source: 'osm_overpass'
                    }));

                console.log(`[Discover Neighborhoods] After distance filter (<=${MAX_DISTANCE_KM}km): ${osmNeighborhoods.length} neighborhoods`);

                // Deduplicate against existing
                const uniqueOSM = deduplicateNeighborhoods(allDiscoveredNeighborhoods, osmNeighborhoods);
                allDiscoveredNeighborhoods.push(...uniqueOSM);
                layerStats.osm = uniqueOSM.length;

                console.log(`[Discover Neighborhoods] Layer 2: +${uniqueOSM.length} unique OSM neighborhoods (${osmNeighborhoods.length} after filtering)`);
            } catch (err) {
                console.warn(`[Discover Neighborhoods] Layer 2 failed:`, err.message);
            }
        } else {
            console.log(`[Discover Neighborhoods] Skipping Layer 2 (OSM) - already have ${allDiscoveredNeighborhoods.length} neighborhoods`);
        }

        // ====================================================================
        // LAYER 3: Nominatim Admin Boundaries (if still <15 neighborhoods)
        // ====================================================================
        if (allDiscoveredNeighborhoods.length < 15) {
            console.log(`\n[Discover Neighborhoods] ===== LAYER 3: Nominatim Admin Boundaries =====`);
            console.log(`[Discover Neighborhoods] Have ${allDiscoveredNeighborhoods.length} < 15, searching admin boundaries...`);

            try {
                const nominatimResults = await searchAdminBoundaries(city.name, countryCode);

                // Convert Nominatim format to our format
                const nominatimNeighborhoods = nominatimResults.map(nom => ({
                    name: nom.name,
                    center_lat: nom.lat,
                    center_lng: nom.lon,
                    radius: 4000, // Default 4km radius for admin boundaries
                    source: 'nominatim_admin'
                }));

                // Deduplicate against existing
                const uniqueNominatim = deduplicateNeighborhoods(allDiscoveredNeighborhoods, nominatimNeighborhoods);
                allDiscoveredNeighborhoods.push(...uniqueNominatim);
                layerStats.nominatim = uniqueNominatim.length;

                console.log(`[Discover Neighborhoods] Layer 3: +${uniqueNominatim.length} unique Nominatim neighborhoods (${nominatimResults.length} total found)`);
            } catch (err) {
                console.warn(`[Discover Neighborhoods] Layer 3 failed:`, err.message);
            }
        } else {
            console.log(`[Discover Neighborhoods] Skipping Layer 3 (Nominatim) - already have ${allDiscoveredNeighborhoods.length} neighborhoods`);
        }

        // ====================================================================
        // LAYER 4: OpenCage Grid Search (for cities with <5 neighborhoods)
        // ====================================================================
        const shouldUseOpenCage = allDiscoveredNeighborhoods.length < 5;

        if (shouldUseOpenCage) {
            console.log(`\n[Discover Neighborhoods] ===== LAYER 4: OpenCage Grid Search =====`);
            console.log(`[Discover Neighborhoods] City has only ${allDiscoveredNeighborhoods.length} neighborhoods, using OpenCage...`);

            try {
                const opencageResults = await discoverNeighborhoodsGrid(
                    parseFloat(city.center_lat),
                    parseFloat(city.center_lng),
                    5 // 5km radius
                );

                // Convert OpenCage format to our format
                const opencageNeighborhoods = opencageResults.map(oc => ({
                    name: oc.name,
                    center_lat: oc.lat,
                    center_lng: oc.lon,
                    radius: 3500, // Default 3.5km radius
                    source: 'opencage'
                }));

                // Deduplicate against existing
                const uniqueOpenCage = deduplicateNeighborhoods(allDiscoveredNeighborhoods, opencageNeighborhoods);
                allDiscoveredNeighborhoods.push(...uniqueOpenCage);
                layerStats.opencage = uniqueOpenCage.length;

                console.log(`[Discover Neighborhoods] Layer 4: +${uniqueOpenCage.length} unique OpenCage neighborhoods (${opencageResults.length} total found)`);
            } catch (err) {
                console.warn(`[Discover Neighborhoods] Layer 4 failed:`, err.message);
            }
        } else {
            console.log(`[Discover Neighborhoods] Skipping Layer 4 (OpenCage) - already have ${allDiscoveredNeighborhoods.length} neighborhoods (threshold: <5)`);
        }

        // ====================================================================
        // LAYER 5: Grid Fallback (if still 0 neighborhoods)
        // ====================================================================
        if (allDiscoveredNeighborhoods.length === 0) {
            console.log(`\n[Discover Neighborhoods] ===== LAYER 5: Grid Fallback =====`);
            console.log(`[Discover Neighborhoods] All layers returned 0 results, generating geometric grid...`);

            const gridNeighborhoods = generateGridNeighborhoods(
                parseFloat(city.center_lat),
                parseFloat(city.center_lng),
                10 // 10km radius
            );

            allDiscoveredNeighborhoods = gridNeighborhoods;
            layerStats.grid = gridNeighborhoods.length;

            console.log(`[Discover Neighborhoods] Layer 5: Generated ${gridNeighborhoods.length} grid neighborhoods`);
        }

        console.log(`\n[Discover Neighborhoods] ===== MULTI-LAYER DISCOVERY COMPLETE =====`);
        console.log(`[Discover Neighborhoods] Total neighborhoods discovered: ${allDiscoveredNeighborhoods.length}`);
        console.log(`[Discover Neighborhoods] Sources breakdown:`, layerStats);

        // Now use allDiscoveredNeighborhoods instead of neighborhoodResults
        const neighborhoodResults = allDiscoveredNeighborhoods;

        // ====================================================================
        // Insert neighborhoods into database
        // ====================================================================
        console.log(`\n[Discover Neighborhoods] ===== INSERTING INTO DATABASE =====`);
        const insertedNeighborhoods = [];
        const errors = [];

        for (const neighborhood of neighborhoodResults) {
            try {
                const neighborhoodName = neighborhood.name;
                const lat = neighborhood.center_lat;
                const lng = neighborhood.center_lng;
                const radius = neighborhood.radius;
                const source = neighborhood.source;

                console.log(`[Discover Neighborhoods] Adding: ${neighborhoodName} (${lat}, ${lng}, ${radius}m) [${source}]`);

                const inserted = await sql`
                    INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
                    VALUES (${cityId}, ${neighborhoodName}, ${lat}, ${lng}, ${radius}, 0)
                    ON CONFLICT (city_id, name)
                    DO UPDATE SET
                        center_lat = EXCLUDED.center_lat,
                        center_lng = EXCLUDED.center_lng,
                        radius = EXCLUDED.radius
                    RETURNING id, name, center_lat, center_lng, radius, apuration_count
                `;

                insertedNeighborhoods.push({
                    id: inserted[0].id,
                    name: inserted[0].name,
                    center_lat: parseFloat(inserted[0].center_lat),
                    center_lng: parseFloat(inserted[0].center_lng),
                    radius: inserted[0].radius,
                    apuration_count: inserted[0].apuration_count,
                    next_limit: 666, // First apuration limit
                    source: source // Track which layer discovered this
                });

            } catch (error) {
                console.error(`[Discover Neighborhoods] Error adding ${neighborhood.name}:`, error.message);
                errors.push({
                    name: neighborhood.name,
                    error: error.message
                });
            }
        }

        // If no neighborhoods were successfully inserted, create a default one
        if (insertedNeighborhoods.length === 0) {
            let defaultNeighborhood = await sql`
                INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
                VALUES (${cityId}, 'Centro', ${city.center_lat}, ${city.center_lng}, 3000, 0)
                ON CONFLICT (city_id, name) DO NOTHING
                RETURNING id, name, center_lat, center_lng, radius, apuration_count
            `;

            // If INSERT didn't return anything (due to conflict), fetch the existing row
            if (defaultNeighborhood.length === 0) {
                console.log(`[Discover Neighborhoods] Centro already exists, fetching existing record`);
                defaultNeighborhood = await sql`
                    SELECT id, name, center_lat, center_lng, radius, apuration_count
                    FROM neighborhoods
                    WHERE city_id = ${cityId} AND name = 'Centro'
                    LIMIT 1
                `;
            }

            insertedNeighborhoods.push({
                id: defaultNeighborhood[0].id,
                name: defaultNeighborhood[0].name,
                center_lat: parseFloat(defaultNeighborhood[0].center_lat),
                center_lng: parseFloat(defaultNeighborhood[0].center_lng),
                radius: defaultNeighborhood[0].radius,
                apuration_count: defaultNeighborhood[0].apuration_count,
                next_limit: 666
            });
        }

        console.log(`[Discover Neighborhoods] ✓ Successfully added ${insertedNeighborhoods.length} neighborhoods`);

        // Localized success message
        const terminology = getNeighborhoodTerminology(countryCode, languageInfo.primary);
        const localizedMessage = languageInfo.primary === 'pt'
            ? `${insertedNeighborhoods.length} ${terminology}s descobertos para ${city.name}, ${city.state}`
            : languageInfo.primary === 'es'
            ? `${insertedNeighborhoods.length} ${terminology}s descubiertos para ${city.name}, ${city.state}`
            : `${insertedNeighborhoods.length} ${terminology}s discovered for ${city.name}, ${city.state}`;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                neighborhoods: insertedNeighborhoods,
                count: insertedNeighborhoods.length,
                message: localizedMessage,
                language: languageInfo.full,
                countryCode: countryCode,
                terminology: terminology,
                layerStats: layerStats, // Show breakdown by source
                errors: errors.length > 0 ? errors : undefined
            }),
        };

    } catch (error) {
        console.error('[Discover Neighborhoods] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Failed to discover neighborhoods',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
