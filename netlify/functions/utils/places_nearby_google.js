/**
 * ============================================================================
 * Google Places API - Nearby Search for Rio de Janeiro Stores
 * ============================================================================
 *
 * This module searches for construction material stores in Rio de Janeiro
 * using Google Places API Nearby Search.
 *
 * Features:
 * - Searches by location (latitude/longitude + radius)
 * - Filters by place types (hardware stores, home goods stores)
 * - Returns max 20 places per API call
 * - Prevents duplicate API calls by checking existing Place IDs
 *
 * Pricing:
 * - Nearby Search (Basic): $32 per 1000 requests
 * - Fields: name, location, formatted_address, place_id, business_status
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const PLACES_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

/**
 * Rio de Janeiro search zones
 * Covers all major neighborhoods in a grid pattern
 */
const RIO_SEARCH_ZONES = [
    // Zona Sul - smaller, denser neighborhoods
    { name: 'Copacabana', lat: -22.9711, lng: -43.1822, radius: 3000 },
    { name: 'Ipanema', lat: -22.9838, lng: -43.2044, radius: 2000 },
    { name: 'Leblon', lat: -22.9842, lng: -43.2200, radius: 2000 },
    { name: 'Botafogo', lat: -22.9519, lng: -43.1825, radius: 3000 },
    { name: 'Flamengo', lat: -22.9297, lng: -43.1760, radius: 2500 },
    { name: 'Laranjeiras', lat: -22.9350, lng: -43.1875, radius: 2000 },
    { name: 'Gávea', lat: -22.9803, lng: -43.2315, radius: 2500 },

    // Zona Norte - medium to large neighborhoods
    { name: 'Tijuca', lat: -22.9209, lng: -43.2328, radius: 4000 },
    { name: 'Vila Isabel', lat: -22.9158, lng: -43.2468, radius: 2500 },
    { name: 'Méier', lat: -22.9029, lng: -43.2781, radius: 3000 },
    { name: 'Madureira', lat: -22.8713, lng: -43.3376, radius: 3500 },
    { name: 'Penha', lat: -22.8398, lng: -43.2823, radius: 3000 },
    { name: 'Ramos', lat: -22.8391, lng: -43.2489, radius: 2500 },
    { name: 'Olaria', lat: -22.8431, lng: -43.2677, radius: 2000 },

    // Zona Oeste - larger, spread out neighborhoods
    { name: 'Barra da Tijuca', lat: -23.0045, lng: -43.3646, radius: 5000 },
    { name: 'Recreio', lat: -23.0170, lng: -43.4639, radius: 4000 },
    { name: 'Jacarepaguá', lat: -22.9373, lng: -43.3697, radius: 4000 },
    { name: 'Campo Grande', lat: -22.9009, lng: -43.5617, radius: 5000 },
    { name: 'Bangu', lat: -22.8705, lng: -43.4654, radius: 4000 },
    { name: 'Realengo', lat: -22.8814, lng: -43.4301, radius: 3000 },

    // Centro - dense urban area
    { name: 'Centro', lat: -22.9099, lng: -43.1763, radius: 3000 },
    { name: 'Lapa', lat: -22.9130, lng: -43.1799, radius: 2000 },
    { name: 'Santa Teresa', lat: -22.9209, lng: -43.1886, radius: 2500 },
    { name: 'São Cristóvão', lat: -22.8991, lng: -43.2236, radius: 2500 },

    // Additional zones
    { name: 'Ilha do Governador', lat: -22.8147, lng: -43.2073, radius: 4000 },
    { name: 'Pavuna', lat: -22.8107, lng: -43.3530, radius: 3000 },
    { name: 'Santa Cruz', lat: -22.9166, lng: -43.6926, radius: 5000 },
];

/**
 * Detect store category based on name and types
 * Categories: paint, lumber, plumbing, hardware, general, unknown
 */
