/**
 * ============================================================================
 * Reset Apuration Counts - Netlify Function
 * ============================================================================
 *
 * Resets neighborhood apuration counts back to 0 for a clean slate.
 * This allows neighborhoods to start fresh with the first apuration limit (666 stores).
 *
 * Features:
 * - Password-protected (admin only)
 * - Can reset all neighborhoods or just a specific city
 * - Returns count of neighborhoods reset
 * - Reusable for future resets
 *
 * Endpoint: /.netlify/functions/reset-apuration-counts
 * Method: POST
 * Body: {
 *   password: "your_admin_password",
 *   cityId: 1 (optional - if omitted, resets ALL neighborhoods)
 * }
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '123';

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
        const { password, cityId } = JSON.parse(event.body);

        // ========================================================================
        // STEP 1: Verify admin password
        // ========================================================================
        if (password !== ADMIN_PASSWORD) {
            console.log('[Reset Apuration] ❌ Invalid password attempt');
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Unauthorized',
                    message: 'Invalid admin password'
                }),
            };
        }

        console.log('[Reset Apuration] ✅ Admin authenticated');

        // ========================================================================
        // STEP 2: Reset apuration counts
        // ========================================================================
        let result;
        let cityInfo = null;

        if (cityId) {
            // Reset specific city
            console.log(`[Reset Apuration] Resetting apuration counts for city ID: ${cityId}`);

            // Get city info first
            const cityResult = await sql`
                SELECT id, name, state, country
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

            cityInfo = cityResult[0];

            // Reset neighborhoods for this city
            result = await sql`
                UPDATE neighborhoods
                SET
                    apuration_count = 0,
                    last_apuration_date = NULL
                WHERE city_id = ${cityId}
            `;

            console.log(`[Reset Apuration] Reset ${result.length} neighborhoods in ${cityInfo.name}, ${cityInfo.state}`);

        } else {
            // Reset ALL neighborhoods
            console.log('[Reset Apuration] Resetting apuration counts for ALL neighborhoods...');

            result = await sql`
                UPDATE neighborhoods
                SET
                    apuration_count = 0,
                    last_apuration_date = NULL
            `;

            console.log(`[Reset Apuration] Reset ${result.length} neighborhoods across all cities`);
        }

        const executionTime = Date.now() - startTime;

        // ========================================================================
        // STEP 3: Return success response
        // ========================================================================
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: cityId
                    ? `Apuration counts reset for ${cityInfo.name}, ${cityInfo.state}`
                    : 'Apuration counts reset for all neighborhoods',
                neighborhoods_reset: result.length,
                city: cityInfo ? {
                    id: cityInfo.id,
                    name: cityInfo.name,
                    state: cityInfo.state,
                    country: cityInfo.country
                } : null,
                execution_time_ms: executionTime
            }),
        };

    } catch (error) {
        console.error('[Reset Apuration] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Reset failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
