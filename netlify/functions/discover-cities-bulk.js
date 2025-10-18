/**
 * ============================================================================
 * Discover Cities Bulk - Netlify Function
 * ============================================================================
 *
 * Discovers ALL cities for a country or state using Geonames API.
 * Handles batch processing, rate limiting, and progress tracking.
 *
 * Endpoint: /.netlify/functions/discover-cities-bulk
 * Method: POST
 *
 * Body:
 * {
 *   "countryCode": "AR",         // Required: ISO 3166-1 alpha-2
 *   "stateFilter": "Buenos Aires", // Optional: specific state name
 *   "populationMin": 1000,       // Optional: minimum population (default: 1000)
 *   "maxCities": null,           // Optional: limit total cities (null = all)
 *   "batchSize": 100,            // Optional: cities per batch (default: 100)
 *   "startOffset": 0             // Optional: resume from offset (default: 0)
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "citiesDiscovered": 1250,
 *   "citiesAdded": 1200,
 *   "citiesDuplicate": 50,
 *   "statesProcessed": ["Buenos Aires", "Córdoba", ...],
 *   "timeElapsed": "45.2s",
 *   "hasMore": false,
 *   "nextOffset": null,
 *   "rateLimitStatus": {...}
 * }
 */

import { neon } from '@netlify/neon';
import { GeoNamesRateLimiter } from './utils/geonames-integration.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);
const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'kineros';
const GEONAMES_API_BASE = 'http://api.geonames.org';

// Rate limiter instance
const rateLimiter = new GeoNamesRateLimiter();

// Geonames feature codes for cities/populated places
const CITY_FEATURE_CODES = [
    'PPL',    // populated place
    'PPLA',   // seat of a first-order administrative division
    'PPLA2',  // seat of a second-order administrative division
    'PPLA3',  // seat of a third-order administrative division
    'PPLA4',  // seat of a fourth-order administrative division
    'PPLC',   // capital of a political entity
    'PPLG',   // seat of government
    'PPLL',   // populated locality
    'PPLR',   // religious populated place
    'PPLS',   // populated places
    'PPLX'    // section of populated place
];

/**
 * Delay execution (for rate limiting)
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch cities from Geonames for a specific country
 */