function detectStoreCategory(storeName, storeTypes = []) {
    const name = storeName.toLowerCase();

    // Paint stores (Tintas)
    const paintKeywords = ['tinta', 'paint', 'pintura', 'verniz', 'esmalte', 'sherwin', 'coral', 'suvinil'];
    if (paintKeywords.some(keyword => name.includes(keyword))) {
        return 'paint';
    }

    // Lumber/Wood stores (Madeira)
    const lumberKeywords = ['madeira', 'lumber', 'wood', 'compensado', 'mdf', 'marcenaria', 'serralheria'];
    if (lumberKeywords.some(keyword => name.includes(keyword))) {
        return 'lumber';
    }

    // Plumbing stores (Hidráulica)
    const plumbingKeywords = ['hidraulica', 'hidráulica', 'plumbing', 'encanamento', 'tubos', 'cano', 'tigre', 'amanco'];
    if (plumbingKeywords.some(keyword => name.includes(keyword))) {
        return 'plumbing';
    }

    // Hardware/Tools stores (Ferragens)
    const hardwareKeywords = ['ferragem', 'ferramenta', 'hardware', 'tool', 'parafuso', 'prego'];
    if (hardwareKeywords.some(keyword => name.includes(keyword))) {
        return 'hardware';
    }

    // General construction stores (Geral)
    const generalKeywords = ['material', 'construção', 'construcao', 'building', 'construction', 'depot', 'telhanorte', 'leroy'];
    if (generalKeywords.some(keyword => name.includes(keyword))) {
        return 'general';
    }

    // Check if store types indicate it's a hardware/home improvement store
    if (storeTypes.includes('hardware_store') || storeTypes.includes('home_improvement_store')) {
        return 'general';
    }

    // Default: unknown
    return 'unknown';
}

/**
 * Map country names to ISO codes and language codes
 */
function getCountryConfig(countryName) {
    const normalized = countryName.toLowerCase().trim();

    // Country mappings
    const countryMap = {
        'brasil': { code: 'BR', language: 'pt-BR' },
        'brazil': { code: 'BR', language: 'pt-BR' },
        'united states': { code: 'US', language: 'en-US' },
        'united states of america': { code: 'US', language: 'en-US' },
        'usa': { code: 'US', language: 'en-US' },
        'us': { code: 'US', language: 'en-US' },
        'argentina': { code: 'AR', language: 'es-AR' },
        'mexico': { code: 'MX', language: 'es-MX' },
        'peru': { code: 'PE', language: 'es-PE' },
        'colombia': { code: 'CO', language: 'es-CO' },
        'chile': { code: 'CL', language: 'es-CL' },
        'portugal': { code: 'PT', language: 'pt-PT' },
        'spain': { code: 'ES', language: 'es-ES' },
        'españa': { code: 'ES', language: 'es-ES' }
    };

    return countryMap[normalized] || { code: 'BR', language: 'pt-BR' }; // Default to Brazil
}

/**
 * Get search keywords for construction stores by country
 * Returns array of search terms in the local language
 */
function getSearchKeywords(countryName) {
    const normalized = countryName.toLowerCase().trim();

    const keywordMap = {
        // Brasil - TOP 3 most effective terms (optimized for speed + timeout prevention)
        'brasil': [
            'material de construção',      // #1 Most common, covers general stores
            'loja de ferragem',             // #2 Hardware stores
            'depósito de construção'        // #3 Large suppliers
        ],
        'brazil': [
            'material de construção',
            'loja de ferragem',
            'depósito de construção'
        ],
        // USA - TOP 3 most effective terms
        'united states': [
            'hardware store',
            'building materials store',
            'home improvement store'
        ],
        'united states of america': [
            'hardware store',
            'building materials store',
            'home improvement store'
        ],
        'usa': [
            'hardware store',
            'building materials store',
            'home improvement store'
        ],
        'us': [
            'hardware store',
            'building materials store',
            'home improvement store'
        ],
        // Argentina - TOP 3 most effective terms
        'argentina': [
            'corralón',
            'ferretería',
            'materiales de construcción'
        ],
        // Mexico - TOP 3 most effective terms
        'mexico': [
            'tlapalería',
            'ferretería',
            'materiales para construcción'
        ],
        // Spain - TOP 3 most effective terms
        'spain': [
            'ferretería',
            'materiales de construcción',
            'almacén de construcción'
        ],
        'españa': [
            'ferretería',
            'materiales de construcción',
            'almacén de construcción'
        ],
        // Colombia, Peru, Chile (generic Spanish) - TOP 3 most effective terms
        'colombia': [
            'ferretería',
            'materiales de construcción',
            'depósito de materiales'
        ],
        'peru': [
            'ferretería',
            'materiales de construcción',
            'depósito de materiales'
        ],
        'chile': [
            'ferretería',
            'materiales de construcción',
            'depósito de materiales'
        ],
        // Portugal - TOP 3 most effective terms
        'portugal': [
            'loja de ferragens',
            'materiais de construção',
            'depósito de materiais'
        ]
    };

    // Default to Brasil keywords
    return keywordMap[normalized] || keywordMap['brasil'];
}

