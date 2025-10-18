/**
 * ============================================================================
 * Get Countries - Netlify Function
 * ============================================================================
 *
 * Returns all available countries from the countries table for country filter.
 * Countries are sorted alphabetically by name.
 *
 * Endpoint: /.netlify/functions/get-countries
 * Method: GET
 *
 * Response:
 * [
 *   {
 *     "id": 1,
 *     "country_code": "BR",
 *     "name": "Brazil",
 *     "continent": "South America",
 *     "primary_language": "pt",
 *     "full_language_code": "pt-BR",
 *     "currency": "BRL",
 *     "distance_unit": "km",
 *     "city_count": 150
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
        console.log('[Get Countries] Fetching all countries...');

        // Get all countries with city counts
        const countries = await sql`
            SELECT
                c.id,
                c.country_code,
                c.name,
                c.continent,
                c.primary_language,
                c.full_language_code,
                c.currency,
                c.distance_unit,
                COUNT(DISTINCT ci.id) as city_count
            FROM countries c
            LEFT JOIN cities ci ON ci.country_code = c.country_code
            GROUP BY c.id, c.country_code, c.name, c.continent,
                     c.primary_language, c.full_language_code,
                     c.currency, c.distance_unit
            ORDER BY c.name
        `;

        console.log(`[Get Countries] Found ${countries.length} countries`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify(countries),
        };

    } catch (error) {
        console.error('[Get Countries] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch countries',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
