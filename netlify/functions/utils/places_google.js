/**
 * ============================================================================
 * Google Places API (New) Integration
 * ============================================================================
 *
 * This module provides integration with Google Places API to:
 * 1. Search for existing businesses at a given address
 * 2. Retrieve detailed business information (name, phone, website)
 * 3. Enhance store registration with Google's verified data
 *
 * API Documentation: https://developers.google.com/maps/documentation/places/web-service
 *
 * Pricing:
 * - Place Search (Text): $32 per 1000 requests
 * - Place Details (Basic + Contact): $17 per 1000 requests
 * - Total: ~$49 per 1000 lookups
 *
 * Field SKUs:
 * - Basic: displayName, types, businessStatus
 * - Contact: nationalPhoneNumber, internationalPhoneNumber, websiteUri
 * - Location: formattedAddress, location
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const PLACES_DETAILS_URL = 'https://places.googleapis.com/v1';

/**
 * Search for a place by address/name using Text Search
 * Returns place_id which can be used to get details
 *
 * @param {string} address - The address to search for
 * @param {string} businessName - Optional business name for better results
 */
export async function searchPlaceByAddress(address, businessName = null) {
    if (!address || typeof address !== 'string') {
        return {
            success: false,
            error: 'Invalid address',
            message: 'Address must be a non-empty string'
        };
    }

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing'
        };
    }

    try {
        // Build search query - prioritize business name + address for better results
        let searchQuery = address;
        if (businessName && businessName.trim()) {
            searchQuery = `${businessName}, ${address}`;
            console.log(`[Places API] Searching with business name: "${searchQuery}"`);
        } else {
            console.log(`[Places API] Searching with address only: "${searchQuery}"`);
        }

        const response = await fetch(PLACES_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                // Request ALL fields in one call (New API includes everything in search)
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.location'
            },
            body: JSON.stringify({
                textQuery: searchQuery,
                languageCode: 'pt-BR',
                regionCode: 'BR',
                maxResultCount: 1
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Places API] HTTP error: ${response.status} - ${errorText}`);
            return {
                success: false,
                error: 'Places API request failed',
                message: `HTTP ${response.status}: ${response.statusText}`,
                details: errorText
            };
        }

        const data = await response.json();

        // Check if any places were found
        if (!data.places || data.places.length === 0) {
            console.log(`[Places API] No business found at address`);
            return {
                success: true,
                found: false,
                message: 'No business found at this address in Google database'
            };
        }

        const place = data.places[0];

        console.log(`[Places API] ✓ Found business: ${place.displayName?.text || 'Unknown'}`);
        console.log(`[Places API] Place ID: ${place.id}`);

        // New API returns all data in search response - no need for second call!
        return {
            success: true,
            found: true,
            placeId: place.id,
            name: place.displayName?.text || null,
            address: place.formattedAddress || null,
            phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
            website: place.websiteUri || null,
            types: place.types || [],
            businessStatus: place.businessStatus || 'UNKNOWN',
            location: place.location ? {
                latitude: place.location.latitude,
                longitude: place.location.longitude
            } : null
        };

    } catch (error) {
        console.error('[Places API] Search error:', error);
        return {
            success: false,
            error: 'Places search failed',
            message: error.message,
            details: error.toString()
        };
    }
}

/**
 * Get detailed information about a place using its place_id
 * Retrieves: name, phone, website, address
 */
export async function getPlaceDetails(placeId) {
    if (!placeId) {
        return {
            success: false,
            error: 'Invalid place ID',
            message: 'Place ID is required'
        };
    }

    if (!GOOGLE_API_KEY) {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing'
        };
    }

    try {
        console.log(`[Places API] Fetching details for place: ${placeId}`);

        const url = `${PLACES_DETAILS_URL}/${placeId}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'displayName,formattedAddress,nationalPhoneNumber,internationalPhoneNumber,websiteUri,businessStatus,types,location'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Places API] Details error: ${response.status} - ${errorText}`);
            return {
                success: false,
                error: 'Failed to get place details',
                message: `HTTP ${response.status}: ${response.statusText}`,
                details: errorText
            };
        }

        const place = await response.json();

        console.log(`[Places API] ✓ Got details for: ${place.displayName?.text || 'Unknown'}`);

        return {
            success: true,
            details: {
                name: place.displayName?.text || null,
                address: place.formattedAddress || null,
                phone: place.nationalPhoneNumber || place.internationalPhoneNumber || null,
                website: place.websiteUri || null,
                businessStatus: place.businessStatus || 'UNKNOWN',
                types: place.types || [],
                location: place.location ? {
                    latitude: place.location.latitude,
                    longitude: place.location.longitude
                } : null
            }
        };

    } catch (error) {
        console.error('[Places API] Details fetch error:', error);
        return {
            success: false,
            error: 'Failed to get place details',
            message: error.message,
            details: error.toString()
        };
    }
}

/**
 * Combined function: Search and get details in one call
 * This is the main function to use for store registration
 *
 * TWO-STAGE SEARCH STRATEGY:
 * Stage 1: Search with business name + address (best results for existing businesses)
 * Stage 2: Fallback to address-only search if Stage 1 fails or returns incomplete data
 *
 * Note: Google Places API (New) returns all data in the search response,
 * so we don't need a separate details call
 *
 * @param {string} address - The address to search for
 * @param {string} businessName - Optional business name for better results
 */
export async function findBusinessByAddress(address, businessName = null) {
    console.log(`[Places API] ═══════════════════════════════════════════════`);
    console.log(`[Places API] STARTING TWO-STAGE SEARCH`);
    console.log(`[Places API] Address: "${address}"`);
    console.log(`[Places API] Business Name: "${businessName || 'Not provided'}"`);
    console.log(`[Places API] ═══════════════════════════════════════════════`);

    let stage1Result = null;
    let stage2Result = null;

    // ===== STAGE 1: Try with business name + address (if name provided) =====
    if (businessName && businessName.trim()) {
        console.log(`\n[Places API] 🔍 STAGE 1: Searching with business name + address...`);
        stage1Result = await searchPlaceByAddress(address, businessName);

        if (!stage1Result.success) {
            console.log(`[Places API] ⚠️  Stage 1 failed with error: ${stage1Result.error}`);
            // Continue to Stage 2
        } else if (!stage1Result.found) {
            console.log(`[Places API] ⚠️  Stage 1: No results found`);
            // Continue to Stage 2
        } else {
            // Check if we got complete data
            const hasCompleteData = stage1Result.phone || stage1Result.website;

            if (hasCompleteData) {
                console.log(`[Places API] ✅ STAGE 1 SUCCESS: Complete business data found!`);
                console.log(`[Places API]    Name: ${stage1Result.name}`);
                console.log(`[Places API]    Phone: ${stage1Result.phone || 'N/A'}`);
                console.log(`[Places API]    Website: ${stage1Result.website || 'N/A'}`);
                console.log(`[Places API] ═══════════════════════════════════════════════`);

                return {
                    success: true,
                    found: true,
                    placeId: stage1Result.placeId,
                    business: {
                        name: stage1Result.name,
                        address: stage1Result.address,
                        phone: stage1Result.phone,
                        website: stage1Result.website,
                        businessStatus: stage1Result.businessStatus,
                        types: stage1Result.types,
                        location: stage1Result.location
                    },
                    source: 'Google Places API (Business Name + Address)',
                    searchStrategy: 'stage1'
                };
            } else {
                console.log(`[Places API] ⚠️  Stage 1: Found location but incomplete data (no phone/website)`);
                console.log(`[Places API]    Will try Stage 2 for better results...`);
                // Continue to Stage 2
            }
        }
    } else {
        console.log(`[Places API] ⏭️  STAGE 1 SKIPPED: No business name provided`);
    }

    // ===== STAGE 2: Fallback to address-only search =====
    console.log(`\n[Places API] 🔍 STAGE 2: Searching with address only...`);
    stage2Result = await searchPlaceByAddress(address, null);

    if (!stage2Result.success) {
        console.log(`[Places API] ❌ STAGE 2 FAILED`);
        console.log(`[Places API] ═══════════════════════════════════════════════`);
        return stage2Result;
    }

    if (!stage2Result.found) {
        console.log(`[Places API] ❌ STAGE 2: No business found at this address`);
        console.log(`[Places API] ═══════════════════════════════════════════════`);
        return {
            success: true,
            found: false,
            message: 'No business registered at this address in Google database',
            suggestion: 'Will use user-provided information',
            searchStrategy: 'stage2_not_found'
        };
    }

    // Check if Stage 2 has complete data
    const hasCompleteData = stage2Result.phone || stage2Result.website;

    if (hasCompleteData) {
        console.log(`[Places API] ✅ STAGE 2 SUCCESS: Complete business data found!`);
        console.log(`[Places API]    Name: ${stage2Result.name}`);
        console.log(`[Places API]    Phone: ${stage2Result.phone || 'N/A'}`);
        console.log(`[Places API]    Website: ${stage2Result.website || 'N/A'}`);
        console.log(`[Places API] ═══════════════════════════════════════════════`);

        return {
            success: true,
            found: true,
            placeId: stage2Result.placeId,
            business: {
                name: stage2Result.name,
                address: stage2Result.address,
                phone: stage2Result.phone,
                website: stage2Result.website,
                businessStatus: stage2Result.businessStatus,
                types: stage2Result.types,
                location: stage2Result.location
            },
            source: 'Google Places API (Address Only)',
            searchStrategy: 'stage2'
        };
    }

    // Found location but no complete business data
    console.log(`[Places API] ⚠️  STAGE 2: Found location but no business contact details`);
    console.log(`[Places API] ═══════════════════════════════════════════════`);

    return {
        success: true,
        found: true,
        partial: true,
        message: 'Found location but no business contact details available',
        basicInfo: {
            name: stage2Result.name,
            address: stage2Result.address,
            placeId: stage2Result.placeId
        },
        searchStrategy: 'stage2_partial'
    };
}