/**
 * Search for stores using Text Search API with location bias
 * This allows keyword-based search in local language (e.g., "loja de ferragem")
 */
async function searchTextNearby(latitude, longitude, radius, textQuery, maxResults, languageCode, regionCode) {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing'
        };
    }

    try {
        console.log(`[Text Search] Searching "${textQuery}" near [${latitude}, ${longitude}] radius ${radius}m`);

        const response = await fetch(PLACES_TEXT_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.types'
            },
            body: JSON.stringify({
                textQuery: textQuery,
                maxResultCount: maxResults,
                locationBias: {
                    circle: {
                        center: {
                            latitude: latitude,
                            longitude: longitude
                        },
                        radius: radius
                    }
                },
                languageCode: languageCode,
                regionCode: regionCode
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Text Search] ❌ HTTP error: ${response.status} - ${errorText}`);
            console.error(`[Text Search] Query: "${textQuery}" at [${latitude}, ${longitude}]`);
            console.error(`[Text Search] Request body:`, JSON.stringify({
                textQuery,
                maxResultCount: maxResults,
                locationBias: { circle: { center: { latitude, longitude }, radius } },
                languageCode,
                regionCode
            }));

            // Check for common API errors
            if (response.status === 403) {
                console.error(`[Text Search] 🚫 API KEY ERROR: Places API (New) may not be enabled or key is invalid`);
            } else if (response.status === 429) {
                console.error(`[Text Search] ⏱️  RATE LIMIT: Too many requests. Quota may be exceeded.`);
            } else if (response.status === 400) {
                console.error(`[Text Search] ⚠️  BAD REQUEST: The string did not match the expected pattern - check coordinate format`);
            }

            return {
                success: false,
                error: 'Text search failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                details: errorText,
                httpStatus: response.status
            };
        }

        let data;
        try {
            data = await response.json();
        } catch (parseError) {
            console.error(`[Text Search] ❌ Failed to parse JSON response:`, parseError.message);
            console.error(`[Text Search] Response was not valid JSON - API may be returning error HTML`);
            return {
                success: false,
                error: 'Invalid JSON response',
                message: 'API returned non-JSON response (possibly HTML error page)',
                details: parseError.toString()
            };
        }

        // Enhanced logging for debugging
        if (!data.places || data.places.length === 0) {
            console.log(`[Text Search] ⚠️  No results for "${textQuery}"`);
            console.log(`[Text Search] Location: [${latitude}, ${longitude}], Radius: ${radius}m`);
            console.log(`[Text Search] Language: ${languageCode}, Region: ${regionCode}`);

            // Check if API returned an error status
            if (data.error) {
                console.error(`[Text Search] ❌ API Error:`, data.error);
                return {
                    success: false,
                    error: 'Google API error',
                    message: data.error.message || 'Unknown API error',
                    details: JSON.stringify(data.error),
                    found: 0,
                    stores: []
                };
            }

            return {
                success: true,
                found: 0,
                stores: [],
                noResults: true
            };
        }

        // Format the results (same format as searchNearby)
        const stores = data.places.map(place => {
            const storeName = place.displayName?.text || 'Sem nome';
            const storeTypes = place.types || [];
            const storeCategory = detectStoreCategory(storeName, storeTypes);

            return {
                google_place_id: place.id.replace('places/', ''), // Remove prefix
                nome: storeName,
                endereco: place.formattedAddress || '',
                telefone: place.nationalPhoneNumber || null,
                website: place.websiteUri || null,
                latitude: place.location?.latitude || null,
                longitude: place.location?.longitude || null,
                business_status: place.businessStatus || 'UNKNOWN',
                types: storeTypes,
                categoria: 'Material de Construção',
                store_category: storeCategory
            };
        });

        console.log(`[Text Search] ✓ Found ${stores.length} stores for "${textQuery}"`);

        return {
            success: true,
            found: stores.length,
            stores: stores
        };

    } catch (error) {
        console.error(`[Text Search] Error searching "${textQuery}":`, error);
        return {
            success: false,
            error: 'Text search failed',
            message: error.message,
            details: error.toString()
        };
    }
}

/**
 * Multi-keyword hybrid search - GUARANTEED comprehensive results
 * Searches using multiple local keywords (e.g., "loja de ferragem", "material de construção")
 * Combines results and removes duplicates
 */
async function searchByKeywordsAndLocation(latitude, longitude, radius, maxResults, countryName) {
    const countryConfig = getCountryConfig(countryName);
    const keywords = getSearchKeywords(countryName);

    console.log(`[Keyword Search] Starting multi-keyword search for ${countryName}`);
    console.log(`[Keyword Search] ${keywords.length} keywords to search (optimized for speed)`);
    console.log(`[Keyword Search] Target: ${maxResults} total results`);

    const allStores = [];
    const seenPlaceIds = new Set();
    let totalApiCalls = 0;
    const errors = [];
    let noResultsCount = 0;

    // Calculate results per keyword (distribute evenly, with minimum of 3 per keyword)
    const resultsPerKeyword = Math.max(3, Math.ceil(maxResults / keywords.length));

    for (const keyword of keywords) {
        // Stop if we already have enough results
        if (allStores.length >= maxResults) {
            console.log(`[Keyword Search] Reached target of ${maxResults} stores`);
            break;
        }

        const result = await searchTextNearby(
            latitude,
            longitude,
            radius,
            keyword,
            resultsPerKeyword,
            countryConfig.language,
            countryConfig.code
        );

        totalApiCalls++;

        if (!result.success) {
            console.warn(`[Keyword Search] ❌ Failed to search "${keyword}": ${result.message}`);
            errors.push({
                keyword: keyword,
                error: result.message,
                httpStatus: result.httpStatus,
                details: result.details
            });
            // Continue to try other keywords even if one fails
            continue;
        }

        if (result.found === 0) {
            noResultsCount++;
            console.log(`[Keyword Search] "${keyword}": 0 results`);
            continue;
        }

        // Filter out duplicates by google_place_id
        const newStores = result.stores.filter(store => {
            if (seenPlaceIds.has(store.google_place_id)) {
                return false;
            }
            seenPlaceIds.add(store.google_place_id);
            return true;
        });

        allStores.push(...newStores);
        console.log(`[Keyword Search] "${keyword}": ${result.found} found, ${newStores.length} new (total: ${allStores.length})`);

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Trim to maxResults if we have more
    const finalStores = allStores.slice(0, maxResults);

    console.log(`[Keyword Search] ✅ Complete: ${finalStores.length} unique stores from ${totalApiCalls} API calls`);
    console.log(`[Keyword Search] No results: ${noResultsCount}/${keywords.length} keywords`);
    if (errors.length > 0) {
        console.error(`[Keyword Search] ⚠️  ${errors.length} API errors occurred`);
        errors.forEach(err => {
            console.error(`[Keyword Search]   - "${err.keyword}": ${err.error} (HTTP ${err.httpStatus || 'N/A'})`);
        });
    }
    console.log(`[Keyword Search] Estimated cost: $${(totalApiCalls * 0.032).toFixed(4)}`);

    // If ALL keywords failed or returned 0 results, provide diagnostic info
    if (finalStores.length === 0 && totalApiCalls > 0) {
        console.error(`[Keyword Search] 🚨 DIAGNOSTIC: All ${totalApiCalls} API calls returned 0 stores`);
        console.error(`[Keyword Search] Location: [${latitude}, ${longitude}], Radius: ${radius}m`);
        console.error(`[Keyword Search] Country: ${countryName} (${countryConfig.code}/${countryConfig.language})`);

        if (errors.length > 0) {
            console.error(`[Keyword Search] Possible cause: API errors - ${errors[0].error}`);
        } else if (noResultsCount === keywords.length) {
            console.error(`[Keyword Search] Possible cause: No stores in this area, or coordinates are invalid`);
        }
    }

    return {
        success: true,
        found: finalStores.length,
        stores: finalStores,
        metadata: {
            keywords_searched: totalApiCalls,
            keywords_with_no_results: noResultsCount,
            keywords_with_errors: errors.length,
            duplicates_removed: allStores.length - finalStores.length,
            api_calls: totalApiCalls,
            estimated_cost: (totalApiCalls * 0.032).toFixed(4),
            errors: errors.length > 0 ? errors : undefined
        }
    };
}

/**
 * Search for nearby stores in a specific location
 * NOW USES KEYWORD-BASED TEXT SEARCH for comprehensive, guaranteed results!
 * Searches ALL local terms: "loja de ferragem", "material de construção", "loja de tintas", etc.
 */
export async function searchNearbyStores(latitude, longitude, radius = 3000, maxResults = 20, countryName = 'Brasil') {
    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing'
        };
    }

    try {
        console.log(`[Nearby Search] 🔍 KEYWORD-BASED SEARCH at [${latitude}, ${longitude}] radius ${radius}m in ${countryName}`);

        // Use the new keyword-based search instead of type-based search
        const result = await searchByKeywordsAndLocation(
            latitude,
            longitude,
            radius,
            maxResults,
            countryName
        );

        return result;

    } catch (error) {
        console.error('[Nearby Search] Error:', error);
        return {
            success: false,
            error: 'Search failed',
            message: error.message,
            details: error.toString()
        };
    }
}

/**
 * Search all zones (generic function that works with any city/country)
 * Returns stores from multiple zones up to maxStores limit
 *
 * @param {number} maxStores - Maximum number of stores to return
 * @param {Array} existingPlaceIds - Place IDs already in database (for duplicate prevention)
 * @param {Array} zones - Custom zones to search (if not provided, uses Rio zones)
 * @param {string} countryName - Country name for language/region settings
 * @param {number} maxNeighborhoods - Maximum neighborhoods to search (for timeout prevention, default: 3)
 */
export async function searchAllZones(maxStores = 111, existingPlaceIds = [], zones = null, countryName = 'Brasil', maxNeighborhoods = 3) {
    // Use provided zones or fall back to Rio zones for backward compatibility
    const searchZones = zones || RIO_SEARCH_ZONES;

    const allStores = [];
    let apiCallsUsed = 0;
    let storesSkipped = 0;
    let zonesSearched = 0;

    console.log(`[Zone Search] Starting search across ${searchZones.length} zones in ${countryName}`);
    console.log(`[Zone Search] Max stores: ${maxStores}`);
    console.log(`[Zone Search] Max neighborhoods: ${maxNeighborhoods}`);
    console.log(`[Zone Search] Existing Place IDs to skip: ${existingPlaceIds.length}`);

    for (const zone of searchZones) {
        zonesSearched++;

        // Check both store limit and neighborhood limit
        if (allStores.length >= maxStores) {
            console.log(`[Zone Search] Reached max stores limit (${maxStores})`);
            break;
        }

        if (zonesSearched > maxNeighborhoods) {
            console.log(`[Zone Search] Reached max neighborhoods limit (${maxNeighborhoods})`);
            console.log(`[Zone Search] This prevents function timeout. Run again to continue.`);
            break;
        }

        const remainingSlots = maxStores - allStores.length;
        const maxResultsForThisZone = Math.min(20, remainingSlots);

        // Handle zone format from database (center_lat/center_lng) or legacy format (lat/lng)
        const lat = zone.center_lat || zone.lat;
        const lng = zone.center_lng || zone.lng;
        const radius = zone.radius || 3000;
        const name = zone.name;

        console.log(`\n[Zone Search] Searching ${name} (${lat}, ${lng})`);
        console.log(`[Zone Search] Requesting ${maxResultsForThisZone} stores...`);

        const result = await searchNearbyStores(
            parseFloat(lat),
            parseFloat(lng),
            radius,
            maxResultsForThisZone,
            countryName
        );

        // CRITICAL FIX: Track actual API calls made (keyword search makes multiple calls)
        const actualApiCalls = result.metadata?.api_calls || 1;
        apiCallsUsed += actualApiCalls;
        console.log(`[Zone Search] API calls for ${name}: ${actualApiCalls} (total so far: ${apiCallsUsed})`);

        if (!result.success) {
            console.error(`[Zone Search] ⚠️  Failed to search ${name}: ${result.message}`);
            if (result.metadata?.errors && result.metadata.errors.length > 0) {
                console.error(`[Zone Search] First error: ${result.metadata.errors[0].error}`);
            }
            continue;
        }

        if (result.found === 0) {
            console.log(`[Zone Search] No stores found in ${name}`);
            if (result.metadata?.keywords_with_no_results) {
                console.log(`[Zone Search] ${result.metadata.keywords_with_no_results} keywords returned 0 results`);
            }
            if (result.metadata?.keywords_with_errors) {
                console.warn(`[Zone Search] ${result.metadata.keywords_with_errors} keywords had errors`);
            }
            continue;
        }

        // Filter out duplicates (already in database)
        const newStores = result.stores.filter(store => {
            const isDuplicate = existingPlaceIds.includes(store.google_place_id);
            if (isDuplicate) {
                storesSkipped++;
            }
            return !isDuplicate;
        });

        console.log(`[Zone Search] ${name}: Found ${result.found}, New: ${newStores.length}, Skipped: ${result.found - newStores.length}`);

        // Add bairro/neighborhood to stores
        newStores.forEach(store => {
            store.bairro = name;
        });

        allStores.push(...newStores.slice(0, remainingSlots));

        // Small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const remainingNeighborhoods = searchZones.length - zonesSearched;
    const hitNeighborhoodLimit = zonesSearched >= maxNeighborhoods && remainingNeighborhoods > 0;

    console.log(`\n[Zone Search] ✅ Search complete`);
    console.log(`[Zone Search] Neighborhoods searched: ${zonesSearched}/${searchZones.length}`);
    if (remainingNeighborhoods > 0) {
        console.log(`[Zone Search] ⚠️  ${remainingNeighborhoods} neighborhoods not searched (run again to continue)`);
    }
    console.log(`[Zone Search] Total stores found: ${allStores.length}`);
    console.log(`[Zone Search] Stores skipped (duplicates): ${storesSkipped}`);
    console.log(`[Zone Search] Total API calls used: ${apiCallsUsed}`);
    console.log(`[Zone Search] Avg API calls per neighborhood: ${zonesSearched > 0 ? (apiCallsUsed / zonesSearched).toFixed(1) : 0}`);
    console.log(`[Zone Search] Estimated cost: $${(apiCallsUsed * 0.032).toFixed(4)}`);

    // Warning if 0 stores found
    if (allStores.length === 0 && apiCallsUsed > 0) {
        console.error(`\n[Zone Search] 🚨 WARNING: 0 stores found after ${apiCallsUsed} API calls!`);
        console.error(`[Zone Search] This suggests an issue with:`);
        console.error(`[Zone Search]   1. Google API key configuration (Places API New not enabled?)`);
        console.error(`[Zone Search]   2. API quota/rate limits exceeded`);
        console.error(`[Zone Search]   3. Invalid coordinates for neighborhoods`);
        console.error(`[Zone Search]   4. No stores exist in this country/region`);
        console.error(`[Zone Search]   5. Search keywords don't match local terminology`);
    }

    return {
        success: true,
        stores: allStores,
        statistics: {
            zonesSearched: zonesSearched,
            totalZones: searchZones.length,
            remainingZones: remainingNeighborhoods,
            hitNeighborhoodLimit: hitNeighborhoodLimit,
            storesFound: allStores.length,
            storesSkipped: storesSkipped,
            apiCallsUsed: apiCallsUsed,
            avgApiCallsPerZone: zonesSearched > 0 ? parseFloat((apiCallsUsed / zonesSearched).toFixed(1)) : 0,
            estimatedCost: (apiCallsUsed * 0.032).toFixed(4) // $0.032 per call
        }
    };
}

/**
 * Search all Rio de Janeiro zones (backward compatibility wrapper)
 * @deprecated Use searchAllZones() instead
 */
export async function searchAllRioZones(maxStores = 111, existingPlaceIds = []) {
    return searchAllZones(maxStores, existingPlaceIds, RIO_SEARCH_ZONES, 'Brasil');
}
