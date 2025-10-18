/**
 * ============================================================================
 * GeoNames API Integration - Phase 3
 * ============================================================================
 *
 * Integrates with GeoNames API for authoritative country/language data
 * Rate limits: 1,000 requests/hour (free tier)
 *
 * API Documentation: http://www.geonames.org/export/web-services.html
 * Endpoint: http://api.geonames.org/countryInfoJSON
 *
 * Prerequisites:
 * - GEONAMES_USERNAME environment variable set
 */

const GEONAMES_USERNAME = process.env.GEONAMES_USERNAME || 'kineros';
const GEONAMES_API_BASE = 'http://api.geonames.org';

// Rate limiting state
let requestCount = 0;
let requestWindow = Date.now();
const MAX_REQUESTS_PER_HOUR = 1000;
const HOUR_IN_MS = 3600000;

/**
 * ============================================================================
 * Rate Limiter
 * ============================================================================
 */

export class GeoNamesRateLimiter {
    constructor() {
        this.requests = [];
        this.maxPerHour = MAX_REQUESTS_PER_HOUR;
    }

    canMakeRequest() {
        const now = Date.now();
        const hourAgo = now - HOUR_IN_MS;

        // Remove old requests outside the window
        this.requests = this.requests.filter(time => time > hourAgo);

        if (this.requests.length >= this.maxPerHour) {
            const oldestRequest = this.requests[0];
            const waitTime = HOUR_IN_MS - (now - oldestRequest);
            return {
                allowed: false,
                waitTime: Math.ceil(waitTime / 1000), // seconds
                currentCount: this.requests.length
            };
        }

        return {
            allowed: true,
            currentCount: this.requests.length,
            remaining: this.maxPerHour - this.requests.length
        };
    }

    recordRequest() {
        this.requests.push(Date.now());
    }

    getStats() {
        const now = Date.now();
        const hourAgo = now - HOUR_IN_MS;
        this.requests = this.requests.filter(time => time > hourAgo);

        return {
            requestsInLastHour: this.requests.length,
            remaining: this.maxPerHour - this.requests.length,
            percentUsed: ((this.requests.length / this.maxPerHour) * 100).toFixed(2)
        };
    }
}

const rateLimiter = new GeoNamesRateLimiter();

/**
 * ============================================================================
 * API Functions
 * ============================================================================
 */

/**
 * Fetch country info from GeoNames
 * @param {string} countryCode - Optional ISO 3166-1 alpha-2 code (e.g., "BR")
 * @returns {Promise<object>} Country data
 */
