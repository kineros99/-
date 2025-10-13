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
 * Search for nearby stores in a specific location
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
        const countryConfig = getCountryConfig(countryName);
        console.log(`[Nearby Search] Searching at [${latitude}, ${longitude}] radius ${radius}m in ${countryName} (${countryConfig.code})`);

        const response = await fetch(PLACES_NEARBY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.businessStatus,places.types'
            },
            body: JSON.stringify({
                includedTypes: ['hardware_store', 'home_improvement_store'],
                maxResultCount: maxResults,
                locationRestriction: {
                    circle: {
                        center: {
                            latitude: latitude,
                            longitude: longitude
                        },
                        radius: radius
                    }
                },
                languageCode: countryConfig.language,
                regionCode: countryConfig.code
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Nearby Search] HTTP error: ${response.status} - ${errorText}`);
            return {
                success: false,
                error: 'Nearby search failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                details: errorText
            };
        }

        const data = await response.json();

        if (!data.places || data.places.length === 0) {
            console.log(`[Nearby Search] No stores found in this area`);
            return {
                success: true,
                found: 0,
                stores: []
            };
        }

        // Format the results
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

        console.log(`[Nearby Search] ✓ Found ${stores.length} stores`);

        return {
            success: true,
            found: stores.length,
            stores: stores
        };

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
 */
export async function searchAllZones(maxStores = 111, existingPlaceIds = [], zones = null, countryName = 'Brasil') {
    // Use provided zones or fall back to Rio zones for backward compatibility
    const searchZones = zones || RIO_SEARCH_ZONES;

    const allStores = [];
    let apiCallsUsed = 0;
    let storesSkipped = 0;

    console.log(`[Zone Search] Starting search across ${searchZones.length} zones in ${countryName}`);
    console.log(`[Zone Search] Max stores: ${maxStores}`);
    console.log(`[Zone Search] Existing Place IDs to skip: ${existingPlaceIds.length}`);

    for (const zone of searchZones) {
        if (allStores.length >= maxStores) {
            console.log(`[Zone Search] Reached max stores limit (${maxStores})`);
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

        apiCallsUsed++;

        if (!result.success) {
            console.error(`[Zone Search] ⚠️  Failed to search ${name}: ${result.message}`);
            continue;
        }

        if (result.found === 0) {
            console.log(`[Zone Search] No stores found in ${name}`);
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

    console.log(`\n[Zone Search] ✅ Search complete`);
    console.log(`[Zone Search] Total stores found: ${allStores.length}`);
    console.log(`[Zone Search] Stores skipped (duplicates): ${storesSkipped}`);
    console.log(`[Zone Search] API calls used: ${apiCallsUsed}`);

    return {
        success: true,
        stores: allStores,
        statistics: {
            zonesSearched: Math.min(searchZones.length, apiCallsUsed),
            storesFound: allStores.length,
            storesSkipped: storesSkipped,
            apiCallsUsed: apiCallsUsed,
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
