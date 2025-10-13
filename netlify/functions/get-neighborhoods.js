/**
 * ============================================================================
 * Get Neighborhoods - Netlify Function
 * ============================================================================
 *
 * Returns neighborhoods for a specific city with apuration statistics.
 * Includes information about how many times each neighborhood has been
 * apurated and what the next store limit will be.
 *
 * Endpoint: /.netlify/functions/get-neighborhoods?city_id=1
 * Method: GET
 *
 * Query Parameters:
 * - city_id (required): The ID of the city
 *
 * Response:
 * [
 *   {
 *     "id": 1,
 *     "city_id": 1,
 *     "name": "Copacabana",
 *     "center_lat": -22.9711,
 *     "center_lng": -43.1822,
 *     "radius": 3000,
 *     "apuration_count": 0,
 *     "last_apuration_date": null,
 *     "next_limit": 666
 *   }
 * ]
 */

import { neon } from '@netlify/neon';

const sql = neon();

/**
 * Calculate the store limit based on apuration count
 */
function calculateStoreLimit(apurationCount) {
    if (apurationCount === 0) return 666;   // First run
    if (apurationCount >= 1 && apurationCount <= 5) return 20;  // 2nd-6th runs
    if (apurationCount >= 6) return 18;     // 7th+ runs
    return 666; // Default fallback
}

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
        const cityId = event.queryStringParameters?.city_id;

        if (!cityId) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing required parameter',
                    message: 'city_id is required',
                    example: '/.netlify/functions/get-neighborhoods?city_id=1'
                }),
            };
        }

        console.log(`[Get Neighborhoods] Fetching neighborhoods for city ID: ${cityId}`);

        // Get all neighborhoods for the city
        const neighborhoods = await sql`
            SELECT
                id,
                city_id,
                name,
                center_lat,
                center_lng,
                radius,
                apuration_count,
                last_apuration_date,
                created_at
            FROM neighborhoods
            WHERE city_id = ${parseInt(cityId)}
            ORDER BY name
        `;

        // Calculate next limit for each neighborhood
        const neighborhoodsWithLimits = neighborhoods.map(n => ({
            ...n,
            next_limit: calculateStoreLimit(n.apuration_count)
        }));

        console.log(`[Get Neighborhoods] Found ${neighborhoods.length} neighborhoods`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(neighborhoodsWithLimits),
        };

    } catch (error) {
        console.error('[Get Neighborhoods] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch neighborhoods',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