export async function fetchCountryInfo(countryCode = null) {
    // Check rate limit
    const rateCheck = rateLimiter.canMakeRequest();
    if (!rateCheck.allowed) {
        throw new Error(
            `GeoNames rate limit exceeded. ` +
            `Wait ${rateCheck.waitTime} seconds. ` +
            `(${rateCheck.currentCount}/${MAX_REQUESTS_PER_HOUR} requests used)`
        );
    }

    // Build URL
    const url = countryCode
        ? `${GEONAMES_API_BASE}/countryInfoJSON?country=${countryCode}&username=${GEONAMES_USERNAME}`
        : `${GEONAMES_API_BASE}/countryInfoJSON?username=${GEONAMES_USERNAME}`;

    console.log(`[GeoNames] Fetching: ${url}`);

    try {
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`GeoNames API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Record successful request
        rateLimiter.recordRequest();

        // Check for API errors
        if (data.status && data.status.message) {
            throw new Error(`GeoNames API error: ${data.status.message}`);
        }

        return data;

    } catch (error) {
        console.error('[GeoNames] Error:', error.message);
        throw error;
    }
}

/**
 * Parse GeoNames country data to our format
 * @param {object} geonamesCountry - Raw GeoNames country object
 * @returns {object} Normalized country data
 */
export function parseGeoNamesCountry(geonamesCountry) {
    // Parse languages (e.g., "pt-BR,es,en,fr" → ["pt-BR", "es", "en", "fr"])
    const languageList = geonamesCountry.languages
        ? geonamesCountry.languages.split(',').map(l => l.trim())
        : [];

    const primaryLanguage = languageList[0] || 'en';
    const languageCode = primaryLanguage.split('-')[0]; // "pt-BR" → "pt"

    return {
        countryCode: geonamesCountry.countryCode,
        name: geonamesCountry.countryName,
        continent: geonamesCountry.continentName,
        capital: geonamesCountry.capital,
        languages: {
            raw: geonamesCountry.languages,
            list: languageList,
            primary: languageCode,
            primaryFull: primaryLanguage
        },
        currency: geonamesCountry.currencyCode,
        population: parseInt(geonamesCountry.population) || 0,
        areaSqKm: parseFloat(geonamesCountry.areaInSqKm) || 0,
        bounds: {
            north: parseFloat(geonamesCountry.north),
            south: parseFloat(geonamesCountry.south),
            east: parseFloat(geonamesCountry.east),
            west: parseFloat(geonamesCountry.west)
        },
        isoAlpha3: geonamesCountry.isoAlpha3,
        isoNumeric: geonamesCountry.isoNumeric,
        geonameId: geonamesCountry.geonameId,
        dataSource: 'geonames',
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Fetch and parse country data
 * @param {string} countryCode - ISO country code
 * @returns {Promise<object>} Parsed country data
 */
export async function getCountryData(countryCode) {
    console.log(`[GeoNames] Getting data for ${countryCode}`);

    const data = await fetchCountryInfo(countryCode);

    if (!data.geonames || data.geonames.length === 0) {
        throw new Error(`No data found for country code: ${countryCode}`);
    }

    const country = parseGeoNamesCountry(data.geonames[0]);

    console.log(`[GeoNames] ✓ Retrieved: ${country.name} (${country.countryCode})`);
    console.log(`[GeoNames]   Languages: ${country.languages.raw}`);
    console.log(`[GeoNames]   Currency: ${country.currency}`);

    return country;
}

/**
 * Fetch all countries
 * @returns {Promise<array>} Array of parsed country data
 */
export async function getAllCountries() {
    console.log(`[GeoNames] Fetching all countries...`);

    const data = await fetchCountryInfo();

    if (!data.geonames || data.geonames.length === 0) {
        throw new Error('No countries returned from GeoNames');
    }

    const countries = data.geonames.map(parseGeoNamesCountry);

    console.log(`[GeoNames] ✓ Retrieved ${countries.length} countries`);

    return countries;
}

/**
 * ============================================================================
 * Batch Update Functions
 * ============================================================================
 */

/**
 * Update database cache with GeoNames data
 * @param {object} sql - Neon SQL client
 * @param {string} countryCode - Optional specific country to update
 * @returns {Promise<object>} Update statistics
 */
export async function updateDatabaseCache(sql, countryCode = null) {
    console.log(`[GeoNames] Updating database cache${countryCode ? ` for ${countryCode}` : ''}...`);

    const startTime = Date.now();
    let updated = 0;
    let errors = [];

    try {
        const countries = countryCode
            ? [await getCountryData(countryCode)]
            : await getAllCountries();

        for (const country of countries) {
            try {
                // Check if we already have static map data
                const existing = await sql`
                    SELECT country_code, data_source
                    FROM countries
                    WHERE country_code = ${country.countryCode}
                    LIMIT 1
                `;

                // Only update if from geonames or doesn't exist
                // Don't override static_map with geonames (static is curated)
                if (existing.length === 0 || existing[0].data_source === 'geonames') {
                    await sql`
                        INSERT INTO countries (
                            country_code,
                            name,
                            continent,
                            primary_language,
                            full_language_code,
                            alternative_languages,
                            currency,
                            data_source,
                            last_updated
                        ) VALUES (
                            ${country.countryCode},
                            ${country.name},
                            ${country.continent},
                            ${country.languages.primary},
                            ${country.languages.primaryFull},
                            ${JSON.stringify(country.languages.list.slice(1))},
                            ${country.currency},
                            'geonames',
                            NOW()
                        )
                        ON CONFLICT (country_code)
                        DO UPDATE SET
                            name = EXCLUDED.name,
                            continent = EXCLUDED.continent,
                            currency = EXCLUDED.currency,
                            data_source = 'geonames',
                            last_updated = NOW()
                        WHERE countries.data_source != 'static_map'
                    `;

                    updated++;
                    console.log(`[GeoNames] ✓ Updated ${country.countryCode}`);
                }

            } catch (error) {
                console.error(`[GeoNames] ✗ Error updating ${country.countryCode}:`, error.message);
                errors.push({ code: country.countryCode, error: error.message });
            }
        }

        const duration = Date.now() - startTime;

        return {
            success: true,
            updated,
            errors: errors.length,
            duration: `${(duration / 1000).toFixed(2)}s`,
            rateLimit: rateLimiter.getStats()
        };

    } catch (error) {
        console.error('[GeoNames] Batch update failed:', error.message);
        return {
            success: false,
            error: error.message,
            updated,
            errors: errors.length
        };
    }
}

/**
 * ============================================================================
 * Health Check
 * ============================================================================
 */

/**
 * Test GeoNames API connectivity
 * @returns {Promise<object>} Health status
 */
export async function healthCheck() {
    const startTime = Date.now();

    try {
        // Try to fetch a simple country
        await getCountryData('BR');

        const duration = Date.now() - startTime;

        return {
            status: 'healthy',
            latency: `${duration}ms`,
            username: GEONAMES_USERNAME,
            rateLimit: rateLimiter.getStats()
        };

    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            username: GEONAMES_USERNAME
        };
    }
}

/**
 * ============================================================================
 * Export Summary
 * ============================================================================
 */

export default {
    // Main functions
    fetchCountryInfo,
    getCountryData,
    getAllCountries,

    // Database functions
    updateDatabaseCache,

    // Utilities
    healthCheck,
    rateLimiter,
    parseGeoNamesCountry,

    // Constants
    MAX_REQUESTS_PER_HOUR,
    GEONAMES_API_BASE
};
