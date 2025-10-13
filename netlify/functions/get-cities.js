/**
 * ============================================================================
 * Get Cities - Netlify Function
 * ============================================================================
 *
 * Returns all available cities for scoped auto-population.
 * Cities are sorted alphabetically by name.
 *
 * Endpoint: /.netlify/functions/get-cities
 * Method: GET
 *
 * Response:
 * [
 *   {
 *     "id": 1,
 *     "name": "Rio de Janeiro",
 *     "state": "Rio de Janeiro",
 *     "country": "Brasil",
 *     "center_lat": -22.9068,
 *     "center_lng": -43.1729,
 *     "neighborhood_count": 27
 *   }
 * ]
 */

import { neon } from '@netlify/neon';

const sql = neon();

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
        console.log('[Get Cities] Fetching all cities...');

        // Get all cities with neighborhood counts
        const cities = await sql`
            SELECT
                c.id,
                c.name,
                c.state,
                c.country,
                c.center_lat,
                c.center_lng,
                COUNT(n.id) as neighborhood_count
            FROM cities c
            LEFT JOIN neighborhoods n ON n.city_id = c.id
            GROUP BY c.id, c.name, c.state, c.country, c.center_lat, c.center_lng
            ORDER BY c.name
        `;

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
