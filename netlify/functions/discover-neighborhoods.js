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
        console.log(`[Discover Neighborhoods] City: ${city.name}, ${city.state}`);

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

        // Search for neighborhoods using Google Places Text Search
        const query = `bairros em ${city.name}, ${city.state}, Brasil`;
        console.log(`[Discover Neighborhoods] Searching: "${query}"`);

        const params = new URLSearchParams({
            query: query,
            key: GOOGLE_API_KEY,
            language: 'pt-BR',
            region: 'br'
        });

        const url = `${GOOGLE_PLACES_TEXT_SEARCH_URL}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Places API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.log(`[Discover Neighborhoods] No neighborhoods found for ${city.name}`);

            // Create a default central neighborhood
            const defaultNeighborhood = await sql`
                INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
                VALUES (${cityId}, 'Centro', ${city.center_lat}, ${city.center_lng}, 3000, 0)
                ON CONFLICT (city_id, name) DO NOTHING
                RETURNING id, name, center_lat, center_lng, radius, apuration_count
            `;

            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    neighborhoods: defaultNeighborhood,
                    count: 1,
                    message: `Nenhum bairro específico encontrado. Criado bairro "Centro" para ${city.name}.`,
                    isDefault: true
                }),
            };
        }

        console.log(`[Discover Neighborhoods] Found ${data.results.length} results from Google Places`);

        // Filter results to only include neighborhoods/sublocalities
        const neighborhoodResults = data.results.filter(result =>
            result.types &&
            (result.types.includes('neighborhood') ||
             result.types.includes('sublocality') ||
             result.types.includes('sublocality_level_1') ||
             result.types.includes('administrative_area_level_3'))
        );

        console.log(`[Discover Neighborhoods] ${neighborhoodResults.length} neighborhood-type results`);

        // Insert neighborhoods into database
        const insertedNeighborhoods = [];
        const errors = [];

        for (const result of neighborhoodResults) {
            try {
                const neighborhoodName = result.name;
                const lat = result.geometry.location.lat;
                const lng = result.geometry.location.lng;
                const radius = calculateRadius(result.types);

                console.log(`[Discover Neighborhoods] Adding: ${neighborhoodName} (${lat}, ${lng}, ${radius}m)`);

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
                    next_limit: 666 // First apuration limit
                });

            } catch (error) {
                console.error(`[Discover Neighborhoods] Error adding ${result.name}:`, error.message);
                errors.push({
                    name: result.name,
                    error: error.message
                });
            }
        }

        // If no neighborhoods were successfully inserted, create a default one
        if (insertedNeighborhoods.length === 0) {
            const defaultNeighborhood = await sql`
                INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius, apuration_count)
                VALUES (${cityId}, 'Centro', ${city.center_lat}, ${city.center_lng}, 3000, 0)
                ON CONFLICT (city_id, name) DO NOTHING
                RETURNING id, name, center_lat, center_lng, radius, apuration_count
            `;

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
                message: `${insertedNeighborhoods.length} bairros descobertos para ${city.name}, ${city.state}`,
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
