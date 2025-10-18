/**
 * ============================================================================
 * Cleanup States - Database Maintenance Function
 * ============================================================================
 *
 * Deletes all states for a specific country to allow re-discovery.
 * Use this when state data is corrupted or needs to be refreshed.
 *
 * Endpoint: /.netlify/functions/cleanup-states
 * Method: POST
 *
 * Body:
 * {
 *   "countryCode": "SA",  // ISO 3166-1 alpha-2 country code
 *   "username": "admin",
 *   "password": "admin123"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "deletedCount": 31,
 *   "message": "31 states deleted for SA"
 * }
 */

import { neon } from '@netlify/neon';
import { verifyAdminCredentials } from './utils/admin-auth.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

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
        const { countryCode, username, password } = JSON.parse(event.body);

        // Authentication
        if (!verifyAdminCredentials(username, password)) {
            return {
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Authentication failed',
                    message: 'Invalid admin credentials'
                }),
            };
        }

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
        console.log(`\n[Cleanup States] Starting cleanup for ${normalizedCode}...`);

        // ====================================================================
        // Step 1: Count existing states
        // ====================================================================
        const existingStates = await sql`
            SELECT id, name, state_code, country_code
            FROM states
            WHERE country_code = ${normalizedCode}
        `;

        console.log(`[Cleanup States] Found ${existingStates.length} states to delete`);

        if (existingStates.length === 0) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    deletedCount: 0,
                    message: `No states found for ${normalizedCode}`,
                    details: 'Nothing to clean up'
                }),
            };
        }

        // Log what we're about to delete
        console.log('[Cleanup States] States to be deleted:');
        existingStates.forEach(state => {
            console.log(`  - ${state.name} (${state.state_code}) [ID: ${state.id}]`);
        });

        // ====================================================================
        // Step 2: Delete all states for this country
        // ====================================================================
        const deleteResult = await sql`
            DELETE FROM states
            WHERE country_code = ${normalizedCode}
        `;

        console.log(`[Cleanup States] ✓ Deleted ${existingStates.length} states for ${normalizedCode}`);

        // ====================================================================
        // Step 3: Return success response
        // ====================================================================
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                deletedCount: existingStates.length,
                deletedStates: existingStates.map(s => ({
                    name: s.name,
                    state_code: s.state_code
                })),
                message: `${existingStates.length} states deleted for ${normalizedCode}`,
                nextStep: `Run discover-states with countryCode: "${normalizedCode}" to populate correct data`
            }),
        };

    } catch (error) {
        console.error('[Cleanup States] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Failed to cleanup states',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