async function fetchCitiesFromGeonames(countryCode, populationMin, maxRows = 1000, startRow = 0) {
    // Check rate limit
    const rateCheck = rateLimiter.canMakeRequest();
    if (!rateCheck.allowed) {
        const waitMs = rateCheck.waitTime * 1000;
        console.log(`[Discover Cities Bulk] Rate limit reached. Waiting ${rateCheck.waitTime}s...`);
        await delay(waitMs);
    }

    const params = new URLSearchParams({
        country: countryCode,
        featureClass: 'P', // P = city, village, etc. (populated place)
        maxRows: maxRows.toString(),
        startRow: startRow.toString(),
        orderby: 'population', // Largest cities first
        username: GEONAMES_USERNAME,
        style: 'FULL' // Get all details including admin divisions
    });

    const url = `${GEONAMES_API_BASE}/searchJSON?${params.toString()}`;

    console.log(`[Discover Cities Bulk] Fetching cities from Geonames...`);
    console.log(`[Discover Cities Bulk]   Country: ${countryCode}`);
    console.log(`[Discover Cities Bulk]   Population min: ${populationMin}`);
    console.log(`[Discover Cities Bulk]   Rows: ${maxRows}, Start: ${startRow}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Geonames API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Record successful request
        rateLimiter.recordRequest();

        // Check for API errors
        if (data.status && data.status.message) {
            throw new Error(`Geonames API error: ${data.status.message}`);
        }

        // Filter by population
        const cities = (data.geonames || []).filter(city => {
            const pop = parseInt(city.population) || 0;
            return pop >= populationMin;
        });

        console.log(`[Discover Cities Bulk] Found ${cities.length} cities (total in response: ${data.totalResultsCount || 'unknown'})`);

        return {
            cities: cities,
            totalResults: data.totalResultsCount || cities.length,
            hasMore: data.geonames && data.geonames.length >= maxRows
        };

    } catch (error) {
        console.error('[Discover Cities Bulk] Geonames API error:', error.message);
        throw error;
    }
}

/**
 * Parse Geonames city data to our format
 */
function parseGeonamesCity(geonamesCity, countryName, countryCode) {
    return {
        name: geonamesCity.name,
        state: geonamesCity.adminName1 || null, // State/province name
        state_code: geonamesCity.adminCode1 || null,
        country: countryName,
        country_code: countryCode,
        center_lat: parseFloat(geonamesCity.lat),
        center_lng: parseFloat(geonamesCity.lng),
        population: parseInt(geonamesCity.population) || 0,
        geonames_id: geonamesCity.geonameId,
        feature_code: geonamesCity.fcode,
        source: 'geonames_bulk'
    };
}

/**
 * Insert city into database
 */
async function insertCity(city) {
    try {
        const result = await sql`
            INSERT INTO cities (
                name,
                state,
                country,
                country_code,
                center_lat,
                center_lng
            ) VALUES (
                ${city.name},
                ${city.state},
                ${city.country},
                ${city.country_code},
                ${city.center_lat},
                ${city.center_lng}
            )
            ON CONFLICT (name, state, country)
            DO UPDATE SET
                center_lat = EXCLUDED.center_lat,
                center_lng = EXCLUDED.center_lng
            RETURNING id, name, state, country
        `;

        return {
            success: true,
            city: result[0],
            isNew: true // We can't easily determine if it was new or updated with ON CONFLICT
        };

    } catch (error) {
        return {
            success: false,
            error: error.message,
            city: city
        };
    }
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

    const startTime = Date.now();

    try {
        const {
            countryCode,
            stateFilter = null,
            populationMin = 1000,
            maxCities = null,
            batchSize = 50,
            startOffset = 0
        } = JSON.parse(event.body);

        // Validate inputs
        if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Invalid country code. Must be a 2-letter ISO code (e.g., "AR", "BR")'
                }),
            };
        }

        const normalizedCode = countryCode.toUpperCase();

        console.log('\n[Discover Cities Bulk] ===============================================');
        console.log('[Discover Cities Bulk] STARTING BULK CITY DISCOVERY');
        console.log('[Discover Cities Bulk] ===============================================');
        console.log(`[Discover Cities Bulk] Country: ${normalizedCode}`);
        console.log(`[Discover Cities Bulk] State Filter: ${stateFilter || 'None (all states)'}`);
        console.log(`[Discover Cities Bulk] Population Min: ${populationMin}`);
        console.log(`[Discover Cities Bulk] Max Cities: ${maxCities || 'Unlimited'}`);
        console.log(`[Discover Cities Bulk] Batch Size: ${batchSize}`);
        console.log(`[Discover Cities Bulk] Start Offset: ${startOffset}`);
        console.log('[Discover Cities Bulk] ===============================================\n');

        // ====================================================================
        // Step 1: Get country information
        // ====================================================================
        console.log('[Discover Cities Bulk] Step 1: Getting country information...');

        const countryResult = await sql`
            SELECT country_code, name
            FROM countries
            WHERE country_code = ${normalizedCode}
            LIMIT 1
        `;

        if (countryResult.length === 0) {
            return {
                statusCode: 404,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    error: 'Country not found',
                    message: `Country code ${normalizedCode} not found in database`
                }),
            };
        }

        const country = countryResult[0];
        console.log(`[Discover Cities Bulk] ✓ Country: ${country.name} (${country.country_code})`);

        // ====================================================================
        // Step 2: Fetch cities from Geonames (with pagination)
        // ====================================================================
        console.log('\n[Discover Cities Bulk] Step 2: Fetching cities from Geonames...');

        let allCities = [];
        let currentOffset = startOffset;
        let hasMore = true;
        let pageCount = 0;
        const maxPages = maxCities ? Math.ceil(maxCities / batchSize) : 2; // Safe default of 2 pages to prevent timeout

        while (hasMore && pageCount < maxPages) {
            pageCount++;

            console.log(`\n[Discover Cities Bulk] Page ${pageCount}...`);

            const result = await fetchCitiesFromGeonames(
                normalizedCode,
                populationMin,
                batchSize,
                currentOffset
            );

            const parsedCities = result.cities.map(city =>
                parseGeonamesCity(city, country.name, normalizedCode)
            );

            // Filter by state if requested
            const filteredCities = stateFilter
                ? parsedCities.filter(city => city.state === stateFilter)
                : parsedCities;

            console.log(`[Discover Cities Bulk] Parsed ${filteredCities.length} cities for this page`);

            allCities.push(...filteredCities);

            // Check if we should continue
            hasMore = result.hasMore && filteredCities.length > 0;
            currentOffset += batchSize;

            // Check if we've reached maxCities limit
            if (maxCities && allCities.length >= maxCities) {
                console.log(`[Discover Cities Bulk] Reached maxCities limit (${maxCities})`);
                allCities = allCities.slice(0, maxCities);
                hasMore = false;
            }

            // Add delay between pages to respect rate limits (2 seconds = safe for 1000/hour)
            if (hasMore) {
                console.log('[Discover Cities Bulk] Waiting 2s before next page...');
                await delay(2000);
            }
        }

        console.log(`\n[Discover Cities Bulk] ✓ Fetched ${allCities.length} cities from ${pageCount} pages`);

        // ====================================================================
        // Step 3: Insert cities into database
        // ====================================================================
        console.log('\n[Discover Cities Bulk] Step 3: Inserting cities into database...');

        const insertResults = [];
        const errors = [];
        const statesProcessed = new Set();

        // Process cities in batches of 50
        for (let i = 0; i < allCities.length; i += 50) {
            const batch = allCities.slice(i, Math.min(i + 50, allCities.length));

            console.log(`[Discover Cities Bulk] Processing batch ${i/50 + 1}: ${batch.length} cities`);
            console.log(`[Discover Cities Bulk] Progress: ${i + batch.length}/${allCities.length} (${((i + batch.length) / allCities.length * 100).toFixed(1)}%)`);

            try {
                // Bulk insert using one SQL query with multiple values
                const results = await sql`
                    INSERT INTO cities (
                        name, state, country, country_code, center_lat, center_lng
                    ) VALUES ${sql(batch.map(city => [
                        city.name,
                        city.state,
                        city.country,
                        city.country_code,
                        city.center_lat,
                        city.center_lng
                    ]))}
                    ON CONFLICT (name, state, country)
                    DO UPDATE SET
                        center_lat = EXCLUDED.center_lat,
                        center_lng = EXCLUDED.center_lng
                    RETURNING id, name, state, country
                `;

                // Add successfully inserted/updated cities
                insertResults.push(...results);

                // Track states processed
                batch.forEach(city => {
                    if (city.state) {
                        statesProcessed.add(city.state);
                    }
                });

            } catch (error) {
                console.error(`[Discover Cities Bulk] Batch insert error:`, error);

                // Fall back to individual inserts if bulk insert fails
                for (const city of batch) {
                    const result = await insertCity(city);

                    if (result.success) {
                        insertResults.push(result.city);
                        if (city.state) {
                            statesProcessed.add(city.state);
                        }
                    } else {
                        errors.push({
                            city: city.name,
                            error: result.error
                        });
                    }
                }
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n[Discover Cities Bulk] ===============================================');
        console.log('[Discover Cities Bulk] ✅ BULK DISCOVERY COMPLETE');
        console.log('[Discover Cities Bulk] ===============================================');
        console.log(`[Discover Cities Bulk] Cities discovered: ${allCities.length}`);
        console.log(`[Discover Cities Bulk] Cities saved: ${insertResults.length}`);
        console.log(`[Discover Cities Bulk] Errors: ${errors.length}`);
        console.log(`[Discover Cities Bulk] States processed: ${statesProcessed.size}`);
        console.log(`[Discover Cities Bulk] Time elapsed: ${duration}s`);
        console.log(`[Discover Cities Bulk] Has more: ${hasMore}`);
        console.log(`[Discover Cities Bulk] Next offset: ${hasMore ? currentOffset : 'N/A'}`);
        console.log('[Discover Cities Bulk] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                citiesDiscovered: allCities.length,
                citiesAdded: insertResults.length,
                citiesDuplicate: allCities.length - insertResults.length,
                statesProcessed: Array.from(statesProcessed).sort(),
                stateCount: statesProcessed.size,
                timeElapsed: `${duration}s`,
                hasMore: hasMore,
                nextOffset: hasMore ? currentOffset : null,
                errors: errors.length > 0 ? errors : undefined,
                rateLimitStatus: rateLimiter.getStats(),
                sampleCities: insertResults.slice(0, 10).map(c => `${c.name}, ${c.state}`)
            }),
        };

    } catch (error) {
        console.error('[Discover Cities Bulk] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Failed to discover cities',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
