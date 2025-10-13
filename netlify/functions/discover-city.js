/**
 * ============================================================================
 * Discover City - Netlify Function
 * ============================================================================
 *
 * Discovers a city using Google Maps Geocoding API and adds it to the database.
 * This allows dynamic city addition without manual database population.
 *
 * Endpoint: /.netlify/functions/discover-city
 * Method: POST
 *
 * Body:
 * {
 *   "cityName": "Fortaleza",  // Can be any case, with or without accents
 *   "countryName": "Brasil"   // Optional, defaults to "Brasil"
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "city": {
 *     "id": 2,
 *     "name": "Fortaleza",
 *     "state": "Ceará",
 *     "country": "Brasil",
 *     "center_lat": -3.7319,
 *     "center_lng": -38.5267,
 *     "neighborhood_count": 0
 *   },
 *   "message": "City discovered and added to database"
 * }
 */

import { neon } from '@netlify/neon';

const sql = neon();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

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
        const { cityName, countryName = 'Brasil' } = JSON.parse(event.body);

        if (!cityName || typeof cityName !== 'string' || cityName.trim().length === 0) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid city name provided'
                }),
            };
        }

        console.log(`[Discover City] Searching for: "${cityName}" in "${countryName}"`);

        // First, check if city already exists in database (case-insensitive)
        const existingCity = await sql`
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
            WHERE LOWER(c.name) = LOWER(${cityName.trim()})
            GROUP BY c.id, c.name, c.state, c.country, c.center_lat, c.center_lng
            LIMIT 1
        `;

        if (existingCity.length > 0) {
            console.log(`[Discover City] City already exists: ${existingCity[0].name}`);
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                body: JSON.stringify({
                    success: true,
                    city: existingCity[0],
                    message: 'City already exists in database',
                    alreadyExists: true
                }),
            };
        }

        // City not in database - discover it using Google Maps API
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

        // Build geocoding request with country bias
        const countryCode = countryName === 'Brasil' ? 'BR' : countryName.substring(0, 2).toUpperCase();
        const params = new URLSearchParams({
            address: `${cityName.trim()}, ${countryName}`,
            key: GOOGLE_API_KEY,
            language: 'pt-BR',
            region: countryCode.toLowerCase(),
            ...(countryName === 'Brasil' && { components: `country:${countryCode}` })
        });

        const url = `${GOOGLE_GEOCODING_URL}?${params.toString()}`;
        console.log(`[Discover City] Querying Google Maps API...`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Maps API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            console.log(`[Discover City] City not found: ${cityName}`);
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'City not found',
                    message: `Não foi possível encontrar "${cityName}" em ${countryName}`
                }),
            };
        }

        // Find the first result that is a city (locality or administrative_area_level_2)
        const cityResult = data.results.find(result =>
            result.types.includes('locality') ||
            result.types.includes('administrative_area_level_2')
        ) || data.results[0];

        // Extract city information
        let cityNameFound = null;
        let stateName = null;
        let countryNameFound = countryName; // Use provided country name as default

        cityResult.address_components.forEach(component => {
            if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                cityNameFound = component.long_name;
            }
            if (component.types.includes('administrative_area_level_1')) {
                stateName = component.long_name;
            }
            if (component.types.includes('country')) {
                countryNameFound = component.long_name;
            }
        });

        if (!cityNameFound || !stateName) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Could not extract city information from Google Maps response'
                }),
            };
        }

        const centerLat = cityResult.geometry.location.lat;
        const centerLng = cityResult.geometry.location.lng;

        console.log(`[Discover City] Found: ${cityNameFound}, ${stateName}`);
        console.log(`[Discover City] Coordinates: ${centerLat}, ${centerLng}`);

        // Insert city into database
        const insertResult = await sql`
            INSERT INTO cities (name, state, country, center_lat, center_lng)
            VALUES (${cityNameFound}, ${stateName}, ${countryNameFound}, ${centerLat}, ${centerLng})
            ON CONFLICT (name, state, country)
            DO UPDATE SET
                center_lat = EXCLUDED.center_lat,
                center_lng = EXCLUDED.center_lng
            RETURNING id, name, state, country, center_lat, center_lng
        `;

        const newCity = insertResult[0];

        console.log(`[Discover City] ✓ City added to database with ID: ${newCity.id}`);

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                city: {
                    id: newCity.id,
                    name: newCity.name,
                    state: newCity.state,
                    country: newCity.country,
                    center_lat: parseFloat(newCity.center_lat),
                    center_lng: parseFloat(newCity.center_lng),
                    neighborhood_count: 0 // New city, no neighborhoods yet
                },
                message: `Cidade descoberta e adicionada: ${newCity.name}, ${newCity.state}`,
                alreadyExists: false
            }),
        };

    } catch (error) {
        console.error('[Discover City] Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Failed to discover city',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
