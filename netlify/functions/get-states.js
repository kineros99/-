/**
 * ============================================================================
 * Get States - Netlify Function
 * ============================================================================
 *
 * Returns all states for a given country. For Brazil, returns all 27 states.
 * States are extracted from the cities table by grouping unique state values.
 *
 * Endpoint: /.netlify/functions/get-states
 * Method: GET
 * Query Parameters:
 *   - country_code: ISO 3166-1 alpha-2 country code (e.g., 'BR', 'US')
 *   - country: Country name (e.g., 'Brazil', 'Brasil') - fallback if code not provided
 *
 * Response:
 * [
 *   {
 *     "state": "Ceará",
 *     "state_code": "CE",
 *     "country": "Brasil",
 *     "country_code": "BR",
 *     "city_count": 25
 *   }
 * ]
 */

import { neon } from '@netlify/neon';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

// Complete mapping of Brazilian states with their official codes
const BRAZIL_STATE_CODES = {
    'Acre': 'AC',
    'Alagoas': 'AL',
    'Amapá': 'AP',
    'Amazonas': 'AM',
    'Bahia': 'BA',
    'Ceará': 'CE',
    'Distrito Federal': 'DF',
    'Espírito Santo': 'ES',
    'Goiás': 'GO',
    'Maranhão': 'MA',
    'Mato Grosso': 'MT',
    'Mato Grosso do Sul': 'MS',
    'Minas Gerais': 'MG',
    'Pará': 'PA',
    'Paraíba': 'PB',
    'Paraná': 'PR',
    'Pernambuco': 'PE',
    'Piauí': 'PI',
    'Rio de Janeiro': 'RJ',
    'Rio Grande do Norte': 'RN',
    'Rio Grande do Sul': 'RS',
    'Rondônia': 'RO',
    'Roraima': 'RR',
    'Santa Catarina': 'SC',
    'São Paulo': 'SP',
    'Sergipe': 'SE',
    'Tocantins': 'TO'
};

/**
 * Get state code from state name (works for Brazil and other countries)
 */
function getStateCode(stateName, countryCode) {
    if (countryCode === 'BR') {
        return BRAZIL_STATE_CODES[stateName] || stateName.substring(0, 2).toUpperCase();
    }
    // For other countries, return first 2 letters uppercase as fallback
    return stateName.substring(0, 2).toUpperCase();
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
        const { country_code, country } = event.queryStringParameters || {};

        if (!country_code && !country) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    error: 'Missing parameter',
                    message: 'Either country_code or country parameter is required'
                }),
            };
        }

        console.log('[Get States] Fetching states for country:', country_code || country);

        // ====================================================================
        // STEP 1: Try to get states from dedicated states table (NEW)
        // ====================================================================
        let states = [];
        const normalizedCode = country_code ? country_code.toUpperCase() : null;

        if (normalizedCode) {
            console.log('[Get States] Querying states table...');
            states = await sql`
                SELECT
                    s.id,
                    s.name as state,
                    s.state_code,
                    s.center_lat,
                    s.center_lng,
                    s.bounds_ne_lat,
                    s.bounds_ne_lng,
                    s.bounds_sw_lat,
                    s.bounds_sw_lng,
                    s.city_count,
                    s.population,
                    s.source,
                    c.country_code,
                    c.name as country
                FROM states s
                JOIN countries c ON c.country_code = s.country_code
                WHERE s.country_code = ${normalizedCode}
                ORDER BY s.name
            `;

            if (states.length > 0) {
                console.log(`[Get States] Found ${states.length} states in states table`);
            }
        }

        // ====================================================================
        // STEP 2: Fallback to cities table extraction (for backward compatibility)
        // ====================================================================
        if (states.length === 0) {
            console.log('[Get States] No states in states table, extracting from cities...');

            if (country_code) {
                states = await sql`
                    SELECT
                        state,
                        country,
                        country_code,
                        COUNT(DISTINCT id) as city_count,
                        MIN(center_lat) as min_lat,
                        MAX(center_lat) as max_lat,
                        MIN(center_lng) as min_lng,
                        MAX(center_lng) as max_lng
                    FROM cities
                    WHERE country_code = ${normalizedCode}
                        AND state IS NOT NULL
                        AND state != ''
                    GROUP BY state, country, country_code
                    ORDER BY state
                `;
            } else {
                // Fallback to country name matching
                states = await sql`
                    SELECT
                        state,
                        country,
                        country_code,
                        COUNT(DISTINCT id) as city_count,
                        MIN(center_lat) as min_lat,
                        MAX(center_lat) as max_lat,
                        MIN(center_lng) as min_lng,
                        MAX(center_lng) as max_lng
                    FROM cities
                    WHERE (country = ${country} OR country ILIKE ${`%${country}%`})
                        AND state IS NOT NULL
                        AND state != ''
                    GROUP BY state, country, country_code
                    ORDER BY state
                `;
            }

            // Enrich states extracted from cities with state codes
            states = states.map(state => ({
                state: state.state,
                state_code: getStateCode(state.state, state.country_code),
                country: state.country,
                country_code: state.country_code,
                city_count: parseInt(state.city_count),
                center_lat: ((parseFloat(state.min_lat) + parseFloat(state.max_lat)) / 2).toString(),
                center_lng: ((parseFloat(state.min_lng) + parseFloat(state.max_lng)) / 2).toString(),
                bounds_ne_lat: state.max_lat,
                bounds_ne_lng: state.max_lng,
                bounds_sw_lat: state.min_lat,
                bounds_sw_lng: state.min_lng,
                source: 'cities_extraction'
            }));

            console.log(`[Get States] Extracted ${states.length} states from cities table`);
        }

        // ====================================================================
        // STEP 3: Format response
        // ====================================================================
        const formattedStates = states.map(state => ({
            id: state.id || null,
            state: state.state,
            state_code: state.state_code || getStateCode(state.state, state.country_code),
            country: state.country,
            country_code: state.country_code,
            city_count: parseInt(state.city_count || 0),
            center_lat: parseFloat(state.center_lat),
            center_lng: parseFloat(state.center_lng),
            bounds: state.bounds_ne_lat ? {
                ne_lat: parseFloat(state.bounds_ne_lat),
                ne_lng: parseFloat(state.bounds_ne_lng),
                sw_lat: parseFloat(state.bounds_sw_lat),
                sw_lng: parseFloat(state.bounds_sw_lng)
            } : null,
            population: state.population || null,
            source: state.source || 'cities_extraction'
        }));

        console.log(`[Get States] Returning ${formattedStates.length} states`);

        // Special validation for Brazil - should have 27 states
        if ((country_code === 'BR' || country === 'Brazil' || country === 'Brasil') && formattedStates.length > 0) {
            console.log(`[Get States] Brazil validation: Found ${formattedStates.length} states (expected 27)`);
            if (formattedStates.length < 27) {
                console.warn(`[Get States] ⚠️  Brazil has only ${formattedStates.length}/27 states in database`);
                console.warn(`[Get States] 💡 Tip: Run discover-states function to discover all Brazilian states`);
            }
        }

        // Add metadata about discovery option
        const needsDiscovery = formattedStates.length === 0 && normalizedCode;

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                states: formattedStates,
                count: formattedStates.length,
                needsDiscovery: needsDiscovery,
                discoveryHint: needsDiscovery
                    ? `No states found. Use discover-states function to populate.`
                    : null
            }),
        };

    } catch (error) {
        console.error('[Get States] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                error: 'Failed to fetch states',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
