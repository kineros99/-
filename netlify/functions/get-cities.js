/**
 * ============================================================================
 * Get Cities - Netlify Function
 * ============================================================================
 *
 * Returns cities for scoped auto-population with optional filtering.
 * Cities are sorted alphabetically by name.
 *
 * Endpoint: /.netlify/functions/get-cities
 * Method: GET
 * Query Parameters (optional):
 *   - state: Filter by state name (e.g., 'Ceará', 'Rio de Janeiro')
 *   - country_code: Filter by country code (e.g., 'BR', 'US')
 *   - country: Filter by country name (e.g., 'Brazil', 'Brasil')
 *
 * Response:
 * [
 *   {
 *     "id": 1,
 *     "name": "Rio de Janeiro",
 *     "state": "Rio de Janeiro",
 *     "country": "Brasil",
 *     "country_code": "BR",
 *     "center_lat": -22.9068,
 *     "center_lng": -43.1729,
 *     "neighborhood_count": 27
 *   }
 * ]
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async (event) => {
    // Only allow GET requests
    if (event.httpMethod !== 'GET') {
        return {
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        const { state, country_code, country } = event.queryStringParameters || {};

        console.log('[Get Cities] Fetching cities with filters:', { state, country_code, country });

        // Build query with optional filters
        let cities;

        if (state) {
            // Filter by state
            console.log('[Get Cities] Filtering by state:', state);
            cities = await sql`
                SELECT
                    c.id,
                    c.name,
                    c.state,
                    c.country,
                    c.country_code,
                    c.center_lat,
                    c.center_lng,
                    COUNT(n.id) as neighborhood_count
                FROM cities c
                LEFT JOIN neighborhoods n ON n.city_id = c.id
                WHERE c.state = ${state}
                GROUP BY c.id, c.name, c.state, c.country, c.country_code, c.center_lat, c.center_lng
                ORDER BY c.name
            `;
        } else if (country_code) {
            // Filter by country code
            console.log('[Get Cities] Filtering by country_code:', country_code);
            cities = await sql`
                SELECT
                    c.id,
                    c.name,
                    c.state,
                    c.country,
                    c.country_code,
                    c.center_lat,
                    c.center_lng,
                    COUNT(n.id) as neighborhood_count
                FROM cities c
                LEFT JOIN neighborhoods n ON n.city_id = c.id
                WHERE c.country_code = ${country_code.toUpperCase()}
                GROUP BY c.id, c.name, c.state, c.country, c.country_code, c.center_lat, c.center_lng
                ORDER BY c.name
            `;
        } else if (country) {
            // Filter by country name
            console.log('[Get Cities] Filtering by country:', country);
            cities = await sql`
                SELECT
                    c.id,
                    c.name,
                    c.state,
                    c.country,
                    c.country_code,
                    c.center_lat,
                    c.center_lng,
                    COUNT(n.id) as neighborhood_count
                FROM cities c
                LEFT JOIN neighborhoods n ON n.city_id = c.id
                WHERE c.country = ${country} OR c.country ILIKE ${`%${country}%`}
                GROUP BY c.id, c.name, c.state, c.country, c.country_code, c.center_lat, c.center_lng
                ORDER BY c.name
            `;
        } else {
            // No filter - get all cities
            console.log('[Get Cities] No filter - fetching all cities');
            cities = await sql`
                SELECT
                    c.id,
                    c.name,
                    c.state,
                    c.country,
                    c.country_code,
                    c.center_lat,
                    c.center_lng,
                    COUNT(n.id) as neighborhood_count
                FROM cities c
                LEFT JOIN neighborhoods n ON n.city_id = c.id
                GROUP BY c.id, c.name, c.state, c.country, c.country_code, c.center_lat, c.center_lng
                ORDER BY c.name
            `;
        }

        console.log(`[Get Cities] Found ${cities.length} cities`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(cities),
        };

    } catch (error) {
        console.error('[Get Cities] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch cities',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
