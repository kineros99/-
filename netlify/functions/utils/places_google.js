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
 */
export async function searchPlaceByAddress(address) {
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
        console.log(`[Places API] Searching for business at: "${address}"`);

        const response = await fetch(PLACES_SEARCH_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': GOOGLE_API_KEY,
                'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types,places.businessStatus'
            },
            body: JSON.stringify({
                textQuery: address,
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

        return {
            success: true,
            found: true,
            placeId: place.id,
            name: place.displayName?.text || null,
            address: place.formattedAddress || null,
            types: place.types || [],
            businessStatus: place.businessStatus || 'UNKNOWN'
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
 */
export async function findBusinessByAddress(address) {
    console.log(`[Places API] Looking up business at: "${address}"`);

    // Step 1: Search for the place
    const searchResult = await searchPlaceByAddress(address);

    if (!searchResult.success) {
        return searchResult;
    }

    if (!searchResult.found) {
        return {
            success: true,
            found: false,
            message: 'No business registered at this address in Google database',
            suggestion: 'Will use user-provided information'
        };
    }

    // Step 2: Get detailed information
    const detailsResult = await getPlaceDetails(searchResult.placeId);

    if (!detailsResult.success) {
        return {
            success: true,
            found: true,
            partial: true,
            message: 'Found business but could not retrieve full details',
            basicInfo: {
                name: searchResult.name,
                address: searchResult.address,
                placeId: searchResult.placeId
            }
        };
    }

    // Step 3: Return combined result
    console.log(`[Places API] ✓ Complete business data retrieved`);

    return {
        success: true,
        found: true,
        placeId: searchResult.placeId,
        business: {
            name: detailsResult.details.name,
            address: detailsResult.details.address,
            phone: detailsResult.details.phone,
            website: detailsResult.details.website,
            businessStatus: detailsResult.details.businessStatus,
            types: detailsResult.details.types,
            location: detailsResult.details.location
        },
        source: 'Google Places API'
    };
}
